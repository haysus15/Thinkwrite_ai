import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
  const reminderType = typeof body?.reminderType === "string" ? body.reminderType : "";

  if (!assignmentId || !reminderType) {
    return NextResponse.json(
      { success: false, error: "assignmentId and reminderType are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: updateError } = await supabase
    .from("assignment_reminders")
    .update({ dismissed: true })
    .eq("assignment_id", assignmentId)
    .eq("reminder_type", reminderType)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
