import { calculateProgress } from "@/lib/academic/progress";
import shared from "../shared/academic.module.css";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./assignmentsWorkspaceTypes";
import type { AssignmentListRow, AssignmentStatus, Priority } from "./assignmentsWorkspaceTypes";
import { dueLabel, daysUntilDue, priorityBorder, titleCaseStatus } from "./assignmentsWorkspaceUtils";

type AssignmentGroup = {
  key: string;
  rows: AssignmentListRow[];
};

type AssignmentsGroupsListProps = {
  groups: AssignmentGroup[];
  selectedIds: string[];
  updatingId: string | null;
  menuOpenForId: string | null;
  setMenuOpenForId: (id: string | null) => void;
  toggleSelect: (assignmentId: string) => void;
  openDetail: (assignmentId: string) => Promise<void>;
  updateAssignment: (
    assignmentId: string,
    payload: Partial<{ status: AssignmentStatus; priority: Priority }>
  ) => Promise<void>;
  archiveSingle: (assignmentId: string) => Promise<void>;
  goPlanInAgenda: (assignmentId: string, options?: { autoPlan?: boolean; prompt?: string }) => void;
};

export default function AssignmentsGroupsList({
  groups,
  selectedIds,
  updatingId,
  menuOpenForId,
  setMenuOpenForId,
  toggleSelect,
  openDetail,
  updateAssignment,
  archiveSingle,
  goPlanInAgenda,
}: AssignmentsGroupsListProps) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{group.key}</p>
          <div className="space-y-3">
            {group.rows
              .slice()
              .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
              .map((row) => {
                const tasks = row.tasks || row.assignment_tasks || [];
                const progress =
                  typeof row.progress_percent === "number"
                    ? row.progress_percent
                    : calculateProgress(tasks.map((task) => ({ status: task.status })));
                const dueDays =
                  typeof row.days_until_due === "number"
                    ? row.days_until_due
                    : daysUntilDue(row.due_date);
                const status = (row.status || (row.completed ? "completed" : "inbox")) as AssignmentStatus;
                const priority = (row.priority || "medium") as Priority;

                return (
                  <div
                    key={row.id}
                    className={`${shared.surfacePanelCompact} border-l-4 ${priorityBorder(priority)}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleSelect(row.id)}
                          className="h-3.5 w-3.5 rounded border-white/20 bg-black/30"
                        />
                        Select
                      </label>
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => void openDetail(row.id)}
                          className="text-left text-sm font-semibold text-slate-100 underline-offset-2 hover:underline"
                        >
                          {row.assignment_name}
                        </button>
                        <p className="mt-1 text-xs text-slate-400">
                          {row.class_name} · Due {row.due_date || "TBD"} · {dueLabel(dueDays)}
                          {typeof row.grading_weight === "number"
                            ? ` · ${Math.round(row.grading_weight * 100)}%`
                            : ""}
                        </p>
                        {typeof dueDays === "number" && dueDays < 0 ? (
                          <p className="mt-1 text-xs text-amber-200">
                            {Math.abs(dueDays)} day{Math.abs(dueDays) === 1 ? "" : "s"} overdue
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={status}
                          disabled={updatingId === row.id}
                          onChange={(event) =>
                            void updateAssignment(row.id, {
                              status: event.target.value as AssignmentStatus,
                            })
                          }
                          className="rounded-md border border-white/20 bg-black/30 px-2 py-1 text-xs text-slate-100"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {titleCaseStatus(option)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={priority}
                          disabled={updatingId === row.id}
                          onChange={(event) =>
                            void updateAssignment(row.id, {
                              priority: event.target.value as Priority,
                            })
                          }
                          className="rounded-md border border-white/20 bg-black/30 px-2 py-1 text-xs text-slate-100"
                        >
                          {PRIORITY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {titleCaseStatus(option)}
                            </option>
                          ))}
                        </select>
                        <details
                          open={menuOpenForId === row.id}
                          onToggle={(event) =>
                            setMenuOpenForId(
                              (event.currentTarget as HTMLDetailsElement).open ? row.id : null
                            )
                          }
                          className="relative"
                        >
                          <summary className="cursor-pointer list-none rounded-md border border-white/20 bg-black/30 px-2 py-1 text-xs text-slate-200">
                            ···
                          </summary>
                          <div className="absolute right-0 z-20 mt-1 min-w-[130px] rounded-lg border border-white/15 bg-slate-900/95 p-1 text-xs text-slate-200 shadow-xl">
                            <button
                              type="button"
                              onClick={() => {
                                void openDetail(row.id);
                                setMenuOpenForId(null);
                              }}
                              className="block w-full rounded px-2 py-1 text-left hover:bg-white/10"
                            >
                              View history
                            </button>
                            <button
                              type="button"
                              onClick={() => void archiveSingle(row.id)}
                              className="block w-full rounded px-2 py-1 text-left text-red-200 hover:bg-red-500/20"
                            >
                              Archive
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-black/30">
                        <div className="h-2 rounded-full bg-sky-400/70" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => goPlanInAgenda(row.id, { autoPlan: true })}
                        className="rounded-md border border-sky-300/35 bg-sky-500/15 px-2.5 py-1.5 text-xs text-sky-100"
                      >
                        Plan in Agenda
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          goPlanInAgenda(row.id, {
                            prompt: `Help me plan "${row.assignment_name}" for ${row.class_name}.`,
                          })
                        }
                        className={`${shared.buttonBase} ${shared.buttonSecondary}`}
                      >
                        Ask Travis
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
