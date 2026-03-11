import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { parseWorksheetText } from "@/lib/math-mode/worksheetParser";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

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
    const text = typeof body?.text === "string" ? body.text : "";
    const problemSetId =
      typeof body?.problem_set_id === "string" ? body.problem_set_id : "";

    if (!text.trim() || !problemSetId) {
      return NextResponse.json(
        { error: "text and problem_set_id are required." },
        { status: 400 }
      );
    }

    const problems = await parseWorksheetText({
      text,
      apiKey: getClaudeApiKey(),
    });
    return NextResponse.json({ problems });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to parse worksheet text.",
      },
      { status: 500 }
    );
  }
}
