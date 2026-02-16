import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_LANGUAGES = new Set(["python", "sql", "javascript"]);
const ALLOWED_ENTRY_TYPES = new Set([
  "structured_path",
  "assignment",
  "sandbox",
]);

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const language = typeof body?.language === "string" ? body.language : "";
  const entryType = typeof body?.entry_type === "string" ? body.entry_type : "";
  const pathId = typeof body?.path_id === "string" ? body.path_id : null;
  const assignmentId =
    typeof body?.assignment_id === "string" ? body.assignment_id : null;
  const codeSnapshot =
    typeof body?.code_snapshot === "string" ? body.code_snapshot : null;

  if (!ALLOWED_LANGUAGES.has(language)) {
    return NextResponse.json(
      { success: false, error: "Invalid language." },
      { status: 400 }
    );
  }
  if (!ALLOWED_ENTRY_TYPES.has(entryType)) {
    return NextResponse.json(
      { success: false, error: "Invalid entry_type." },
      { status: 400 }
    );
  }
  if (entryType === "structured_path" && !pathId) {
    return NextResponse.json(
      { success: false, error: "path_id is required for structured_path." },
      { status: 400 }
    );
  }
  if (entryType === "assignment" && !assignmentId) {
    return NextResponse.json(
      { success: false, error: "assignment_id is required for assignment." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: insertError } = await supabase
    .schema("coding_review")
    .from("sessions")
    .insert({
      user_id: userId,
      language,
      entry_type: entryType,
      path_id: pathId,
      assignment_id: assignmentId,
      code_snapshot: codeSnapshot,
    })
    .select("*")
    .single();

  if (insertError || !data) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Create failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, session: data }, { status: 200 });
}
