"use client";

import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle } from "lucide-react";
import type { AssignmentRow } from "@/types/academic-studio";
import AssignmentChecklist from "./AssignmentChecklist";
import { isCodingAssignment, toGuidancePreview } from "../hooks/travisShared";

type EditingDraft = {
  assignment_name: string;
  class_name: string;
  assignment_type: string;
  due_date: string;
  agenda_date: string;
  reason: string;
};

type OverdueAssignmentsPanelProps = {
  overdueAssignments: AssignmentRow[];
  editingAssignmentId: string | null;
  editingDraft: EditingDraft;
  selectedWeekDayKey: string;
  setEditingDraft: Dispatch<SetStateAction<EditingDraft>>;
  saveAssignmentEdit: (assignmentId: string) => Promise<void>;
  cancelEditingAssignment: () => void;
  startEditingAssignment: (assignment: AssignmentRow) => void;
  removeAssignment: (assignmentId: string) => Promise<void>;
  markAssignmentComplete: (assignmentId: string) => Promise<void>;
  planAssignmentToday: (assignmentId: string) => Promise<void>;
  planAssignmentTomorrow: (assignmentId: string) => Promise<void>;
  planAssignmentOnSelectedDay: (assignmentId: string) => Promise<void>;
  clearAssignmentPlanDate: (assignmentId: string) => Promise<void>;
  onOpenPaper: (assignmentId: string) => void;
  onOpenCoding: (assignmentId: string) => void;
};

export default function OverdueAssignmentsPanel({
  overdueAssignments,
  editingAssignmentId,
  editingDraft,
  selectedWeekDayKey,
  setEditingDraft,
  saveAssignmentEdit,
  cancelEditingAssignment,
  startEditingAssignment,
  removeAssignment,
  markAssignmentComplete,
  planAssignmentToday,
  planAssignmentTomorrow,
  planAssignmentOnSelectedDay,
  clearAssignmentPlanDate,
  onOpenPaper,
  onOpenCoding,
}: OverdueAssignmentsPanelProps) {
  if (overdueAssignments.length === 0) return null;

  return (
    <details className="rounded-xl border border-red-500/30 bg-red-500/8 p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-red-200">
        <AlertTriangle className="h-4 w-4" />
        Overdue ({overdueAssignments.length})
      </summary>
      <div className="mt-3 space-y-2 text-sm text-slate-100">
        {overdueAssignments.map((assignment) => (
          <div key={assignment.id} className="academic-assignment-card-overdue rounded-lg px-3 py-3">
            <AssignmentChecklist
              assignment={assignment}
              isEditing={editingAssignmentId === assignment.id}
              editingDraft={editingDraft}
              guidancePreview={toGuidancePreview(assignment)}
              isCoding={isCodingAssignment(assignment)}
              variant="overdue"
              onDraftChange={setEditingDraft}
              onSave={() => saveAssignmentEdit(assignment.id)}
              onCancel={cancelEditingAssignment}
              onEdit={() => startEditingAssignment(assignment)}
              onRemove={() => removeAssignment(assignment.id)}
              onComplete={() => markAssignmentComplete(assignment.id)}
              onPlanToday={() => planAssignmentToday(assignment.id)}
              onPlanTomorrow={() => planAssignmentTomorrow(assignment.id)}
              onPlanSelectedDay={
                selectedWeekDayKey === "all" ? undefined : () => planAssignmentOnSelectedDay(assignment.id)
              }
              onClearPlan={() => clearAssignmentPlanDate(assignment.id)}
              onOpenPaper={() => onOpenPaper(assignment.id)}
              onOpenCoding={() => onOpenCoding(assignment.id)}
            />
          </div>
        ))}
      </div>
    </details>
  );
}
