import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ParsedAssignmentPrompt } from "@/lib/paper-workflow/assignmentParser";

type ConfirmPrompt = ParsedAssignmentPrompt;

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const assignmentSetId =
      typeof body?.assignment_set_id === "string" ? body.assignment_set_id : "";
    const prompts = Array.isArray(body?.prompts) ? (body.prompts as ConfirmPrompt[]) : [];

    if (!assignmentSetId || prompts.length === 0) {
      return NextResponse.json(
        { error: "assignment_set_id and prompts are required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: setRow, error: setError } = await supabase
      .from("paper_assignment_sets")
      .select("id")
      .eq("id", assignmentSetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (setError || !setRow) {
      return NextResponse.json({ error: "Assignment set not found." }, { status: 404 });
    }

    const rows = prompts
      .map((prompt, index) => {
        const promptText = String(prompt.raw_text || "").trim();
        if (!promptText) return null;
        return {
          user_id: userId,
          assignment_set_id: assignmentSetId,
          set_order:
            prompt.order == null || Number.isNaN(Number(prompt.order))
              ? index + 1
              : Number(prompt.order),
          topic: promptText.slice(0, 180),
          paper_content: "",
          citation_style: null,
          citation_count: null,
          word_count: prompt.word_count_hint ?? null,
          checkpoint_passed: false,
          emergency_skip_used: false,
          is_complete: false,
          workflow_step: "outline",
          workflow_step_updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (rows.length === 0) {
      return NextResponse.json({ error: "At least one valid prompt is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("academic_papers")
      .insert(rows)
      .select("id");

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Unable to create papers for assignment set." },
        { status: 500 }
      );
    }

    const { error: setUpdateError } = await supabase
      .from("paper_assignment_sets")
      .update({
        paper_count: rows.length,
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentSetId)
      .eq("user_id", userId);

    if (setUpdateError) {
      return NextResponse.json({ error: setUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({
      created: data.length,
      paper_ids: data.map((row) => String(row.id)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to confirm prompts." },
      { status: 500 }
    );
  }
}
