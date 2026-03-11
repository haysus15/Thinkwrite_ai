import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { markFinalAnswerAndComplete, updateWorkSessionCounts } from "@/lib/math-mode/db";

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
    const problemId =
      typeof body?.problem_id === "string" ? body.problem_id : "";
    const stepId = typeof body?.step_id === "string" ? body.step_id : "";

    if (!problemId || !stepId) {
      return NextResponse.json(
        { error: "problem_id and step_id are required." },
        { status: 400 }
      );
    }

    await updateWorkSessionCounts({ problemId, userId });
    const result = await markFinalAnswerAndComplete({
      userId,
      problemId,
      stepId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to mark final answer.",
      },
      { status: 500 }
    );
  }
}
