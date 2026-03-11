import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTravisMessage } from "@/lib/travisReminders";

type ReminderRow = {
  id: string;
  assignment_id: string;
  reminder_type: "3_days" | "1_day" | "due_today" | "overdue" | "at_risk";
  sent_at?: string | null;
  created_at?: string | null;
};

type AssignmentLabelRow = {
  id: string;
  assignment_name: string;
  class_name: string;
};

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: activeReminders, error: remindersError } = await supabase
    .from("assignment_reminders")
    .select("*")
    .eq("user_id", userId)
    .eq("dismissed", false)
    .order("id", { ascending: false })
    .limit(30);

  if (remindersError) {
    return NextResponse.json(
      { success: false, error: remindersError.message },
      { status: 500 }
    );
  }

  const assignmentIds = Array.from(
    new Set((activeReminders || []).map((reminder: ReminderRow) => reminder.assignment_id))
  );
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, assignment_name, class_name")
    .eq("user_id", userId)
    .in("id", assignmentIds);

  const assignmentById = new Map(
    (assignments || []).map((assignment: AssignmentLabelRow) => [assignment.id, assignment])
  );

  const reminders = (activeReminders || []).map((reminder: ReminderRow) => {
    const assignment = assignmentById.get(reminder.assignment_id);
    const reminderTimestamp = reminder.sent_at || reminder.created_at || new Date().toISOString();
    return {
      id: reminder.id,
      assignmentId: reminder.assignment_id,
      reminderType: reminder.reminder_type,
      createdAt: reminderTimestamp,
      message: assignment
        ? getTravisMessage(reminder.reminder_type, assignment)
        : "You have an assignment reminder from Travis.",
    };
  });

  return NextResponse.json({ success: true, reminders }, { status: 200 });
}
