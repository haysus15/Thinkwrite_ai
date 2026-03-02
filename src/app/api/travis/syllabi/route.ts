import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SyllabusRow = {
  id: string;
  class_name: string;
  status: string | null;
  uploaded_at: string | null;
  reviewed_at: string | null;
  confirmed: boolean | null;
  parsed_data: {
    assignments?: unknown[];
  } | null;
};

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: syllabiData, error: syllabiError } = await supabase
    .from("syllabi")
    .select(
      "id, class_name, status, uploaded_at, reviewed_at, confirmed, parsed_data"
    )
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });

  if (syllabiError) {
    return NextResponse.json(
      { success: false, error: syllabiError.message },
      { status: 500 }
    );
  }

  const syllabi = (syllabiData || []) as SyllabusRow[];
  if (syllabi.length === 0) {
    return NextResponse.json({ success: true, syllabi: [] }, { status: 200 });
  }

  const syllabusIds = syllabi.map((row) => row.id);
  const [{ data: draftRows }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from("syllabus_assignment_drafts")
      .select("syllabus_id, draft_status")
      .eq("user_id", userId)
      .in("syllabus_id", syllabusIds),
    supabase
      .from("assignments")
      .select("syllabus_id, completed, archived_at")
      .eq("user_id", userId)
      .in("syllabus_id", syllabusIds),
  ]);

  const draftCounts = new Map<
    string,
    { total: number; approved: number; rejected: number; published: number }
  >();
  (draftRows || []).forEach((row) => {
    const key = row.syllabus_id as string;
    const current = draftCounts.get(key) || {
      total: 0,
      approved: 0,
      rejected: 0,
      published: 0,
    };
    current.total += 1;
    if (row.draft_status === "approved") current.approved += 1;
    if (row.draft_status === "rejected") current.rejected += 1;
    if (row.draft_status === "published") current.published += 1;
    draftCounts.set(key, current);
  });

  const assignmentCounts = new Map<
    string,
    { total: number; active: number; completed: number; archived: number }
  >();
  (assignmentRows || []).forEach((row) => {
    const key = row.syllabus_id as string;
    if (!key) return;
    const current = assignmentCounts.get(key) || {
      total: 0,
      active: 0,
      completed: 0,
      archived: 0,
    };
    current.total += 1;
    if (row.archived_at) {
      current.archived += 1;
    } else if (row.completed) {
      current.completed += 1;
    } else {
      current.active += 1;
    }
    assignmentCounts.set(key, current);
  });

  const response = syllabi.map((row) => {
    const drafts = draftCounts.get(row.id) || {
      total: row.parsed_data?.assignments?.length || 0,
      approved: 0,
      rejected: 0,
      published: 0,
    };
    const assignments = assignmentCounts.get(row.id) || {
      total: 0,
      active: 0,
      completed: 0,
      archived: 0,
    };
    return {
      id: row.id,
      class_name: row.class_name,
      status: row.status || (row.confirmed ? "approved" : "draft"),
      uploaded_at: row.uploaded_at,
      reviewed_at: row.reviewed_at,
      confirmed: Boolean(row.confirmed),
      counts: {
        drafts,
        assignments,
      },
    };
  });

  return NextResponse.json({ success: true, syllabi: response }, { status: 200 });
}
