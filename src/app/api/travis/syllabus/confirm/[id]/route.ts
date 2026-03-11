// src/app/api/travis/syllabus/confirm/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeAssignmentType } from "@/lib/academic/assignmentType";
import { normalizeDueDateInput } from "@/lib/academic/dueDate";

type DraftUpdateInput = {
  id: string;
  class_name?: string;
  assignment_name?: string;
  assignment_type?: string | null;
  due_date?: string | null;
  requirements?: Record<string, unknown> | null;
  grading_weight?: number | null;
  approved?: boolean;
  rejected?: boolean;
};

type ParsedAssignmentFallback = {
  name?: string;
  type?: string | null;
  due_date?: string | null;
  requirements?: Record<string, unknown> | null;
  grading_weight?: number | null;
};

export async function POST(
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

  let body: {
    notes?: string;
    approve_all?: boolean;
    drafts?: DraftUpdateInput[];
  } = {};

  try {
    const raw = await request.text();
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }

  const incomingDrafts = Array.isArray(body.drafts) ? body.drafts : [];
  const hasIncomingUpdates = incomingDrafts.length > 0 || body.approve_all === true;

  const supabase = await createSupabaseServerClient();
  const { data: syllabus, error: fetchError } = await supabase
    .from("syllabi")
    .select("id, class_name, parsed_data, confirmed, status")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !syllabus) {
    return NextResponse.json(
      { success: false, error: "Syllabus not found." },
      { status: 404 }
    );
  }

  if (syllabus.confirmed && !hasIncomingUpdates) {
    return NextResponse.json(
      { success: true, alreadyConfirmed: true },
      { status: 200 }
    );
  }

  const { data: existingDrafts, error: draftsFetchError } = await supabase
    .from("syllabus_assignment_drafts")
    .select(
      "id, assignment_name, class_name, assignment_type, due_date, requirements, grading_weight, draft_status"
    )
    .eq("syllabus_id", params.id)
    .eq("user_id", userId)
    .order("position", { ascending: true });

  if (draftsFetchError) {
    return NextResponse.json(
      { success: false, error: draftsFetchError.message },
      { status: 500 }
    );
  }

  let drafts = existingDrafts ?? [];

  // Legacy fallback for syllabi uploaded before drafts were introduced.
  if (drafts.length === 0) {
    const parsedAssignments = Array.isArray(syllabus.parsed_data?.assignments)
      ? syllabus.parsed_data.assignments
      : [];
    if (parsedAssignments.length > 0) {
      const fallbackDrafts = parsedAssignments.map((assignment: ParsedAssignmentFallback, index: number) => ({
        syllabus_id: syllabus.id,
        user_id: userId,
        class_name: syllabus.class_name,
        assignment_name: assignment.name || `Assignment ${index + 1}`,
        assignment_type: normalizeAssignmentType(
          assignment.type,
          assignment.name || null
        ),
        due_date: normalizeDueDateInput(assignment.due_date),
        requirements: assignment.requirements || null,
        grading_weight:
          typeof assignment.grading_weight === "number"
            ? assignment.grading_weight
            : null,
        draft_status: "parsed",
        position: index,
      }));

      const { error: seedError } = await supabase
        .from("syllabus_assignment_drafts")
        .insert(fallbackDrafts);

      if (seedError) {
        return NextResponse.json(
          { success: false, error: seedError.message },
          { status: 500 }
        );
      }

      const { data: seededDrafts, error: seededFetchError } = await supabase
        .from("syllabus_assignment_drafts")
        .select(
          "id, assignment_name, class_name, assignment_type, due_date, requirements, grading_weight, draft_status"
        )
        .eq("syllabus_id", params.id)
        .eq("user_id", userId)
        .order("position", { ascending: true });

      if (seededFetchError) {
        return NextResponse.json(
          { success: false, error: seededFetchError.message },
          { status: 500 }
        );
      }
      drafts = seededDrafts ?? [];
    }
  }

  if (drafts.length === 0) {
    return NextResponse.json(
      { success: false, error: "No assignments to confirm." },
      { status: 400 }
    );
  }

  const knownDraftIds = new Set(drafts.map((draft) => draft.id));
  const applyApproveAll = body.approve_all ?? incomingDrafts.length === 0;

  for (const draft of incomingDrafts) {
    if (!knownDraftIds.has(draft.id)) {
      return NextResponse.json(
        { success: false, error: `Draft ${draft.id} does not belong to this syllabus.` },
        { status: 400 }
      );
    }

    const dueDate = normalizeDueDateInput(draft.due_date);
    const updates: Record<string, unknown> = {};
    if (draft.class_name !== undefined) updates.class_name = draft.class_name;
    if (draft.assignment_name !== undefined) {
      updates.assignment_name = draft.assignment_name;
    }
    if (draft.assignment_type !== undefined) {
      updates.assignment_type = normalizeAssignmentType(
        draft.assignment_type,
        draft.assignment_name || null
      );
    }
    if (draft.due_date !== undefined) updates.due_date = dueDate;
    if (draft.requirements !== undefined) {
      updates.requirements = draft.requirements;
    }
    if (draft.grading_weight !== undefined) {
      updates.grading_weight = draft.grading_weight;
    }
    if (draft.rejected === true) {
      updates.draft_status = "rejected";
    } else if (draft.approved === true) {
      updates.draft_status = "approved";
    } else if (Object.keys(updates).length > 0) {
      updates.draft_status = "edited";
    }

    if (Object.keys(updates).length === 0) continue;

    const { error: updateDraftError } = await supabase
      .from("syllabus_assignment_drafts")
      .update(updates)
      .eq("id", draft.id)
      .eq("syllabus_id", params.id)
      .eq("user_id", userId);

    if (updateDraftError) {
      return NextResponse.json(
        { success: false, error: updateDraftError.message },
        { status: 500 }
      );
    }
  }

  if (applyApproveAll) {
    const { error: bulkApproveError } = await supabase
      .from("syllabus_assignment_drafts")
      .update({ draft_status: "approved" })
      .eq("syllabus_id", params.id)
      .eq("user_id", userId)
      .neq("draft_status", "rejected");

    if (bulkApproveError) {
      return NextResponse.json(
        { success: false, error: bulkApproveError.message },
        { status: 500 }
      );
    }
  }

  const { data: approvedDrafts, error: approvedFetchError } = await supabase
    .from("syllabus_assignment_drafts")
    .select("id")
    .eq("syllabus_id", params.id)
    .eq("user_id", userId)
    .eq("draft_status", "approved");

  if (approvedFetchError) {
    return NextResponse.json(
      { success: false, error: approvedFetchError.message },
      { status: 500 }
    );
  }

  if (!approvedDrafts || approvedDrafts.length === 0) {
    return NextResponse.json(
      { success: false, error: "At least one assignment must be approved." },
      { status: 400 }
    );
  }

  const { data: publishResult, error: publishError } = await supabase.rpc(
    "publish_syllabus_approval",
    {
      p_syllabus_id: params.id,
      p_user_id: userId,
      p_notes: body.notes || null,
    }
  );

  if (publishError) {
    return NextResponse.json(
      { success: false, error: publishError.message },
      { status: 500 }
    );
  }

  const resultRow = Array.isArray(publishResult)
    ? publishResult[0]
    : publishResult;
  const assignmentsCreated = resultRow?.assignments_created ?? 0;
  const assignmentsArchived = resultRow?.assignments_archived ?? 0;

  return NextResponse.json(
    {
      success: true,
      assignmentsCreated,
      assignmentsArchived,
      approvedDrafts: approvedDrafts.length,
    },
    { status: 200 }
  );
}
