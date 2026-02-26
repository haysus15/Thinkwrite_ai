import { NextResponse } from "next/server";
import { mathStore } from "@/lib/math-mode/store";
import { getAuthUser } from "@/lib/auth/getAuthUser";

export async function GET(
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
  const problem = mathStore.getProblem(id);
  if (!problem) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    problem,
    steps: mathStore.listSteps(problem.id),
    guidance: mathStore.listGuidance(problem.id),
  });
}

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
  const updates = await request.json();
  const problem = mathStore.updateProblem(id, updates);
  if (!problem) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ problem });
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
  mathStore.deleteProblem(id);
  return NextResponse.json({ success: true });
}
