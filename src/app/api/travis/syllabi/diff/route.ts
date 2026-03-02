import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DiffItem = {
  key: string;
  assignment_name: string;
  assignment_type: string | null;
  due_date: string | null;
  grading_weight: number | null;
  module_reference: string | null;
};

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractModuleReference(requirements: unknown): string | null {
  if (!requirements || typeof requirements !== "object") return null;
  const candidate = (requirements as Record<string, unknown>).module_reference;
  return typeof candidate === "string" ? candidate : null;
}

function toDiffItem(row: {
  assignment_name: string;
  assignment_type: string | null;
  due_date: string | null;
  grading_weight: number | null;
  requirements: unknown;
}): DiffItem {
  const module_reference = extractModuleReference(row.requirements);
  const normalizedName = normalizeText(row.assignment_name);
  const key = module_reference
    ? `${normalizedName}::${module_reference}`
    : normalizedName;

  return {
    key,
    assignment_name: row.assignment_name,
    assignment_type: row.assignment_type,
    due_date: row.due_date,
    grading_weight: row.grading_weight,
    module_reference,
  };
}

function areDifferent(a: DiffItem, b: DiffItem) {
  return (
    normalizeText(a.assignment_name) !== normalizeText(b.assignment_name) ||
    normalizeText(a.assignment_type || null) !== normalizeText(b.assignment_type || null) ||
    (a.due_date || null) !== (b.due_date || null) ||
    (a.grading_weight ?? null) !== (b.grading_weight ?? null)
  );
}

export async function GET(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const search = request.nextUrl.searchParams;
  const fromId = search.get("from_id");
  const toId = search.get("to_id");
  if (!fromId || !toId) {
    return NextResponse.json(
      { success: false, error: "from_id and to_id are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: syllabi, error: syllabiError } = await supabase
    .from("syllabi")
    .select("id, user_id, class_name, status, confirmed")
    .eq("user_id", userId)
    .in("id", [fromId, toId]);

  if (syllabiError) {
    return NextResponse.json(
      { success: false, error: syllabiError.message },
      { status: 500 }
    );
  }

  if (!syllabi || syllabi.length !== 2) {
    return NextResponse.json(
      { success: false, error: "One or both syllabus IDs were not found." },
      { status: 404 }
    );
  }

  const fromSyllabus = syllabi.find((row) => row.id === fromId);
  const toSyllabus = syllabi.find((row) => row.id === toId);
  if (!fromSyllabus || !toSyllabus) {
    return NextResponse.json(
      { success: false, error: "Unable to resolve syllabus IDs." },
      { status: 404 }
    );
  }

  const loadItems = async (syllabusId: string, approved: boolean) => {
    if (approved) {
      const { data } = await supabase
        .from("assignments")
        .select(
          "assignment_name, assignment_type, due_date, grading_weight, requirements"
        )
        .eq("user_id", userId)
        .eq("syllabus_id", syllabusId)
        .is("archived_at", null);
      return (data || []).map(toDiffItem);
    }

    const { data } = await supabase
      .from("syllabus_assignment_drafts")
      .select(
        "assignment_name, assignment_type, due_date, grading_weight, requirements"
      )
      .eq("user_id", userId)
      .eq("syllabus_id", syllabusId)
      .neq("draft_status", "rejected");
    return (data || []).map(toDiffItem);
  };

  const [fromItems, toItems] = await Promise.all([
    loadItems(fromId, Boolean(fromSyllabus.confirmed)),
    loadItems(toId, Boolean(toSyllabus.confirmed)),
  ]);

  const fromMap = new Map(fromItems.map((item) => [item.key, item]));
  const toMap = new Map(toItems.map((item) => [item.key, item]));

  const added: DiffItem[] = [];
  const removed: DiffItem[] = [];
  const changed: Array<{ from: DiffItem; to: DiffItem }> = [];

  toMap.forEach((toItem, key) => {
    const fromItem = fromMap.get(key);
    if (!fromItem) {
      added.push(toItem);
      return;
    }
    if (areDifferent(fromItem, toItem)) {
      changed.push({ from: fromItem, to: toItem });
    }
  });

  fromMap.forEach((fromItem, key) => {
    if (!toMap.has(key)) {
      removed.push(fromItem);
    }
  });

  return NextResponse.json(
    {
      success: true,
      diff: {
        from_id: fromId,
        to_id: toId,
        class_name: toSyllabus.class_name || fromSyllabus.class_name || null,
        counts: {
          added: added.length,
          removed: removed.length,
          changed: changed.length,
        },
        added,
        removed,
        changed,
      },
    },
    { status: 200 }
  );
}
