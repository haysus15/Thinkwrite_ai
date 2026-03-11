import { NextResponse } from "next/server";
import { POST as verifyStep } from "../../verify/route";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await getAuthUser();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const body = await request.json();
    let nextBody = {
      ...body,
      step: {
        ...(body?.step || {}),
        id,
      },
    };

    const hasProblem = Boolean(nextBody?.problem?.id);
    const hasSteps = Array.isArray(nextBody?.steps) && nextBody.steps.length > 0;
    const hasStepLatex = typeof nextBody?.step?.latex === "string";

    if (!hasProblem || !hasSteps || !hasStepLatex) {
      const supabase = await createSupabaseServerClient();
      const { data: stepRow, error: stepError } = await supabase
        .from("math_steps")
        .select("id, problem_id, step_number, latex, reasoning, status")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (stepError || !stepRow) {
        return NextResponse.json({ error: "Step not found." }, { status: 404 });
      }

      const problemId = String(stepRow.problem_id);
      const [{ data: problemRow, error: problemError }, { data: allSteps, error: stepsError }] =
        await Promise.all([
          supabase
            .from("math_problems")
            .select("id, latex, plain_text, problem_type, graph_expression, graph_visible")
            .eq("id", problemId)
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("math_steps")
            .select("id, problem_id, step_number, latex, reasoning, status")
            .eq("problem_id", problemId)
            .eq("user_id", userId)
            .order("step_number", { ascending: true }),
        ]);

      if (problemError || !problemRow) {
        return NextResponse.json({ error: "Problem not found." }, { status: 404 });
      }
      if (stepsError || !Array.isArray(allSteps)) {
        return NextResponse.json(
          { error: "Unable to load problem steps." },
          { status: 500 }
        );
      }

      nextBody = {
        ...nextBody,
        problem: {
          id: problemRow.id,
          latex: problemRow.latex,
          plain_text: problemRow.plain_text,
          problem_type: problemRow.problem_type,
          graph_expression: problemRow.graph_expression,
          graph_visible: problemRow.graph_visible,
        },
        step: {
          id: stepRow.id,
          latex: stepRow.latex,
          reasoning: stepRow.reasoning,
          step_number: stepRow.step_number,
          status: stepRow.status,
        },
        steps: allSteps,
      };
    }

    const proxyRequest = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextBody),
    });
    return verifyStep(proxyRequest);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to verify step.",
      },
      { status: 500 }
    );
  }
}
