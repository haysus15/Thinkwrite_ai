import "server-only";

import { createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { runTravisClaude } from "@/lib/academic/travisAi";
import { buildLanguageInstruction } from "@/lib/language/resolveLanguageContext";

export interface BackfillResult {
  processed: number;
  generated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

type ReminderType = "3_days" | "1_day" | "due_today" | "overdue" | "at_risk";

type ReminderBackfillRow = {
  id: string;
  user_id: string;
  assignment_id: string;
  reminder_type: ReminderType;
  generated_message: string | null;
  assignments:
    | {
        assignment_name: string | null;
        due_date: string | null;
      }[]
    | null;
  user_profiles:
    | {
        preferred_language: string | null;
      }[]
    | null;
  users:
    | {
        name: string | null;
      }[]
    | null;
};

const BATCH_SIZE = 50;
const ROW_DELAY_MS = 50;
const JOB_NAME = "backfill-travis-reminders";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLanguage(language: string | null | undefined): string {
  const value = String(language || "en").toLowerCase();
  return ["en", "es", "fr", "de", "pt", "zh", "ja", "ko"].includes(value) ? value : "en";
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toErrorMessage(reminderId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return `${reminderId}: ${message}`;
}

async function loadReminderBatch(limit: number): Promise<ReminderBackfillRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("assignment_reminders")
    .select(
      `
        id,
        user_id,
        assignment_id,
        reminder_type,
        generated_message,
        assignments!inner(assignment_name, due_date),
        user_profiles!inner(preferred_language),
        users(name)
      `
    )
    .is("generated_message", null)
    .gte("assignments.due_date", todayIsoDate())
    .order("sent_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load assignment reminders for backfill");
  }

  return ((data || []) as unknown) as ReminderBackfillRow[];
}

export async function countBackfillableTravisReminders(): Promise<number> {
  return (await loadReminderBatch(5000)).length;
}

export async function backfillTravisReminders(): Promise<BackfillResult> {
  const supabase = createSupabaseAdmin();
  const result: BackfillResult = {
    processed: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  while (true) {
    const batch = await loadReminderBatch(BATCH_SIZE);
    if (batch.length === 0) {
      return result;
    }

    for (const reminder of batch) {
      result.processed += 1;

      const assignment = reminder.assignments?.[0] || null;
      const profile = reminder.user_profiles?.[0] || null;
      const user = reminder.users?.[0] || null;

      if (reminder.generated_message || !assignment?.due_date) {
        result.skipped += 1;
        continue;
      }

      try {
        const outputLanguage = normalizeLanguage(profile?.preferred_language);
        const generatedMessage = await runTravisClaude({
          studentName: user?.name || null,
          toolName: "assignment_reminder",
          languageInstruction: buildLanguageInstruction(outputLanguage),
          structuredData: {
            reminder_type: reminder.reminder_type,
            assignment_name: assignment.assignment_name || "your assignment",
            due_date: assignment.due_date,
          },
          extraInstruction:
            "Write exactly one short reminder notification. Keep it practical, direct, and calm. Return only the reminder text. No greeting, no sign-off, no bullets. Mention the assignment naturally when useful.",
        });

        const trimmed = generatedMessage.trim();
        if (
          !trimmed ||
          trimmed.startsWith("Travis is ready.") ||
          trimmed.startsWith("I have the result ready.")
        ) {
          throw new Error("Claude reminder generation unavailable");
        }

        const { error: updateError } = await supabase
          .from("assignment_reminders")
          .update({
            generated_message: trimmed,
            generated_message_language: outputLanguage,
          })
          .eq("id", reminder.id)
          .is("generated_message", null);

        if (updateError) {
          throw new Error(updateError.message || "Failed to update reminder row");
        }

        result.generated += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push(toErrorMessage(reminder.id, error));
      }

      await delay(ROW_DELAY_MS);
    }

    if (batch.length < BATCH_SIZE) {
      return result;
    }
  }
}

export { JOB_NAME as BACKFILL_TRAVIS_REMINDERS_JOB_NAME };
