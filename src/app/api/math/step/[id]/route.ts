import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import {
  deleteMathStep,
  invalidateDownstreamSteps,
  updateMathStep,
  updateWorkSessionCounts,
} from "@/lib/math-mode/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id } = await params;
  try {
    const updates = await request.json();
    const supabase = await createSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from("math_steps")
      .select("id, problem_id, step_number")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError || !existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const editedMath =
      typeof updates?.latex === "string" ||
      typeof updates?.plain_text === "string" ||
      typeof updates?.reasoning === "string";

    const step = await updateMathStep(id, userId, {
      ...updates,
      status: editedMath ? "unchecked" : updates?.status,
      verified_at: editedMath ? null : updates?.verified_at,
    });

    if (editedMath) {
      await invalidateDownstreamSteps({
        userId,
        problemId: String(existing.problem_id),
        stepNumber: Number(existing.step_number || 0),
      });
      await updateWorkSessionCounts({
        userId,
        problemId: String(existing.problem_id),
      });
    }

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id } = await params;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase
      .from("math_steps")
      .select("problem_id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    await deleteMathStep(id, userId);
    if (existing?.problem_id) {
      await updateWorkSessionCounts({
        userId,
        problemId: String(existing.problem_id),
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
