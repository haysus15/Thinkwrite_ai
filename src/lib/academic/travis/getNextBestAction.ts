import type { AssignmentRow } from "@/types/academic-studio";

export type NextBestAction = {
  label: string;
  rationale: string;
  toolTrigger: string | null;
  assignmentId: string | null;
};

type AgendaItem = AssignmentRow;

function daysUntilDue(dueDate: string | null, currentDate: Date): number {
  if (!dueDate) return Number.POSITIVE_INFINITY;
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function incompleteTaskCount(item: AgendaItem): number {
  const tasks = item.tasks || item.assignment_tasks || [];
  return tasks.filter((task) => task.status !== "complete").length;
}

export async function getNextBestAction(
  agendaItems: AgendaItem[],
  currentDate: Date
): Promise<NextBestAction | null> {
  const active = agendaItems.filter(
    (item) => item.status !== "submitted" && item.status !== "completed"
  );

  const overdue = active.find((item) => daysUntilDue(item.due_date, currentDate) < 0);
  if (overdue) {
    return {
      label: `Submit or update ${overdue.assignment_name}`,
      rationale: "It is past due and still marked active.",
      toolTrigger: null,
      assignmentId: overdue.id,
    };
  }

  const dueToday = active.find(
    (item) => daysUntilDue(item.due_date, currentDate) === 0 && incompleteTaskCount(item) > 0
  );
  if (dueToday) {
    return {
      label: `Complete remaining tasks for ${dueToday.assignment_name}`,
      rationale: "It is due today and still has incomplete tasks.",
      toolTrigger: null,
      assignmentId: dueToday.id,
    };
  }

  const atRiskNoTasks = active.find(
    (item) => Boolean(item.is_at_risk) && incompleteTaskCount(item) === 0
  );
  if (atRiskNoTasks) {
    return {
      label: `Ask Travis to plan ${atRiskNoTasks.assignment_name}`,
      rationale: "It is at risk and has no task plan started.",
      toolTrigger: "plan-assignment",
      assignmentId: atRiskNoTasks.id,
    };
  }

  const inProgressPending = active.find(
    (item) => item.status === "in_progress" && incompleteTaskCount(item) > 0
  );
  if (inProgressPending) {
    const nextTask = (inProgressPending.tasks || inProgressPending.assignment_tasks || []).find(
      (task) => task.status !== "complete"
    );
    return {
      label: `Continue ${nextTask?.label || "next task"} for ${inProgressPending.assignment_name}`,
      rationale: "You already started this assignment and still have pending tasks.",
      toolTrigger: null,
      assignmentId: inProgressPending.id,
    };
  }

  const plannedNoTasks = active.find(
    (item) => item.status === "planned" && incompleteTaskCount(item) === 0
  );
  if (plannedNoTasks) {
    return {
      label: `Start working on ${plannedNoTasks.assignment_name}`,
      rationale: "It is planned but has no started tasks this week.",
      toolTrigger: "plan-assignment",
      assignmentId: plannedNoTasks.id,
    };
  }

  return null;
}
