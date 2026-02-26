import { NextResponse } from "next/server";
import { mathStore } from "@/lib/math-mode/store";
import { getAuthUser } from "@/lib/auth/getAuthUser";

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
  const step = mathStore.updateStep(id, updates);
  if (!step) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ step });
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
  mathStore.deleteStep(id);
  return NextResponse.json({ success: true });
}
