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
  const latex = typeof body?.latex === "string" ? body.latex.trim() : "";
  if (!latex) {
    return NextResponse.json({ error: "Latex is required" }, { status: 400 });
  }

  const problem = mathStore.createProblem({
    user_id: userId,
    latex,
    plain_text: body?.plain_text,
    problem_type: body?.problem_type,
    graph_expression: body?.graph_expression,
    graph_visible: Boolean(body?.graph_visible),
  });

  return NextResponse.json({ problem });
}
