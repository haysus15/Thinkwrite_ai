import { NextResponse } from "next/server";
import { mathStore } from "@/lib/math-mode/store";
import { getAuthUser } from "@/lib/auth/getAuthUser";

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const problemId = body?.problem_id;
  if (!problemId) {
    return NextResponse.json({ error: "Problem id required" }, { status: 400 });
  }

  const step = mathStore.createStep({
    problem_id: problemId,
    user_id: userId,
    step_number: Number(body?.step_number || 1),
    latex: body?.latex || "",
    reasoning: body?.reasoning,
  });

  return NextResponse.json({ step });
}
