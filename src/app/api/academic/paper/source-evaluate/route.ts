import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import {
  evaluateSource,
  type SectionSource,
  type StudentDeclaration,
} from "@/lib/academic/victor/evaluateSource";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const source = body?.source as SectionSource | undefined;
  const sectionContent =
    typeof body?.sectionContent === "string" ? body.sectionContent : "";
  const sectionTitle = typeof body?.sectionTitle === "string" ? body.sectionTitle : "";
  const studentDeclaration =
    body?.studentDeclaration && typeof body.studentDeclaration === "object"
      ? (body.studentDeclaration as StudentDeclaration)
      : {};
  const paperArgument = typeof body?.paperArgument === "string" ? body.paperArgument : "";

  if (!source || !source.title) {
    return NextResponse.json(
      { success: false, error: "Source title is required." },
      { status: 400 }
    );
  }

  try {
    const evaluation = await evaluateSource(
      source,
      sectionContent,
      sectionTitle,
      studentDeclaration,
      paperArgument
    );
    return NextResponse.json({ success: true, evaluation });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Source evaluation failed.",
      },
      { status: 500 }
    );
  }
}
