import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createMathProblem, updateMathProblemSet } from "@/lib/math-mode/db";

type ConfirmProblem = {
  order: number;
  raw_text: string;
  latex: string | null;
  problem_type:
    | "algebra"
    | "calculus"
    | "geometry"
    | "arithmetic"
    | "statistics"
    | "other";
};

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
    const problemSetId =
      typeof body?.problem_set_id === "string" ? body.problem_set_id : "";
    const problems = Array.isArray(body?.problems)
      ? (body.problems as ConfirmProblem[])
      : [];
    if (!problemSetId || problems.length === 0) {
      return NextResponse.json(
        { error: "problem_set_id and problems are required." },
        { status: 400 }
      );
    }

    const created = await Promise.all(
      problems.map((problem, index) =>
        createMathProblem({
          userId,
          latex: String(problem.latex || problem.raw_text || "").trim(),
          plainText: String(problem.raw_text || "").trim(),
          problemType: String(problem.problem_type || "other"),
          graphExpression: String(problem.latex || problem.raw_text || "").trim(),
          graphVisible: true,
          problemSetId,
          setOrder:
            problem.order == null || Number.isNaN(Number(problem.order))
              ? index + 1
              : Number(problem.order),
        })
      )
    );

    await updateMathProblemSet(problemSetId, userId, {
      problem_count: created.length,
      status: "in_progress",
    });

    return NextResponse.json({
      created: created.length,
      problem_ids: created.map((problem) => problem.id),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm worksheet problems.",
      },
      { status: 500 }
    );
  }
}
