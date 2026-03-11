"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { Check, Plus, Save, X } from "lucide-react";
import AcademicErrorState from "../../shared/AcademicErrorState";
import AcademicLoadingState from "../../shared/AcademicLoadingState";
import SectionHeader from "../../shared/SectionHeader";
import StatusBadge from "../../shared/StatusBadge";
import shared from "../../shared/academic-studio.module.css";
import { WEEKDAYS } from "../hooks/travisShared";

type NewAssignmentDraft = {
  assignment_name: string;
  class_name: string;
  assignment_type: string;
  due_date: string;
  agenda_date: string;
  grading_weight: string;
};

type PlanDraft = {
  class_name: string;
  cadence: "weekly" | "custom";
  due_weekday: string;
  notes: string;
};

type ReviewDraft = {
  id: string;
  class_name: string;
  assignment_name: string;
  assignment_type: string;
  due_date: string;
  grading_weight: string;
  approved: boolean;
};

type ClassPlan = {
  class_name: string;
  cadence: "weekly" | "custom";
  due_weekday: string;
};

type TravisControlsPanelProps = {
  error: string | null;
  setError: (message: string | null) => void;
  showAddAssignmentForm: boolean;
  setShowAddAssignmentForm: Dispatch<SetStateAction<boolean>>;
  creatingAssignment: boolean;
  newAssignmentDraft: NewAssignmentDraft;
  setNewAssignmentDraft: Dispatch<SetStateAction<NewAssignmentDraft>>;
  resetNewAssignmentDraft: () => void;
  createAssignment: () => Promise<void>;
  showAccountabilityForm: boolean;
  setShowAccountabilityForm: Dispatch<SetStateAction<boolean>>;
  planDraft: PlanDraft;
  setPlanDraft: Dispatch<SetStateAction<PlanDraft>>;
  saveClassPlan: () => Promise<void>;
  classPlans: ClassPlan[];
  removeClassPlan: (className: string) => Promise<void>;
  uploading: boolean;
  handleUploadWithErrors: (file: File) => Promise<void>;
  parsedSyllabusId: string | null;
  reviewClassName: string;
  reviewDrafts: ReviewDraft[];
  setReviewDrafts: Dispatch<SetStateAction<ReviewDraft[]>>;
  publishing: boolean;
  approvedCount: number;
  publishReviewedSyllabusWithErrors: () => Promise<void>;
  onOpenReviewPage: (syllabusId: string) => void;
};

