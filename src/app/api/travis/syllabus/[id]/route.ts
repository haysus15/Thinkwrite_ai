// src/app/api/travis/syllabus/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: syllabus, error: fetchError } = await supabase
    .from("syllabi")
    .select(
      "id, class_name, parsed_data, confirmed, uploaded_at, status, reviewed_at, reviewed_by"
    )
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !syllabus) {
    return NextResponse.json(
      { success: false, error: "Syllabus not found." },
      { status: 404 }
    );
  }

  const { data: drafts, error: draftsError } = await supabase
    .from("syllabus_assignment_drafts")
    .select(
      "id, assignment_name, class_name, assignment_type, due_date, requirements, grading_weight, draft_status, parser_confidence, parser_notes, position, created_at, updated_at"
    )
    .eq("syllabus_id", params.id)
    .eq("user_id", userId)
    .order("position", { ascending: true });

  if (draftsError) {
    return NextResponse.json(
      { success: false, error: draftsError.message },
      { status: 500 }
    );
  }

  const { data: approvals, error: approvalsError } = await supabase
    .from("syllabus_approval_events")
    .select(
      "id, approved_at, assignments_created, assignments_archived, notes, event_payload"
    )
    .eq("syllabus_id", params.id)
    .eq("user_id", userId)
    .order("approved_at", { ascending: false })
    .limit(10);

  if (approvalsError) {
    return NextResponse.json(
      { success: false, error: approvalsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      syllabus,
      drafts: drafts || [],
      approvalHistory: approvals || [],
    },
    { status: 200 }
  );
}
