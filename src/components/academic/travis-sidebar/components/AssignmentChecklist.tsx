"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Code2, FileText, Pencil, Save, Trash2, X } from "lucide-react";
import type { AssignmentRow } from "@/types/academic";
import { formatDueDate } from "@/lib/academic/dueDate";

type AssignmentChecklistProps = {
  assignment: AssignmentRow;
  isEditing: boolean;
  editingDraft: {
    assignment_name: string;
    class_name: string;
    assignment_type: string;
    due_date: string;
    agenda_date: string;
    reason: string;
  };
  guidancePreview: string | null;
  isCoding: boolean;
  onDraftChange: (next: {
    assignment_name: string;
    class_name: string;
    assignment_type: string;
    due_date: string;
    agenda_date: string;
    reason: string;
  }) => void;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onComplete: () => void;
  onPlanToday: () => void;
  onPlanTomorrow: () => void;
  onPlanSelectedDay?: () => void;
  onClearPlan: () => void;
  onOpenPaper: () => void;
  onOpenCoding: () => void;
  variant?: "default" | "overdue";
};

export default function AssignmentChecklist({
  assignment,
  isEditing,
  editingDraft,
  guidancePreview,
  isCoding,
  onDraftChange,
  onSave,
  onCancel,
  onEdit,
  onRemove,
  onComplete,
  onPlanToday,
  onPlanTomorrow,
  onPlanSelectedDay,
  onClearPlan,
  onOpenPaper,
  onOpenCoding,
  variant = "default",
}: AssignmentChecklistProps) {
  const t = useTranslations("academic.travisUi.assignmentChecklist");
  const overdue = variant === "overdue";
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<
    Array<{
      id: string;
      changed_at: string;
      change_type: string;
      changed_fields?: unknown;
      reason?: string | null;
    }>
  >([]);

  const toggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    if (historyRows.length > 0) {
      setShowHistory(true);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`/api/travis/assignment/${assignment.id}/history`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.loadHistory"));
      }
      setHistoryRows(Array.isArray(data.history) ? data.history : []);
      setShowHistory(true);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : t("errors.loadHistory")
      );
      setShowHistory(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  const prepProgress = (() => {
    if (!assignment.due_date || assignment.completed) return null;
    const due = new Date(`${assignment.due_date}T00:00:00`);
    if (Number.isNaN(due.getTime())) return null;
    const start = new Date(due);
    start.setDate(start.getDate() - 6);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = 7;
    const elapsedRaw = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const elapsed = Math.max(0, Math.min(totalDays, elapsedRaw));
    return { elapsed, totalDays };
  })();

  if (isEditing) {
    return (
      <div className="space-y-2">
        <input
          value={editingDraft.assignment_name}
          onChange={(event) =>
            onDraftChange({ ...editingDraft, assignment_name: event.target.value })
          }
          className={`w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs focus:outline-none ${
            overdue ? "text-red-50 focus:border-red-300" : "text-slate-100 focus:border-teal-300"
          }`}
          placeholder={t("placeholders.assignmentName")}
        />
        <input
          value={editingDraft.class_name}
          onChange={(event) =>
            onDraftChange({ ...editingDraft, class_name: event.target.value })
          }
          className={`w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs focus:outline-none ${
            overdue ? "text-red-50 focus:border-red-300" : "text-slate-100 focus:border-teal-300"
          }`}
          placeholder={t("placeholders.class")}
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            value={editingDraft.assignment_type}
            onChange={(event) =>
              onDraftChange({ ...editingDraft, assignment_type: event.target.value })
            }
            className={`rounded border border-white/20 bg-black/25 px-2 py-1 text-xs focus:outline-none ${
              overdue ? "text-red-50 focus:border-red-300" : "text-slate-100 focus:border-teal-300"
            }`}
            placeholder={t("placeholders.type")}
          />
          <input
            type="date"
            value={editingDraft.due_date}
            onChange={(event) => onDraftChange({ ...editingDraft, due_date: event.target.value })}
            className={`rounded border border-white/20 bg-black/25 px-2 py-1 text-xs focus:outline-none ${
              overdue ? "text-red-50 focus:border-red-300" : "text-slate-100 focus:border-teal-300"
            }`}
          />
          <input
            type="date"
            value={editingDraft.agenda_date}
            onChange={(event) =>
              onDraftChange({ ...editingDraft, agenda_date: event.target.value })
            }
            className={`rounded border border-white/20 bg-black/25 px-2 py-1 text-xs focus:outline-none ${
              overdue ? "text-red-50 focus:border-red-300" : "text-slate-100 focus:border-teal-300"
            }`}
          />
        </div>
        <input
          value={editingDraft.reason}
          onChange={(event) => onDraftChange({ ...editingDraft, reason: event.target.value })}
          className={`w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs focus:outline-none ${
            overdue ? "text-red-50 focus:border-red-300" : "text-slate-100 focus:border-teal-300"
          }`}
          placeholder={t("placeholders.reason")}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
              overdue
                ? "border-red-200/40 bg-red-500/20 text-red-50 hover:bg-red-500/30"
                : "border-teal-300/40 bg-teal-500/20 text-teal-100 hover:bg-teal-500/30"
            }`}
          >
            <Save className="h-3 w-3" />
            {t("save")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
              overdue
                ? "border-red-200/30 bg-black/20 text-red-100/90 hover:bg-black/35"
                : "border-white/20 bg-black/20 text-slate-200 hover:bg-black/35"
            }`}
          >
            <X className="h-3 w-3" />
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm font-semibold">{assignment.assignment_name}</p>
      <p className={`text-xs ${overdue ? "text-red-100/80" : "text-slate-400"}`}>
        {assignment.class_name}
      </p>
      <p className={`mt-1 text-xs ${overdue ? "text-red-100/70" : "text-slate-500"}`}>
        {t("due")}: {formatDueDate(assignment.due_date)}
      </p>
      {assignment.status && (
        <p className={`mt-1 text-xs ${overdue ? "text-red-100/80" : "text-slate-400"}`}>
          {t("status")}: {assignment.status.replaceAll("_", " ")}
        </p>
      )}
      {assignment.agenda_date && (
        <p className={`mt-1 text-xs ${overdue ? "text-red-100/80" : "text-slate-400"}`}>
          {t("planned")}: {formatDueDate(assignment.agenda_date)}
        </p>
      )}
      {typeof assignment.progress_percent === "number" && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-teal-300/80"
              style={{ width: `${Math.max(0, Math.min(100, assignment.progress_percent))}%` }}
            />
          </div>
          <p className={`mt-1 text-[11px] ${overdue ? "text-red-100/80" : "text-slate-400"}`}>
            {t("progress")}: {assignment.progress_percent}%
          </p>
        </div>
      )}
      {assignment.is_at_risk && (
        <p className="mt-1 text-xs text-amber-200">{t("atRisk")}</p>
      )}
      {prepProgress && (
        <p className={`mt-1 text-xs ${overdue ? "text-red-100/80" : "text-slate-400"}`}>
          {t("prepProgress", { day: prepProgress.elapsed, total: prepProgress.totalDays })}
        </p>
      )}
      {guidancePreview && (
        <p className={`mt-1 text-xs ${overdue ? "text-red-100/80" : "text-slate-400"}`}>
          {guidancePreview}
        </p>
      )}
      {assignment.assignment_type === "paper" && (
        <button
          type="button"
          onClick={onOpenPaper}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-500/15 px-3 py-1 text-xs text-teal-200 transition hover:bg-teal-500/25"
        >
          <FileText className="h-3 w-3" />
          {t("startPaper")}
        </button>
      )}
      {isCoding && assignment.assignment_type !== "paper" && (
        <button
          type="button"
          onClick={onOpenCoding}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs text-amber-100 transition hover:bg-amber-500/25"
        >
          <Code2 className="h-3 w-3" />
          {t("openCodingReview")}
        </button>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onComplete}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
            overdue
              ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
              : "border-emerald-300/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
          }`}
        >
          <Check className="h-3 w-3" />
          {t("complete")}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
            overdue
              ? "border-red-200/40 bg-red-500/15 text-red-100 hover:bg-red-500/25"
              : "border-teal-300/40 bg-teal-500/15 text-teal-100 hover:bg-teal-500/25"
          }`}
        >
          <Pencil className="h-3 w-3" />
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
            overdue
              ? "border-red-200/40 bg-red-900/25 text-red-100 hover:bg-red-900/40"
              : "border-red-300/40 bg-red-500/15 text-red-100 hover:bg-red-500/25"
          }`}
        >
          <Trash2 className="h-3 w-3" />
          {t("remove")}
        </button>
        <button
          type="button"
          onClick={onPlanToday}
          className="inline-flex items-center gap-1 rounded-md border border-sky-300/40 bg-sky-500/15 px-2 py-1 text-[11px] text-sky-100 transition hover:bg-sky-500/25"
        >
          {t("planToday")}
        </button>
        <button
          type="button"
          onClick={onPlanTomorrow}
          className="inline-flex items-center gap-1 rounded-md border border-sky-300/40 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-100 transition hover:bg-sky-500/20"
        >
          {t("planTomorrow")}
        </button>
        {onPlanSelectedDay && (
          <button
            type="button"
            onClick={onPlanSelectedDay}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-300/40 bg-indigo-500/15 px-2 py-1 text-[11px] text-indigo-100 transition hover:bg-indigo-500/25"
          >
            {t("moveToSelectedDay")}
          </button>
        )}
        <button
          type="button"
          onClick={onClearPlan}
          className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/20 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-black/35"
        >
          {t("clearPlan")}
        </button>
        <button
          type="button"
          onClick={() => void toggleHistory()}
          className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/20 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-black/35"
        >
          {showHistory ? t("hideHistory") : t("viewHistory")}
        </button>
      </div>
      {showHistory && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] text-slate-300">
          {historyLoading && <p>{t("loadingHistory")}</p>}
          {historyError && <p className="text-red-300">{historyError}</p>}
          {!historyLoading && !historyError && historyRows.length === 0 && (
            <p>{t("noRecentHistory")}</p>
          )}
          {!historyLoading && !historyError && historyRows.length > 0 && (
            <div className="space-y-1">
              {historyRows.map((row) => (
                <p key={row.id}>
                  {row.change_type}
                  {row.changed_fields
                    ? ` · ${Array.isArray(row.changed_fields) ? row.changed_fields.join(", ") : JSON.stringify(row.changed_fields)}`
                    : ""}
                  {row.reason ? ` · ${row.reason}` : ""}
                  {` · ${new Date(row.changed_at).toLocaleString()}`}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