export default function TravisControlsPanel({
  error,
  setError,
  showAddAssignmentForm,
  setShowAddAssignmentForm,
  creatingAssignment,
  newAssignmentDraft,
  setNewAssignmentDraft,
  resetNewAssignmentDraft,
  createAssignment,
  showAccountabilityForm,
  setShowAccountabilityForm,
  planDraft,
  setPlanDraft,
  saveClassPlan,
  classPlans,
  removeClassPlan,
  uploading,
  handleUploadWithErrors,
  parsedSyllabusId,
  reviewClassName,
  reviewDrafts,
  setReviewDrafts,
  publishing,
  approvedCount,
  publishReviewedSyllabusWithErrors,
  onOpenReviewPage,
}: TravisControlsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <details className={`${shared.card} ${shared.cardPad}`}>
      <summary className="cursor-pointer list-none">
        <SectionHeader
          eyebrow="Controls"
          title="Actions"
          description="Add assignments, upload syllabus, and manage cadence."
          className="mb-0"
        />
      </summary>
      <div className="mt-3 space-y-2 text-sm text-slate-300">
        <button
          type="button"
          onClick={() => {
            setShowAddAssignmentForm((current) => !current);
            setError(null);
          }}
          className="academic-nested-card-interactive flex w-full items-center justify-between text-left"
        >
          Add assignment
          <Plus className="h-4 w-4 text-teal-300" />
        </button>
        {showAddAssignmentForm && (
          <div className="space-y-2 rounded-xl border border-teal-400/30 bg-teal-500/10 p-3">
            <input
              value={newAssignmentDraft.assignment_name}
              onChange={(event) =>
                setNewAssignmentDraft((current) => ({ ...current, assignment_name: event.target.value }))
              }
              className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
              placeholder="Assignment title"
            />
            <input
              value={newAssignmentDraft.class_name}
              onChange={(event) =>
                setNewAssignmentDraft((current) => ({ ...current, class_name: event.target.value }))
              }
              className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
              placeholder="Class name"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={newAssignmentDraft.assignment_type}
                onChange={(event) =>
                  setNewAssignmentDraft((current) => ({ ...current, assignment_type: event.target.value }))
                }
                className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                placeholder="Type (homework, lab, project...)"
              />
              <input
                type="date"
                value={newAssignmentDraft.due_date}
                onChange={(event) =>
                  setNewAssignmentDraft((current) => ({ ...current, due_date: event.target.value }))
                }
                className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
              />
            </div>
            <input
              type="date"
              value={newAssignmentDraft.agenda_date}
              onChange={(event) =>
                setNewAssignmentDraft((current) => ({ ...current, agenda_date: event.target.value }))
              }
              className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
            />
            <input
              value={newAssignmentDraft.grading_weight}
              onChange={(event) =>
                setNewAssignmentDraft((current) => ({ ...current, grading_weight: event.target.value }))
              }
              className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
              placeholder="Grading weight (optional, e.g. 0.2)"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void createAssignment()}
                disabled={creatingAssignment}
                className={`${shared.buttonBase} ${shared.buttonPrimary}`}
              >
                <Save className="h-3 w-3" />
                {creatingAssignment ? "Saving..." : "Save assignment"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddAssignmentForm(false);
                  resetNewAssignmentDraft();
                  setError(null);
                }}
                className={`${shared.buttonBase} ${shared.buttonSecondary}`}
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="academic-nested-card-interactive flex w-full items-center justify-between text-left"
        >
          Upload syllabus
          <Plus className="h-4 w-4 text-teal-300" />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowAccountabilityForm((current) => !current);
            setError(null);
          }}
          className="academic-nested-card-interactive flex w-full items-center justify-between text-left"
        >
          Class accountability
          <Plus className="h-4 w-4 text-teal-300" />
        </button>

        {showAccountabilityForm && (
          <div className="space-y-2 rounded-xl border border-teal-400/30 bg-teal-500/10 p-3">
            <input
              value={planDraft.class_name}
              onChange={(event) => setPlanDraft((current) => ({ ...current, class_name: event.target.value }))}
              className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
              placeholder="Class name"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={planDraft.cadence}
                onChange={(event) =>
                  setPlanDraft((current) => ({ ...current, cadence: event.target.value as "weekly" | "custom" }))
                }
                className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
              >
                <option value="weekly">Weekly cadence</option>
                <option value="custom">Custom cadence</option>
              </select>
              <select
                value={planDraft.due_weekday}
                onChange={(event) => setPlanDraft((current) => ({ ...current, due_weekday: event.target.value }))}
                className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
              >
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>Due on {day}</option>
                ))}
              </select>
            </div>
            <textarea
              value={planDraft.notes}
              onChange={(event) => setPlanDraft((current) => ({ ...current, notes: event.target.value }))}
              rows={2}
              className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
              placeholder="Example: New homework opens Monday and is due Sunday night."
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void saveClassPlan()} className={`${shared.buttonBase} ${shared.buttonPrimary}`}>
                <Save className="h-3 w-3" />
                Save plan
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAccountabilityForm(false);
                  setPlanDraft({ class_name: "", cadence: "weekly", due_weekday: "Sunday", notes: "" });
                }}
                className={`${shared.buttonBase} ${shared.buttonSecondary}`}
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {classPlans.length > 0 && (
          <div className="space-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-2">
            {classPlans.map((plan) => (
              <div
                key={plan.class_name}
                className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-200"
              >
                <span className="truncate pr-2">
                  {plan.class_name} · {plan.cadence === "weekly" ? `weekly (${plan.due_weekday})` : "custom"}
                </span>
                <button
                  type="button"
                  onClick={() => void removeClassPlan(plan.class_name)}
                  className="text-red-300 transition hover:text-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              void handleUploadWithErrors(selected);
            }
          }}
        />

        {uploading && <AcademicLoadingState message="Parsing syllabus..." className="!min-h-0 py-4" />}

        {parsedSyllabusId && (
          <div className="space-y-2 rounded-xl border border-teal-400/30 bg-teal-500/10 p-3">
            <StatusBadge status="Pending review" />
            {reviewClassName && <p className="text-xs text-teal-50/90">{reviewClassName}</p>}
            <button
              type="button"
              onClick={() => onOpenReviewPage(parsedSyllabusId)}
              className="w-full rounded-lg border border-teal-300/30 bg-teal-500/15 px-3 py-2 text-xs text-teal-100 transition hover:bg-teal-500/25"
            >
              Open full review page
            </button>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {reviewDrafts.map((draft) => (
                <div key={draft.id} className="rounded-lg border border-white/15 bg-black/20 p-2">
                  <input
                    value={draft.assignment_name}
                    onChange={(event) =>
                      setReviewDrafts((current) =>
                        current.map((row) => (row.id === draft.id ? { ...row, assignment_name: event.target.value } : row))
                      )
                    }
                    className="w-full rounded border border-white/15 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                    placeholder="Assignment name"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      value={draft.assignment_type}
                      onChange={(event) =>
                        setReviewDrafts((current) =>
                          current.map((row) => (row.id === draft.id ? { ...row, assignment_type: event.target.value } : row))
                        )
                      }
                      className="rounded border border-white/15 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                      placeholder="Type"
                    />
                    <input
                      type="date"
                      value={draft.due_date}
                      onChange={(event) =>
                        setReviewDrafts((current) =>
                          current.map((row) => (row.id === draft.id ? { ...row, due_date: event.target.value } : row))
                        )
                      }
                      className="rounded border border-white/15 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <input
                      value={draft.class_name}
                      onChange={(event) =>
                        setReviewDrafts((current) =>
                          current.map((row) => (row.id === draft.id ? { ...row, class_name: event.target.value } : row))
                        )
                      }
                      className="w-[62%] rounded border border-white/15 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                      placeholder="Class"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-teal-100">
                      <input
                        type="checkbox"
                        checked={draft.approved}
                        onChange={(event) =>
                          setReviewDrafts((current) =>
                            current.map((row) => (row.id === draft.id ? { ...row, approved: event.target.checked } : row))
                          )
                        }
                      />
                      Approve
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void publishReviewedSyllabusWithErrors()}
              disabled={publishing || reviewDrafts.length === 0}
              className="flex w-full items-center justify-between rounded-xl border border-teal-400/40 bg-teal-500/20 px-3 py-3 text-left text-xs text-teal-100 transition hover:bg-teal-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? "Publishing..." : `Approve & publish ${approvedCount} assignments`}
              <Check className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && <AcademicErrorState message={error} className="!min-h-0 border-red-500/40 bg-red-500/10 py-4" />}
      </div>
    </details>
  );
}
