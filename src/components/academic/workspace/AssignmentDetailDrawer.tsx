import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./assignmentsWorkspaceTypes";
import type {
  AssignmentListRow,
  AssignmentStatus,
  ChangeHistoryRow,
  DetailDraft,
  Priority,
} from "./assignmentsWorkspaceTypes";
import { titleCaseStatus } from "./assignmentsWorkspaceUtils";

type AssignmentDetailDrawerProps = {
  selectedAssignment: AssignmentListRow | null;
  detailDraft: DetailDraft;
  setDetailDraft: Dispatch<SetStateAction<DetailDraft>>;
  detailSaving: boolean;
  saveDetailPanel: () => Promise<void>;
  taskUpdatingId: string | null;
  updateTaskStatus: (
    assignmentId: string,
    taskId: string,
    current: "pending" | "in_progress" | "complete"
  ) => Promise<void>;
  historyLoading: boolean;
  historyRows: ChangeHistoryRow[];
  onClose: () => void;
  goPlanInAgenda: (assignmentId: string, options?: { autoPlan?: boolean; prompt?: string }) => void;
};

export default function AssignmentDetailDrawer({
  selectedAssignment,
  detailDraft,
  setDetailDraft,
  detailSaving,
  saveDetailPanel,
  taskUpdatingId,
  updateTaskStatus,
  historyLoading,
  historyRows,
  onClose,
  goPlanInAgenda,
}: AssignmentDetailDrawerProps) {
  const t = useTranslations("academic.workspace.detailDrawer");
  const router = useRouter();

  if (!selectedAssignment) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-slate-950 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">{selectedAssignment.assignment_name}</p>
            <p className="mt-1 text-xs text-slate-400">{selectedAssignment.class_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300"
          >
            {t("close")}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{t("details")}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <input
                value={detailDraft.assignment_name}
                onChange={(event) =>
                  setDetailDraft((current) => ({
                    ...current,
                    assignment_name: event.target.value,
                  }))
                }
                className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
                placeholder={t("placeholders.assignmentName")}
              />
              <input
                value={detailDraft.class_name}
                onChange={(event) =>
                  setDetailDraft((current) => ({
                    ...current,
                    class_name: event.target.value,
                  }))
                }
                className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
                placeholder={t("placeholders.className")}
              />
              <input
                value={detailDraft.assignment_type}
                onChange={(event) =>
                  setDetailDraft((current) => ({
                    ...current,
                    assignment_type: event.target.value,
                  }))
                }
                className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
                placeholder={t("placeholders.type")}
              />
              <input
                type="date"
                value={detailDraft.due_date}
                onChange={(event) =>
                  setDetailDraft((current) => ({
                    ...current,
                    due_date: event.target.value,
                  }))
                }
                className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
              />
              <select
                value={detailDraft.priority}
                onChange={(event) =>
                  setDetailDraft((current) => ({
                    ...current,
                    priority: event.target.value as Priority,
                  }))
                }
                className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleCaseStatus(option)}
                  </option>
                ))}
              </select>
              <select
                value={detailDraft.status}
                onChange={(event) =>
                  setDetailDraft((current) => ({
                    ...current,
                    status: event.target.value as AssignmentStatus,
                  }))
                }
                className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleCaseStatus(option)}
                  </option>
                ))}
              </select>
              <input
                value={detailDraft.grading_weight}
                onChange={(event) =>
                  setDetailDraft((current) => ({
                    ...current,
                    grading_weight: event.target.value,
                  }))
                }
                className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
                placeholder={t("placeholders.gradingWeight")}
              />
              <textarea
                value={detailDraft.notes}
                onChange={(event) =>
                  setDetailDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-slate-100 md:col-span-2"
                rows={3}
                placeholder={t("placeholders.notes")}
              />
            </div>
            <button
              type="button"
              disabled={detailSaving}
              onClick={() => void saveDetailPanel()}
              className="mt-2 rounded border border-sky-300/35 bg-sky-500/15 px-2.5 py-1.5 text-xs text-sky-100"
            >
              {detailSaving ? t("saving") : t("saveDetails")}
            </button>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{t("tasks")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(selectedAssignment.tasks || selectedAssignment.assignment_tasks || []).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  disabled={taskUpdatingId === task.id}
                  onClick={() => void updateTaskStatus(selectedAssignment.id, task.id, task.status)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    task.status === "complete"
                      ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100"
                      : task.status === "in_progress"
                        ? "border-amber-300/35 bg-amber-500/15 text-amber-100"
                        : "border-white/15 bg-white/5 text-slate-300"
                  }`}
                >
                  {task.task_type}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{t("changeHistory")}</p>
            {historyLoading ? (
              <p className="mt-2 text-xs text-slate-400">{t("loadingHistory")}</p>
            ) : historyRows.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">{t("noRecentChanges")}</p>
            ) : (
              <div className="mt-2 space-y-1">
                {historyRows.map((row) => {
                  const oldStatus = typeof row.old_data?.status === "string" ? row.old_data.status : null;
                  const newStatus = typeof row.new_data?.status === "string" ? row.new_data.status : null;
                  return (
                    <p key={row.id} className="text-xs text-slate-300">
                      {oldStatus && newStatus
                        ? t("statusChanged", {
                            oldStatus: titleCaseStatus(oldStatus),
                            newStatus: titleCaseStatus(newStatus),
                          })
                        : row.change_type}
                      {" · "}
                      {new Date(row.changed_at).toLocaleString()}
                    </p>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            {selectedAssignment.syllabus_id ? (
              <button
                type="button"
                onClick={() => router.push(`/academic/syllabi?syllabus=${selectedAssignment.syllabus_id}`)}
                className="rounded-full border border-sky-300/35 bg-sky-500/15 px-3 py-1 text-xs text-sky-100"
              >
                {t("fromSyllabus", { className: selectedAssignment.class_name })}
              </button>
            ) : (
              <p className="text-xs text-slate-400">{t("addedManually")}</p>
            )}
            <button
              type="button"
              onClick={() =>
                goPlanInAgenda(selectedAssignment.id, {
                  prompt: `Help me plan "${selectedAssignment.assignment_name}" for ${selectedAssignment.class_name}.`,
                })
              }
              className="mt-2 block text-xs text-sky-300 underline underline-offset-2"
            >
              {t("openInAgenda")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
