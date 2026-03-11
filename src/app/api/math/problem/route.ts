import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import {
  createMathProblem,
  deleteMathProblem,
  listMathProblems,
  updateMathProblem,
} from "@/lib/math-mode/db";

export async function GET() {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const problems = await listMathProblems(userId);
    return NextResponse.json({ problems });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load problem history.",
      },
      { status: 500 }
    );
  }
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
  const latex = typeof body?.latex === "string" ? body.latex.trim() : "";
  if (!latex) {
    return NextResponse.json({ error: "Latex is required" }, { status: 400 });
  }

  try {
    const problem = await createMathProblem({
      userId,
      latex,
      plainText: body?.plain_text,
      problemType: body?.problem_type,
      graphExpression: body?.graph_expression,
      graphVisible: Boolean(body?.graph_visible),
      problemSetId:
        typeof body?.problem_set_id === "string" ? body.problem_set_id : null,
      setOrder:
        body?.set_order == null || Number.isNaN(Number(body.set_order))
          ? null
          : Number(body.set_order),
    });
    return NextResponse.json({ problem });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create problem.",
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
    const problem = await updateMathProblem(id, userId, body);
    return NextResponse.json({ problem });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update problem.",
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
  if (!id) {
    try {
      const body = await request.json();
      id = typeof body?.id === "string" ? body.id : "";
    } catch {
      id = "";
    }
  }

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await deleteMathProblem(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete problem.",
      },
      { status: 500 }
    );
  }
}
