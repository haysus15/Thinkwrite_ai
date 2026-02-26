import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { mathStore } from "@/lib/math-mode/store";

export async function GET() {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const problems = mathStore.listProblems(userId);
  return NextResponse.json({ problems });
}
