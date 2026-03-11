export type ReminderType = "3_days" | "1_day" | "due_today" | "overdue" | "at_risk";

export interface AssignmentForReminder {
  id: string;
  assignment_name: string;
  class_name: string;
  due_date: string | null;
  status: string;
  completed: boolean;
  archived_at: string | null;
}

export interface ReminderCandidate {
  assignmentId: string;
  reminderType: ReminderType;
}

export function evaluateReminders(
  assignments: AssignmentForReminder[],
  today: Date
): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = [];
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  for (const assignment of assignments) {
    if (assignment.completed || assignment.archived_at) continue;
    if (!assignment.due_date) continue;

    const due = new Date(`${assignment.due_date}T00:00:00`);
    const daysUntilDue = Math.ceil(
      (due.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue < 0) {
      candidates.push({ assignmentId: assignment.id, reminderType: "overdue" });
    } else if (daysUntilDue === 0) {
      candidates.push({ assignmentId: assignment.id, reminderType: "due_today" });
    } else if (daysUntilDue === 1) {
      candidates.push({ assignmentId: assignment.id, reminderType: "1_day" });
    } else if (daysUntilDue <= 3) {
      candidates.push({ assignmentId: assignment.id, reminderType: "3_days" });
    }

    if (daysUntilDue <= 5 && daysUntilDue > 0 && ["inbox", "planned"].includes(assignment.status)) {
      candidates.push({ assignmentId: assignment.id, reminderType: "at_risk" });
    }
  }

  return candidates;
}

export function getTravisMessage(
  reminderType: ReminderType,
  assignment: Pick<AssignmentForReminder, "assignment_name" | "class_name">
): string {
  const name = assignment.assignment_name;
  const className = assignment.class_name;

  switch (reminderType) {
    case "3_days":
      return `${name} for ${className} is due in 3 days. Want to check your progress?`;
    case "1_day":
      return `${name} is due tomorrow. Let's make sure you're ready.`;
    case "due_today":
      return `${name} is due today. Check it off when you submit.`;
    case "overdue":
      return `${name} for ${className} is past its due date. You may want to update its status.`;
    case "at_risk":
      return `${name} is due soon and hasn't been started yet. Want to work on it now?`;
    default:
      return `You have an upcoming deadline for ${name}.`;
  }
}
