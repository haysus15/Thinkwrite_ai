import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import {
  createMathProblemSet,
  deleteMathProblemSet,
  listMathProblemSets,
  updateMathProblemSet,
} from "@/lib/math-mode/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const url = new URL(request.url);
    const setId = url.searchParams.get("id");
    const includeProblems = url.searchParams.get("include") === "problems";
    const sets = await listMathProblemSets(userId);
    if (!setId) {
      return NextResponse.json({ sets });
    }

    const found = sets.find((set) => set.id === setId);
    if (!found) {
      return NextResponse.json({ error: "Set not found." }, { status: 404 });
    }

    if (!includeProblems) {
      return NextResponse.json({ set: found });
    }

    const supabase = await createSupabaseServerClient();
    const { data: problems, error: problemsError } = await supabase
      .from("math_problems")
      .select("*")
      .eq("problem_set_id", setId)
      .eq("user_id", userId)
      .order("set_order", { ascending: true });
    if (problemsError) {
      return NextResponse.json({ error: problemsError.message }, { status: 500 });
    }

    const problemIds = Array.isArray(problems)
      ? problems.map((problem) => String(problem.id))
      : [];
    let finalAnswerMap = new Map<string, string>();
    let activityMap = new Map<string, boolean>();
    if (problemIds.length > 0) {
      const { data: finalSteps } = await supabase
        .from("math_steps")
        .select("problem_id, latex")
        .in("problem_id", problemIds)
        .eq("user_id", userId)
        .eq("is_final_answer", true);
      finalAnswerMap = new Map(
        Array.isArray(finalSteps)
          ? finalSteps.map((step) => [String(step.problem_id), String(step.latex || "")])
          : []
      );

      const { data: activitySteps } = await supabase
        .from("math_steps")
        .select("problem_id, latex, reasoning, verified_at")
        .in("problem_id", problemIds)
        .eq("user_id", userId);
      activityMap = new Map();
      for (const id of problemIds) {
        activityMap.set(id, false);
      }
      for (const step of Array.isArray(activitySteps) ? activitySteps : []) {
        const hasActivity =
          String(step.latex || "").trim().length > 0 ||
          String(step.reasoning || "").trim().length > 0 ||
          Boolean(step.verified_at);
        if (hasActivity) {
          activityMap.set(String(step.problem_id), true);
        }
      }
    }

    const withPreview = Array.isArray(problems)
      ? problems.map((problem) => ({
          ...problem,
          final_answer_preview: finalAnswerMap.get(String(problem.id)) || null,
          has_activity: activityMap.get(String(problem.id)) || false,
        }))
      : [];

    return NextResponse.json({ set: found, problems: withPreview });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list sets." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }
    const set = await createMathProblemSet({
      userId,
      title,
      className:
        typeof body?.class_name === "string" ? body.class_name.trim() : null,
      assignmentPrompt:
        typeof body?.assignment_prompt === "string"
          ? body.assignment_prompt.trim()
          : null,
      problemCount:
        body?.problem_count == null || Number.isNaN(Number(body.problem_count))
          ? null
          : Number(body.problem_count),
      sourceType:
        body?.source_type === "manual" ||
        body?.source_type === "paste" ||
        body?.source_type === "upload"
          ? body.source_type
          : "manual",
      sourceRaw:
        typeof body?.source_raw === "string" ? body.source_raw : null,
    });
    return NextResponse.json({ set });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create set." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const setId = typeof body?.id === "string" ? body.id : "";
    if (!setId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const set = await updateMathProblemSet(setId, userId, body);
    return NextResponse.json({ set });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update set." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const setId = typeof body?.id === "string" ? body.id : "";
    if (!setId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteMathProblemSet(setId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete set." },
      { status: 500 }
    );
  }
}
