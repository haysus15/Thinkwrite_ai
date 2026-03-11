import type { AssignmentRow } from "@/types/academic-studio";

export type AgendaContextSummary = {
  items: AssignmentRow[];
  currentDate: Date;
};

function daysUntil(date: string | null | undefined, currentDate: Date): string {
  if (!date) return "no due date";
  const due = new Date(`${date}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "invalid due date";
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return "due today";
  if (diffDays === 1) return "due in 1 day";
  return `due in ${diffDays} days`;
}

function trimToApproxTokens(text: string, tokenCap = 800): string {
  const approxChars = tokenCap * 4;
  if (text.length <= approxChars) return text;
  return `${text.slice(0, approxChars)}\n...`;
}

export function buildAgendaContext(context: AgendaContextSummary): string {
  const header = `CURRENT DATE: ${context.currentDate.toISOString().slice(0, 10)}\nASSIGNMENTS:`;

  const lines = context.items.slice(0, 120).map((item) => {
    const tasks = item.tasks || item.assignment_tasks || [];
    const complete = tasks.filter((task) => task.status === "complete").length;
    const total = tasks.length;
    const atRisk = item.is_at_risk ? " [AT RISK]" : "";
    const due = item.due_date || "no due date";
    const dueStatus = daysUntil(item.due_date, context.currentDate);

    return `- ${item.assignment_name} (${item.class_name}) — due ${due} (${dueStatus}) — status: ${item.status || "inbox"} — priority: ${item.priority || "none"}${atRisk}\n  Tasks: ${complete} complete / ${total} total`;
  });

  return trimToApproxTokens([header, ...lines].join("\n"));
}
