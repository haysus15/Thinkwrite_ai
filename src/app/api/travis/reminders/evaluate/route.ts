import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  evaluateReminders,
  getTravisMessage,
  type AssignmentForReminder,
} from "@/lib/travisReminders";

type ReminderRow = {
  id: string;
  assignment_id: string;
  reminder_type: "3_days" | "1_day" | "due_today" | "overdue" | "at_risk";
  dismissed: boolean;
  sent_at?: string | null;
  created_at?: string | null;
};

type ExistingReminderRow = {
  assignment_id: string;
  reminder_type: "3_days" | "1_day" | "due_today" | "overdue" | "at_risk";
  dismissed: boolean;
  sent_at?: string | null;
  created_at?: string | null;
};

type AssignmentLabelRow = {
  id: string;
  assignment_name: string;
  class_name: string;
};

export async function POST() {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select("id, assignment_name, class_name, due_date, status, completed, archived_at")
    .eq("user_id", userId)
    .is("archived_at", null)
    .neq("status", "completed")
    .neq("status", "submitted")
    .limit(500);

  if (assignmentsError) {
    return NextResponse.json(
      { success: false, error: assignmentsError.message },
      { status: 500 }
    );
  }

  const assignmentRows = (assignments || []) as AssignmentForReminder[];
  const candidates = evaluateReminders(assignmentRows, new Date());
  const todayIsoDate = new Date().toISOString().slice(0, 10);

  if (candidates.length > 0) {
    const assignmentIds = Array.from(new Set(candidates.map((candidate) => candidate.assignmentId)));
    const { data: existing } = await supabase
      .from("assignment_reminders")
      .select("*")
      .eq("user_id", userId)
      .in("assignment_id", assignmentIds);

    const todayExisting = (existing || []).filter((row: ExistingReminderRow) => {
      const timestamp = row.sent_at || row.created_at || "";
      const isoDate = typeof timestamp === "string" ? timestamp.slice(0, 10) : "";
      return isoDate === todayIsoDate;
    });

    const existingKeys = new Set(
      todayExisting.map(
        (row: ExistingReminderRow) => `${row.assignment_id}:${row.reminder_type}`
      )
    );
    const dismissedKeys = new Set(
      todayExisting
        .filter((row: ExistingReminderRow) => row.dismissed)
        .map((row: ExistingReminderRow) => `${row.assignment_id}:${row.reminder_type}`)
    );

    const inserts = candidates
      .filter((candidate) => {
        const key = `${candidate.assignmentId}:${candidate.reminderType}`;
        if (dismissedKeys.has(key)) return false;
        return !existingKeys.has(key);
      })
      .map((candidate) => ({
        assignment_id: candidate.assignmentId,
        user_id: userId,
        reminder_type: candidate.reminderType,
        sent_at: new Date().toISOString(),
        sent_on_date: todayIsoDate,
        dismissed: false,
      }));

    if (inserts.length > 0) {
      const { error: idempotentInsertError } = await supabase
        .from("assignment_reminders")
        .upsert(inserts, {
          onConflict: "assignment_id,user_id,reminder_type,sent_on_date",
          ignoreDuplicates: true,
        });
      if (idempotentInsertError) {
        // Fallback path for environments where sent_on_date/constraint has not been applied yet.
        await supabase.from("assignment_reminders").insert(
          inserts.map((row) => ({
            assignment_id: row.assignment_id,
            user_id: row.user_id,
            reminder_type: row.reminder_type,
            sent_at: row.sent_at,
            dismissed: row.dismissed,
          }))
        );
      }
    }
  }

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

  const activeAssignmentIds = Array.from(
    new Set((activeReminders || []).map((reminder: ReminderRow) => reminder.assignment_id))
  );
  const { data: activeAssignments } = await supabase
    .from("assignments")
    .select("id, assignment_name, class_name")
    .eq("user_id", userId)
    .in("id", activeAssignmentIds);

  const assignmentById = new Map(
    (activeAssignments || []).map((assignment: AssignmentLabelRow) => [assignment.id, assignment])
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
