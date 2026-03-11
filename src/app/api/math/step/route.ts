import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createMathStep,
  deleteMathStep,
  updateMathStep,
  updateWorkSessionCounts,
} from "@/lib/math-mode/db";
import type { MathStep } from "@/types/math-mode";

export async function GET(request: NextRequest) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const problemId = request.nextUrl.searchParams.get("problem_id");
  if (!problemId) {
    return NextResponse.json(
      { error: "problem_id is required" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("math_steps")
    .select("*")
    .eq("problem_id", problemId)
    .eq("user_id", userId)
    .order("step_number", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ steps: (data || []) as MathStep[] });
}

export async function POST(request: NextRequest) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const problemId = typeof body?.problem_id === "string" ? body.problem_id : "";
  if (!problemId) {
    return NextResponse.json(
      { error: "problem_id is required" },
      { status: 400 }
    );
  }

  try {
    const step = await createMathStep({
      userId,
      problemId,
      stepNumber: Number(body?.step_number || 1),
      latex: typeof body?.latex === "string" ? body.latex : "",
      reasoning: typeof body?.reasoning === "string" ? body.reasoning : undefined,
    });
    return NextResponse.json({ step });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create step.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const step = await updateMathStep(id, userId, body);
    return NextResponse.json({ step });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update step.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  let id = request.nextUrl.searchParams.get("id") || "";
  let problemId = request.nextUrl.searchParams.get("problem_id") || "";
  let afterStepNumber = Number(request.nextUrl.searchParams.get("after_step_number") || "");
  if (!id) {
    try {
      const body = await request.json();
      id = typeof body?.id === "string" ? body.id : "";
      problemId =
        typeof body?.problem_id === "string" ? body.problem_id : problemId;
      afterStepNumber = Number(body?.after_step_number || afterStepNumber || "");
    } catch {
      id = "";
    }
  }

  if (problemId && Number.isFinite(afterStepNumber) && afterStepNumber >= 0) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase
        .from("math_steps")
        .delete()
        .eq("problem_id", problemId)
        .eq("user_id", userId)
        .gt("step_number", afterStepNumber);
      if (error) throw error;
      await updateWorkSessionCounts({ problemId, userId });
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unable to revert steps.",
        },
        { status: 500 }
      );
    }
  }

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: existingStep } = await supabase
      .from("math_steps")
      .select("problem_id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    await deleteMathStep(id, userId);
    if (existingStep?.problem_id) {
      await updateWorkSessionCounts({
        problemId: String(existingStep.problem_id),
        userId,
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete step.",
      },
      { status: 500 }
    );
  }
}
