import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { parseAssignmentPrompts } from "@/lib/paper-workflow/assignmentParser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text : "";
    const assignmentSetId = typeof body?.assignment_set_id === "string" ? body.assignment_set_id : "";

    if (!text.trim() || !assignmentSetId) {
      return NextResponse.json(
        { error: "text and assignment_set_id are required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: setRow, error: setError } = await supabase
      .from("paper_assignment_sets")
      .select("id")
      .eq("id", assignmentSetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (setError || !setRow) {
      return NextResponse.json({ error: "Assignment set not found." }, { status: 404 });
    }

    const prompts = await parseAssignmentPrompts({ text, apiKey: getClaudeApiKey() });
    return NextResponse.json({ prompts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to parse assignment text." },
      { status: 500 }
    );
  }
}
