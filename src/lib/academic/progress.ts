export type TaskStatus = "pending" | "in_progress" | "complete";

export type ProgressTask = {
  status: TaskStatus;
};

export function calculateProgress(tasks: ProgressTask[]): number {
  if (tasks.length === 0) return 0;
  const complete = tasks.filter((task) => task.status === "complete").length;
  return Math.round((complete / tasks.length) * 100);
}

