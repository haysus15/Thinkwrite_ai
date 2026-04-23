import type { AssignmentRow } from "@/types/academic";

export type TaskStatus = "pending" | "in_progress" | "complete";
export type ViewMode = "day" | "week";

export type ChangeDigest = {
  statusChanged: Array<{
    id: string;
    assignment_id: string;
    changed_at: string;
    old_data?: { status?: string };
    new_data?: { status?: string };
    assignments?: { assignment_name?: string } | null;
  }>;
  completedTasks: Array<{
    id: string;
    completed_at: string;
    label: string | null;
    task_type: string;
    assignments?: { assignment_name?: string } | null;
  }>;
  newAssignments: Array<{
    id: string;
    assignment_name: string;
    created_at: string;
  }>;
};

export type QuickAddDraft = {
  class_name: string;
  assignment_name: string;
  due_date: string;
  assignment_type: string;
};

export type AgendaLeftColumnProps = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedWeekDayKey: string;
  setSelectedWeekDayKey: (value: string) => void;
  todayDateKey: string;
  weeklyUpcomingAssignments: AssignmentRow[];
  weeklyClassCount: number;
  overdueAssignments: AssignmentRow[];
  visibleMonthStart: Date;
  canGoPrevMonth: boolean;
  canGoNextMonth: boolean;
  goToMonth: (offset: number) => void;
  selectedWeekStart: Date;
  jumpToToday: () => void;
  monthGridDays: Date[];
  calendarSignalByDate: Record<string, "overdue" | "due_today" | "planned">;
  weekCalendarDays: Date[];
  setSelectedWeekStart: (day: Date) => void;
  canGoPrevWeek: boolean;
  canGoNextWeek: boolean;
  goToWeek: (offset: number) => void;
  atRiskCount: number;
  showChangesDigest: boolean;
  setShowChangesDigest: (next: boolean) => void;
  digestLoading: boolean;
  changeDigest: ChangeDigest;
  focusManyIds: string[];
  clearFocusMany: () => void;
  error: string | null;
  loading: boolean;
  groupedWeekItems: Array<{ key: string; assignments: AssignmentRow[] }>;
  agendaItemsForDisplay: AssignmentRow[];
  taskSavingId: string | null;
  statusSavingId: string | null;
  onTaskToggle: (assignmentId: string, taskId: string, currentStatus: TaskStatus) => void;
  onStatusUpdate: (
    assignmentId: string,
    status: "inbox" | "planned" | "in_progress" | "ready_to_submit" | "submitted" | "completed"
  ) => void;
  onAskTravis: (prompt: string) => void;
  showQuickAdd: boolean;
  setShowQuickAdd: (next: boolean) => void;
  quickAddDraft: QuickAddDraft;
  setQuickAddDraft: (next: QuickAddDraft) => void;
  creating: boolean;
  createQuickAssignment: () => void;
};

export type AgendaRightColumnProps = {
  atRiskCount: number;
  plannedThisWeekCount: number;
  tasksDueTodayCount: number;
  travisChatMessages: Array<{
    id: string;
    role: "user" | "travis" | "system";
    text: string;
  }>;
  pendingTravisAction: {
    type: string;
    summary: string;
    assignmentIds: string[];
  } | null;
  travisChatInput: string;
  setTravisChatInput: (value: string) => void;
  travisChatLoading: boolean;
  sendTravisMessage: (
    message: string,
    options?: {
      assignmentId?: string;
      confirm?: boolean;
      reject?: boolean;
      systemMessage?: boolean;
    }
  ) => Promise<void>;
  confirmPendingTravisAction: () => Promise<void>;
  rejectPendingTravisAction: () => void;
  nextBestAction: {
    label: string;
    rationale: string;
    toolTrigger: string | null;
    assignmentId: string | null;
  } | null;
};
