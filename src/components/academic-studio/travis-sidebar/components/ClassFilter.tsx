"use client";

import { useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { AssignmentRow } from "@/types/academic-studio";
import AcademicEmptyState from "../../shared/AcademicEmptyState";
import AcademicLoadingState from "../../shared/AcademicLoadingState";
import AssignmentChecklist from "./AssignmentChecklist";
import type { ClassAccountabilityPlan } from "../hooks/travisShared";
import { addDays } from "../hooks/travisShared";

type ClassFilterProps = {
  loading: boolean;
  selectedWeekStart: Date;
  selectedWeekDayKey: string;
  upcomingAssignments: AssignmentRow[];
  filteredWeeklyAssignments: AssignmentRow[];
  unscheduledAssignments: AssignmentRow[];
  upcomingByClass: Array<[string, AssignmentRow[]]>;
  expandedClasses: Record<string, boolean>;
  classPlanByName: Record<string, ClassAccountabilityPlan>;
  editingAssignmentId: string | null;
  editingDraft: {
    assignment_name: string;
    class_name: string;
    assignment_type: string;
    due_date: string;
    agenda_date: string;
    reason: string;
  };
  setExpandedClasses: Dispatch<SetStateAction<Record<string, boolean>>>;
  setEditingDraft: Dispatch<
    SetStateAction<{
      assignment_name: string;
      class_name: string;
      assignment_type: string;
      due_date: string;
      agenda_date: string;
      reason: string;
    }>
  >;
  onSaveAssignmentEdit: (assignmentId: string) => void;
  onCancelEdit: () => void;
  onStartEdit: (assignment: AssignmentRow) => void;
  onComplete: (assignmentId: string) => void;
  onPlanToday: (assignmentId: string) => void;
  onPlanTomorrow: (assignmentId: string) => void;
  onPlanSelectedDay?: (assignmentId: string) => void;
  onClearPlan: (assignmentId: string) => void;
  onBulkPlanToday: (assignmentIds: string[]) => void;
  onBulkPlanTomorrow: (assignmentIds: string[]) => void;
  onBulkPlanWeekend: (assignmentIds: string[]) => void;
  onRemove: (assignmentId: string) => void;
  onOpenPaper: (assignmentId: string) => void;
  onOpenCoding: (assignmentId: string) => void;
  isCodingAssignment: (assignment: AssignmentRow) => boolean;
  toGuidancePreview: (assignment: AssignmentRow) => string | null;
};

export default function ClassFilter({
  loading,
  selectedWeekStart,
  selectedWeekDayKey,
  upcomingAssignments,
  filteredWeeklyAssignments,
  unscheduledAssignments,
  upcomingByClass,
  expandedClasses,
  classPlanByName,
  editingAssignmentId,
  editingDraft,
  setExpandedClasses,
  setEditingDraft,
  onSaveAssignmentEdit,
  onCancelEdit,
  onStartEdit,
  onComplete,
  onPlanToday,
  onPlanTomorrow,
  onPlanSelectedDay,
  onClearPlan,
  onBulkPlanToday,
  onBulkPlanTomorrow,
  onBulkPlanWeekend,
  onRemove,
  onOpenPaper,
  onOpenCoding,
  isCodingAssignment,
  toGuidancePreview,
}: ClassFilterProps) {
  const [planningClassName, setPlanningClassName] = useState<string>("all");

  const planningClassOptions = useMemo(() => {
    const options = Array.from(
      new Set(
        upcomingAssignments
          .map((assignment) => assignment.class_name || "Uncategorized")
          .filter(Boolean)
      )
    );
    return options.sort((a, b) => a.localeCompare(b));
  }, [upcomingAssignments]);

  const planningTargetIds = useMemo(() => {
    return upcomingAssignments
      .filter((assignment) => {
        const className = assignment.class_name || "Uncategorized";
        return planningClassName === "all" || className === planningClassName;
      })
      .map((assignment) => assignment.id);
  }, [planningClassName, upcomingAssignments]);

  const atRiskCount = useMemo(
    () => upcomingAssignments.filter((assignment) => assignment.is_at_risk).length,
    [upcomingAssignments]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
        <CalendarCheck className="h-4 w-4 text-teal-300" />
        Agenda
      </div>
      <p className="text-[11px] text-slate-500">
        Week of{" "}
        {selectedWeekStart.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}{" "}
        -{" "}
        {addDays(selectedWeekStart, 6).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          })}
      </p>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={planningClassName}
            onChange={(event) => setPlanningClassName(event.target.value)}
            className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
          >
            <option value="all">All classes</option>
            {planningClassOptions.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onBulkPlanToday(planningTargetIds)}
            disabled={planningTargetIds.length === 0}
            className="rounded-md border border-sky-300/40 bg-sky-500/15 px-2 py-1 text-[11px] text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onBulkPlanTomorrow(planningTargetIds)}
            disabled={planningTargetIds.length === 0}
            className="rounded-md border border-sky-300/40 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => onBulkPlanWeekend(planningTargetIds)}
            disabled={planningTargetIds.length === 0}
            className="rounded-md border border-indigo-300/40 bg-indigo-500/15 px-2 py-1 text-[11px] text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            This weekend
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Quick plan targets {planningTargetIds.length}{" "}
          {planningTargetIds.length === 1 ? "assignment" : "assignments"}.
        </p>
      </div>
      {atRiskCount > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          Travis: {atRiskCount === 1 ? "One thing needs your attention today." : `${atRiskCount} things need your attention today.`}
        </div>
      )}
      <div className="space-y-2 text-sm text-slate-100">
        {loading && (
          <AcademicLoadingState
            message="Loading assignments..."
            className="academic-nested-card !min-h-0 py-2"
          />
        )}
        {!loading && filteredWeeklyAssignments.length === 0 && (
          <AcademicEmptyState
            title={
              selectedWeekDayKey === "all"
                ? "No agenda items in the selected week"
                : "No agenda items on this day"
            }
            description="Ask Travis to schedule work from your unscheduled backlog."
            className="academic-nested-card !min-h-0 py-2"
          />
        )}
        {!loading &&
          upcomingByClass.map(([className, assignments]) => {
            const isExpanded = expandedClasses[className] ?? false;
            const classPlan = classPlanByName[className.toLowerCase()];
            return (
              <div key={className} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedClasses((current) => ({
                      ...current,
                      [className]: !isExpanded,
                    }))
                  }
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                >
                  <span className="text-xs font-semibold tracking-tight text-slate-200">
                    {className}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    {classPlan && (
                      <span className="rounded-full border border-teal-300/40 bg-teal-500/15 px-2 py-0.5 text-[10px] text-teal-100">
                        {classPlan.cadence === "weekly"
                          ? `Weekly · due ${classPlan.due_weekday}`
                          : "Custom cadence"}
                      </span>
                    )}
                    <span>
                      {assignments.length} {assignments.length === 1 ? "item" : "items"}{" "}
                      {isExpanded ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-2 border-t border-white/10 p-2.5">
                    {classPlan?.notes && (
                      <div className="rounded-lg border border-teal-300/30 bg-teal-500/10 px-2.5 py-1.5 text-[11px] text-teal-100">
                        {classPlan.notes}
                      </div>
                    )}
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="academic-assignment-card">
                        <AssignmentChecklist
                          assignment={assignment}
                          isEditing={editingAssignmentId === assignment.id}
                          editingDraft={editingDraft}
                          guidancePreview={toGuidancePreview(assignment)}
                          isCoding={isCodingAssignment(assignment)}
                          onDraftChange={setEditingDraft}
                          onSave={() => onSaveAssignmentEdit(assignment.id)}
                          onCancel={onCancelEdit}
                          onEdit={() => onStartEdit(assignment)}
                          onRemove={() => onRemove(assignment.id)}
                          onComplete={() => onComplete(assignment.id)}
                          onPlanToday={() => onPlanToday(assignment.id)}
                          onPlanTomorrow={() => onPlanTomorrow(assignment.id)}
                          onPlanSelectedDay={
                            onPlanSelectedDay
                              ? () => onPlanSelectedDay(assignment.id)
                              : undefined
                          }
                          onClearPlan={() => onClearPlan(assignment.id)}
                          onOpenPaper={() => onOpenPaper(assignment.id)}
                          onOpenCoding={() => onOpenCoding(assignment.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        {!loading && selectedWeekDayKey === "all" && unscheduledAssignments.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="flex w-full items-center justify-between px-3 py-2.5 text-left">
              <span className="text-xs font-semibold tracking-tight text-slate-200">
                Unscheduled backlog
              </span>
              <span className="text-[11px] text-slate-400">
                {unscheduledAssignments.length}{" "}
                {unscheduledAssignments.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="space-y-2 border-t border-white/10 p-2.5">
              {unscheduledAssignments.map((assignment) => (
                <div key={assignment.id} className="academic-assignment-card">
                  <AssignmentChecklist
                    assignment={assignment}
                    isEditing={editingAssignmentId === assignment.id}
                    editingDraft={editingDraft}
                    guidancePreview={toGuidancePreview(assignment)}
                    isCoding={isCodingAssignment(assignment)}
                    onDraftChange={setEditingDraft}
                    onSave={() => onSaveAssignmentEdit(assignment.id)}
                    onCancel={onCancelEdit}
                    onEdit={() => onStartEdit(assignment)}
                    onRemove={() => onRemove(assignment.id)}
                    onComplete={() => onComplete(assignment.id)}
                    onPlanToday={() => onPlanToday(assignment.id)}
                    onPlanTomorrow={() => onPlanTomorrow(assignment.id)}
                    onPlanSelectedDay={
                      onPlanSelectedDay
                        ? () => onPlanSelectedDay(assignment.id)
                        : undefined
                    }
                    onClearPlan={() => onClearPlan(assignment.id)}
                    onOpenPaper={() => onOpenPaper(assignment.id)}
                    onOpenCoding={() => onOpenCoding(assignment.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
