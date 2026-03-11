import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { detectSourceRequirements } from "@/lib/academic/victor/detectSourceRequirements";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const assignmentRequirements =
    body?.assignmentRequirements && typeof body.assignmentRequirements === "object"
      ? (body.assignmentRequirements as Record<string, unknown>)
      : null;
  const studentDeclaration =
    typeof body?.studentDeclaration === "string" ? body.studentDeclaration : "";
  const paperType = typeof body?.paperType === "string" ? body.paperType : null;

  try {
    const result = await detectSourceRequirements(
      assignmentRequirements,
      studentDeclaration,
      paperType
    );
    return NextResponse.json({ success: true, sourceRequirements: result });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Unable to detect source requirements.",
      },
      { status: 500 }
    );
  }
}
