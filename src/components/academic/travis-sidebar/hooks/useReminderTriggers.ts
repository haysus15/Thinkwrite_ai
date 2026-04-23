"use client";

import { useCallback, useState } from "react";

export type ReminderRecord = {
  id: string;
  assignment_id: string;
  reminder_type: "3_days" | "1_day" | "due_today" | "overdue" | "at_risk";
  dismissed: boolean;
  created_at?: string;
};

export function useReminderTriggers() {
  const [activeReminders, setActiveReminders] = useState<ReminderRecord[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(new Set());

  const runReminderEvaluation = useCallback(async () => {
    try {
      await fetch("/api/travis/reminders/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Best effort only.
    }
  }, []);

  const loadActiveReminders = useCallback(async () => {
    setRemindersLoading(true);
    try {
      const response = await fetch("/api/travis/reminders/active", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load reminders.");
      }
      const reminders = Array.isArray(data?.reminders) ? data.reminders : [];
      const filtered = (reminders as ReminderRecord[]).filter(
        (row) => !sessionDismissed.has(row.assignment_id)
      );
      setActiveReminders(filtered);
    } catch {
      setActiveReminders([]);
    } finally {
      setRemindersLoading(false);
    }
  }, [sessionDismissed]);

  const dismissReminder = useCallback(
    async (assignmentId: string, reminderType: ReminderRecord["reminder_type"]) => {
      await fetch("/api/travis/reminders/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, reminderType }),
      });

      setActiveReminders((current) =>
        current.filter(
          (row) =>
            !(row.assignment_id === assignmentId && row.reminder_type === reminderType)
        )
      );
      setSessionDismissed((current) => {
        const next = new Set(current);
        next.add(assignmentId);
        return next;
      });
    },
    []
  );

  return {
    activeReminders,
    remindersLoading,
    runReminderEvaluation,
    loadActiveReminders,
    dismissReminder,
    sessionDismissed,
  };
}
