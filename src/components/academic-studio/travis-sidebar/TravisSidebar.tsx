// src/components/academic-studio/travis-sidebar/TravisSidebar.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarCheck,
  ListChecks,
  Plus,
  FileText,
  Code2,
  Check,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { AssignmentRow } from "@/types/academic-studio";

const CODING_TYPES = new Set(["lab", "project", "homework"]);
const CODING_KEYWORDS = [
  "code",
  "coding",
  "programming",
  "python",
  "javascript",
  "sql",
  "algorithm",
  "data structure",
  "database",
  "query",
  "function",
  "class",
  "loop",
  "debug",
  "compile",
];

type SyllabusDraftRow = {
  id: string;
  class_name: string;
  assignment_name: string;
  assignment_type: string | null;
  due_date: string | null;
  requirements: Record<string, unknown> | null;
  grading_weight: number | null;
  draft_status: "parsed" | "edited" | "approved" | "rejected" | "published";
};

type DraftReviewRow = {
  id: string;
  class_name: string;
  assignment_name: string;
  assignment_type: string;
  due_date: string;
  grading_weight: string;
  approved: boolean;
};

type ClassAccountabilityPlan = {
  class_name: string;
  cadence: "weekly" | "custom";
  due_weekday: string;
  notes: string;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const ACCOUNTABILITY_STORAGE_KEY = "travis_class_accountability_v1";
const CALENDAR_YEAR = 2026;

const toLocalDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, count: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
};

const startOfWeek = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  return next;
};

const isCodingAssignment = (assignment: AssignmentRow) => {
  const type = (assignment.assignment_type || "").toLowerCase();
  if (!CODING_TYPES.has(type)) return false;

  const haystack = [
    assignment.assignment_name,
    assignment.class_name,
    JSON.stringify(assignment.requirements || {}),
  ]
    .join(" ")
    .toLowerCase();

  return CODING_KEYWORDS.some((kw) => haystack.includes(kw));
};

const toGuidancePreview = (assignment: AssignmentRow) => {
  const instructions =
    typeof assignment.requirements?.instructions === "string"
      ? assignment.requirements.instructions.trim()
      : "";
  const guidelines =
    typeof assignment.requirements?.guidelines === "string"
      ? assignment.requirements.guidelines.trim()
      : "";
  const notes = typeof assignment.notes === "string" ? assignment.notes.trim() : "";

  const text = [instructions, guidelines, notes].filter(Boolean).join(" ");
  if (!text) return null;
  if (text.length <= 180) return text;
  return `${text.slice(0, 177)}...`;
};

export default function TravisSidebar() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [upcomingAssignments, setUpcomingAssignments] = useState<
    AssignmentRow[]
  >([]);
  const [overdueAssignments, setOverdueAssignments] = useState<AssignmentRow[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedSyllabusId, setParsedSyllabusId] = useState<string | null>(null);
  const [reviewClassName, setReviewClassName] = useState<string>("");
  const [reviewDrafts, setReviewDrafts] = useState<DraftReviewRow[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [expandedClasses, setExpandedClasses] = useState<
    Record<string, boolean>
  >({});
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(
    null
  );
  const [editingDraft, setEditingDraft] = useState({
    assignment_name: "",
    class_name: "",
    assignment_type: "",
    due_date: "",
  });
  const [showAddAssignmentForm, setShowAddAssignmentForm] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [newAssignmentDraft, setNewAssignmentDraft] = useState({
    assignment_name: "",
    class_name: "",
    assignment_type: "",
    due_date: "",
    grading_weight: "",
  });
  const [showAccountabilityForm, setShowAccountabilityForm] = useState(false);
  const [classPlans, setClassPlans] = useState<ClassAccountabilityPlan[]>([]);
  const [planDraft, setPlanDraft] = useState<ClassAccountabilityPlan>({
    class_name: "",
    cadence: "weekly",
    due_weekday: "Sunday",
    notes: "",
  });
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const now = new Date();
    const base =
      now.getFullYear() === CALENDAR_YEAR
        ? now
        : new Date(CALENDAR_YEAR, 0, 1);
    return startOfWeek(base);
  });
  const [selectedWeekDayKey, setSelectedWeekDayKey] = useState<string>("all");
  const approvedCount = reviewDrafts.filter((draft) => draft.approved).length;

  const toDateInputValue = (value: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  };

  const loadSyllabusReview = async (syllabusId: string) => {
    const response = await fetch(`/api/travis/syllabus/${syllabusId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load syllabus review.");
    }

    const drafts: SyllabusDraftRow[] = data.drafts || [];
    setReviewClassName(data.syllabus?.class_name || "");
    setReviewDrafts(
      drafts.map((draft) => ({
        id: draft.id,
        class_name: draft.class_name || data.syllabus?.class_name || "",
        assignment_name: draft.assignment_name || "",
        assignment_type: draft.assignment_type || "",
        due_date: toDateInputValue(draft.due_date),
        grading_weight:
          typeof draft.grading_weight === "number"
            ? String(draft.grading_weight)
            : "",
        approved: draft.draft_status !== "rejected",
      }))
    );
  };

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/travis/assignments/all?status=active");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load assignments.");
      }

      const allAssignments: AssignmentRow[] = data.assignments || [];
      const now = Date.now();
      const overdue = allAssignments
        .filter((assignment) => {
          if (!assignment.due_date) return false;
          const due = new Date(assignment.due_date).getTime();
          return !Number.isNaN(due) && due < now;
        })
        .sort((a, b) => {
          const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return aDue - bDue;
        });

      const upcoming = allAssignments
        .filter((assignment) => {
          if (!assignment.due_date) return true;
          const due = new Date(assignment.due_date).getTime();
          return !Number.isNaN(due) && due >= now;
        })
        .sort((a, b) => {
          const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return aDue - bDue;
        });

      setUpcomingAssignments(upcoming);
      setOverdueAssignments(overdue);

      const classes = Array.from(
        new Set(upcoming.map((row) => row.class_name || "Uncategorized"))
      );
      const collapsedState = classes.reduce<Record<string, boolean>>(
        (acc, className) => {
          acc[className] = false;
          return acc;
        },
        {}
      );
      setExpandedClasses(collapsedState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ACCOUNTABILITY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setClassPlans(
          parsed.filter(
            (row): row is ClassAccountabilityPlan =>
              Boolean(row?.class_name) &&
              (row?.cadence === "weekly" || row?.cadence === "custom")
          )
        );
      }
    } catch {
      // Ignore invalid local data.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      ACCOUNTABILITY_STORAGE_KEY,
      JSON.stringify(classPlans)
    );
  }, [classPlans]);

  const startEditingAssignment = (assignment: AssignmentRow) => {
    setEditingAssignmentId(assignment.id);
    setEditingDraft({
      assignment_name: assignment.assignment_name || "",
      class_name: assignment.class_name || "",
      assignment_type: assignment.assignment_type || "",
      due_date: toDateInputValue(assignment.due_date),
    });
  };

  const cancelEditingAssignment = () => {
    setEditingAssignmentId(null);
    setEditingDraft({
      assignment_name: "",
      class_name: "",
      assignment_type: "",
      due_date: "",
    });
  };

  const saveAssignmentEdit = async (assignmentId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/travis/assignment/update/${assignmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_name: editingDraft.assignment_name.trim(),
          class_name: editingDraft.class_name.trim(),
          assignment_type: editingDraft.assignment_type.trim() || null,
          due_date: editingDraft.due_date || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update assignment.");
      }
      cancelEditingAssignment();
      await loadAssignments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update assignment."
      );
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/travis/assignment/delete/${assignmentId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove assignment.");
      }
      if (editingAssignmentId === assignmentId) {
        cancelEditingAssignment();
      }
      await loadAssignments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove assignment."
      );
    }
  };

  const markAssignmentComplete = async (assignmentId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/travis/assignment/complete/${assignmentId}`, {
        method: "PUT",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to complete assignment.");
      }
      if (editingAssignmentId === assignmentId) {
        cancelEditingAssignment();
      }
      await loadAssignments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete assignment."
      );
    }
  };

  const resetNewAssignmentDraft = () => {
    setNewAssignmentDraft({
      assignment_name: "",
      class_name: "",
      assignment_type: "",
      due_date: "",
      grading_weight: "",
    });
  };

  const createAssignment = async () => {
    const assignmentName = newAssignmentDraft.assignment_name.trim();
    const className = newAssignmentDraft.class_name.trim();
    if (!assignmentName || !className) {
      setError("Assignment name and class are required.");
      return;
    }

    const parsedWeight = Number(newAssignmentDraft.grading_weight);
    setCreatingAssignment(true);
    setError(null);
    try {
      const response = await fetch("/api/travis/assignment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_name: assignmentName,
          class_name: className,
          assignment_type: newAssignmentDraft.assignment_type.trim() || null,
          due_date: newAssignmentDraft.due_date || null,
          grading_weight:
            newAssignmentDraft.grading_weight.trim() === ""
              ? null
              : Number.isFinite(parsedWeight)
                ? parsedWeight
                : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create assignment.");
      }
      resetNewAssignmentDraft();
      setShowAddAssignmentForm(false);
      await loadAssignments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create assignment."
      );
    } finally {
      setCreatingAssignment(false);
    }
  };

  const saveClassPlan = () => {
    const className = planDraft.class_name.trim();
    if (!className) {
      setError("Class name is required for accountability settings.");
      return;
    }

    const nextPlan: ClassAccountabilityPlan = {
      class_name: className,
      cadence: planDraft.cadence,
      due_weekday: planDraft.due_weekday || "Sunday",
      notes: planDraft.notes.trim(),
    };

    setClassPlans((current) => {
      const existingIndex = current.findIndex(
        (row) => row.class_name.toLowerCase() === className.toLowerCase()
      );
      if (existingIndex === -1) {
        return [...current, nextPlan].sort((a, b) =>
          a.class_name.localeCompare(b.class_name)
        );
      }
      const copy = [...current];
      copy[existingIndex] = nextPlan;
      return copy.sort((a, b) => a.class_name.localeCompare(b.class_name));
    });
    setPlanDraft({
      class_name: "",
      cadence: "weekly",
      due_weekday: "Sunday",
      notes: "",
    });
    setShowAccountabilityForm(false);
    setError(null);
  };

  const removeClassPlan = (className: string) => {
    setClassPlans((current) =>
      current.filter(
        (row) => row.class_name.toLowerCase() !== className.toLowerCase()
      )
    );
  };

  const goToWeek = (offset: number) => {
    setSelectedWeekStart((current) => {
      const next = addDays(current, offset * 7);
      if (next.getTime() < minWeekStart.getTime()) return minWeekStart;
      if (next.getTime() > maxWeekStart.getTime()) return maxWeekStart;
      return next;
    });
    setSelectedWeekDayKey("all");
  };

  const goToMonth = (offset: number) => {
    setSelectedWeekStart((current) => {
      const month = Math.min(11, Math.max(0, current.getMonth() + offset));
      return startOfWeek(new Date(CALENDAR_YEAR, month, 1));
    });
    setSelectedWeekDayKey("all");
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/travis/syllabus/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      setParsedSyllabusId(data.syllabus.id);
      await loadSyllabusReview(data.syllabus.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const publishReviewedSyllabus = async () => {
    if (!parsedSyllabusId) return;
    setPublishing(true);
    setError(null);
    try {
      const draftsPayload = reviewDrafts.map((draft) => {
        const parsedWeight = Number(draft.grading_weight);
        return {
          id: draft.id,
          class_name: draft.class_name.trim(),
          assignment_name: draft.assignment_name.trim(),
          assignment_type: draft.assignment_type.trim() || null,
          due_date: draft.due_date || null,
          grading_weight:
            draft.grading_weight.trim() === ""
              ? null
              : Number.isFinite(parsedWeight)
                ? parsedWeight
                : null,
          approved: draft.approved,
          rejected: !draft.approved,
        };
      });

      const response = await fetch(
        `/api/travis/syllabus/confirm/${parsedSyllabusId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approve_all: false,
            drafts: draftsPayload,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Approve and publish failed.");
      }
      setParsedSyllabusId(null);
      setReviewClassName("");
      setReviewDrafts([]);
      await loadAssignments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Approve and publish failed."
      );
    } finally {
      setPublishing(false);
    }
  };

  const weekCalendarDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(selectedWeekStart, index)),
    [selectedWeekStart]
  );

  const visibleMonthStart = useMemo(
    () => new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), 1),
    [selectedWeekStart]
  );

  const monthGridDays = useMemo(() => {
    const gridStart = startOfWeek(visibleMonthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [visibleMonthStart]);

  const minWeekStart = useMemo(
    () => startOfWeek(new Date(CALENDAR_YEAR, 0, 1)),
    []
  );
  const maxWeekStart = useMemo(
    () => startOfWeek(new Date(CALENDAR_YEAR, 11, 31)),
    []
  );

  const canGoPrevWeek = selectedWeekStart.getTime() > minWeekStart.getTime();
  const canGoNextWeek = selectedWeekStart.getTime() < maxWeekStart.getTime();
  const canGoPrevMonth = selectedWeekStart.getMonth() > 0;
  const canGoNextMonth = selectedWeekStart.getMonth() < 11;

  const weeklyUpcomingAssignments = useMemo(() => {
    const weekStart = new Date(selectedWeekStart);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = addDays(weekStart, 6);
    weekEnd.setHours(23, 59, 59, 999);
    return upcomingAssignments.filter((assignment) => {
      if (!assignment.due_date) return false;
      const due = new Date(assignment.due_date).getTime();
      if (Number.isNaN(due)) return false;
      return due >= weekStart.getTime() && due <= weekEnd.getTime();
    });
  }, [upcomingAssignments, selectedWeekStart]);

  const assignmentCountByDate = useMemo(() => {
    return upcomingAssignments.reduce<Record<string, number>>((acc, assignment) => {
      if (!assignment.due_date) return acc;
      const due = new Date(assignment.due_date);
      if (due.getFullYear() !== CALENDAR_YEAR) return acc;
      const key = toLocalDateKey(due);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [upcomingAssignments]);

  const filteredWeeklyAssignments = useMemo(() => {
    if (selectedWeekDayKey === "all") return weeklyUpcomingAssignments;
    return weeklyUpcomingAssignments.filter((assignment) => {
      if (!assignment.due_date) return false;
      return toLocalDateKey(assignment.due_date) === selectedWeekDayKey;
    });
  }, [weeklyUpcomingAssignments, selectedWeekDayKey]);

  const upcomingByClass = useMemo(() => {
    const byClass = new Map<string, AssignmentRow[]>();
    filteredWeeklyAssignments.forEach((assignment) => {
      const className = assignment.class_name || "Uncategorized";
      const existing = byClass.get(className) || [];
      existing.push(assignment);
      byClass.set(className, existing);
    });
    return Array.from(byClass.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [filteredWeeklyAssignments]);

  const weeklyClassCount = useMemo(() => {
    return new Set(filteredWeeklyAssignments.map((row) => row.class_name)).size;
  }, [filteredWeeklyAssignments]);
  const todayDateKey = useMemo(() => toLocalDateKey(new Date()), []);

  const classPlanByName = useMemo(() => {
    return classPlans.reduce<Record<string, ClassAccountabilityPlan>>(
      (acc, row) => {
        acc[row.class_name.toLowerCase()] = row;
        return acc;
      },
      {}
    );
  }, [classPlans]);

  return (
    <div className="space-y-5">
      {/* Travis avatar header */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 p-4 shadow-[0_14px_36px_rgba(2,6,23,0.5)] ring-1 ring-teal-400/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-teal-400/30 bg-gradient-to-br from-teal-500/40 to-emerald-700/40 shadow-[0_0_15px_rgba(20,184,166,0.3)]" />
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-100">Travis</p>
            <p className="text-[11px] text-slate-400">Homework Assistant</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="flex h-[72px] flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
              Selected week
            </p>
            <p className="text-xl font-semibold leading-none tracking-tight text-slate-100">
              {weeklyUpcomingAssignments.length}
            </p>
          </div>
          <div className="flex h-[72px] flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
              Classes
            </p>
            <p className="text-xl font-semibold leading-none tracking-tight text-slate-100">
              {weeklyClassCount}
            </p>
          </div>
          <div className="flex h-[72px] flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
              Overdue
            </p>
            <p className="text-xl font-semibold leading-none tracking-tight text-red-200">
              {overdueAssignments.length}
            </p>
          </div>
        </div>
      </div>

      {/* Weekly calendar */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-3 shadow-[0_14px_34px_rgba(2,6,23,0.45)] ring-1 ring-white/5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            <CalendarDays className="h-4 w-4 text-teal-300" />
            2026 calendar
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              disabled={!canGoPrevMonth}
              className="rounded-lg border border-white/15 bg-white/[0.04] p-1 text-slate-200 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <p className="px-2 text-xs font-semibold tracking-tight text-slate-100">
              {visibleMonthStart.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </p>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              disabled={!canGoNextMonth}
              className="rounded-lg border border-white/15 bg-white/[0.04] p-1 text-slate-200 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] text-slate-500">
            Week of{" "}
            {selectedWeekStart.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
          <button
            type="button"
            onClick={() => {
              const today = new Date(CALENDAR_YEAR, new Date().getMonth(), new Date().getDate());
              setSelectedWeekStart(startOfWeek(today));
              setSelectedWeekDayKey(toLocalDateKey(today));
            }}
            className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-white/[0.09]"
          >
            Jump to today
          </button>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[9px] uppercase tracking-[0.16em] text-slate-500">
          {WEEKDAYS.map((weekday) => (
            <p key={weekday}>{weekday.slice(0, 3)}</p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthGridDays.map((day) => {
            const key = toLocalDateKey(day);
            const count = assignmentCountByDate[key] || 0;
            const inMonth = day.getMonth() === visibleMonthStart.getMonth();
            const selected = selectedWeekDayKey === key;
            const isToday = key === todayDateKey;
            const inSelectedWeek = weekCalendarDays.some(
              (weekDay) => toLocalDateKey(weekDay) === key
            );
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedWeekStart(startOfWeek(day));
                  setSelectedWeekDayKey(key);
                }}
                className={`relative rounded-lg border px-1 py-1.5 text-center transition ${
                  selected
                    ? "border-teal-300/55 bg-teal-500/18 shadow-[0_0_0_1px_rgba(45,212,191,0.22)_inset]"
                    : inSelectedWeek
                      ? "border-teal-400/20 bg-teal-500/[0.08]"
                      : "border-white/10 bg-white/[0.015] hover:bg-white/[0.05]"
                }`}
              >
                {isToday && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-300" />
                )}
                <p
                  className={`text-[10px] font-medium ${
                    inMonth ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  {day.getDate()}
                </p>
                <p className="mt-1 text-[10px] text-teal-200">
                  {count > 0 ? "•".repeat(Math.min(count, 3)) : ""}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-white/8 pt-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToWeek(-1)}
              disabled={!canGoPrevWeek}
              className="rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-200 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous week
            </button>
            <button
              type="button"
              onClick={() => goToWeek(1)}
              disabled={!canGoNextWeek}
              className="rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-200 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next week
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedWeekDayKey("all")}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
              selectedWeekDayKey === "all"
                ? "border-teal-300/40 bg-teal-500/20 text-teal-100"
                : "border-white/15 bg-white/[0.04] text-slate-300 hover:bg-white/[0.09]"
            }`}
          >
            Show full week
          </button>
        </div>
      </div>

      {/* Overdue assignments alert */}
      {overdueAssignments.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/8 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
            <AlertTriangle className="h-4 w-4" />
            Overdue
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-100">
            {overdueAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="academic-assignment-card-overdue rounded-lg px-3 py-3"
              >
                {editingAssignmentId === assignment.id ? (
                  <div className="space-y-2">
                    <input
                      value={editingDraft.assignment_name}
                      onChange={(event) =>
                        setEditingDraft((current) => ({
                          ...current,
                          assignment_name: event.target.value,
                        }))
                      }
                      className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-red-50 focus:border-red-300 focus:outline-none"
                      placeholder="Assignment name"
                    />
                    <input
                      value={editingDraft.class_name}
                      onChange={(event) =>
                        setEditingDraft((current) => ({
                          ...current,
                          class_name: event.target.value,
                        }))
                      }
                      className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-red-50 focus:border-red-300 focus:outline-none"
                      placeholder="Class"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={editingDraft.assignment_type}
                        onChange={(event) =>
                          setEditingDraft((current) => ({
                            ...current,
                            assignment_type: event.target.value,
                          }))
                        }
                        className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-red-50 focus:border-red-300 focus:outline-none"
                        placeholder="Type"
                      />
                      <input
                        type="date"
                        value={editingDraft.due_date}
                        onChange={(event) =>
                          setEditingDraft((current) => ({
                            ...current,
                            due_date: event.target.value,
                          }))
                        }
                        className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-red-50 focus:border-red-300 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveAssignmentEdit(assignment.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200/40 bg-red-500/20 px-2 py-1 text-[11px] text-red-50 transition hover:bg-red-500/30"
                      >
                        <Save className="h-3 w-3" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingAssignment}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200/30 bg-black/20 px-2 py-1 text-[11px] text-red-100/90 transition hover:bg-black/35"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold">
                      {assignment.assignment_name}
                    </p>
                    <p className="text-xs text-red-100/80">
                      {assignment.class_name}
                    </p>
                    <p className="mt-1 text-xs text-red-100/70">
                      {assignment.due_date
                        ? new Date(assignment.due_date).toLocaleDateString()
                        : "No due date"}
                    </p>
                    {toGuidancePreview(assignment) && (
                      <p className="mt-1 text-xs text-red-100/80">
                        {toGuidancePreview(assignment)}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => markAssignmentComplete(assignment.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-300/40 bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-100 transition hover:bg-emerald-500/30"
                      >
                        <Check className="h-3 w-3" />
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditingAssignment(assignment)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200/40 bg-red-500/15 px-2 py-1 text-[11px] text-red-100 transition hover:bg-red-500/25"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAssignment(assignment.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200/40 bg-red-900/25 px-2 py-1 text-[11px] text-red-100 transition hover:bg-red-900/40"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming assignments */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
          <CalendarCheck className="h-4 w-4 text-teal-300" />
          Upcoming by class
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
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
        <div className="mt-3 space-y-2 text-sm text-slate-100">
          {loading && (
            <div className="academic-nested-card text-xs text-slate-400">
              Loading assignments...
            </div>
          )}
          {!loading && filteredWeeklyAssignments.length === 0 && (
            <div className="academic-nested-card text-xs text-slate-400">
              {selectedWeekDayKey === "all"
                ? "No deadlines in the next 7 days."
                : "No deadlines on this day."}
            </div>
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
                        {assignments.length}{" "}
                        {assignments.length === 1 ? "item" : "items"}{" "}
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
              {editingAssignmentId === assignment.id ? (
                <div className="space-y-2">
                  <input
                    value={editingDraft.assignment_name}
                    onChange={(event) =>
                      setEditingDraft((current) => ({
                        ...current,
                        assignment_name: event.target.value,
                      }))
                    }
                    className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                    placeholder="Assignment name"
                  />
                  <input
                    value={editingDraft.class_name}
                    onChange={(event) =>
                      setEditingDraft((current) => ({
                        ...current,
                        class_name: event.target.value,
                      }))
                    }
                    className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                    placeholder="Class"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editingDraft.assignment_type}
                      onChange={(event) =>
                        setEditingDraft((current) => ({
                          ...current,
                          assignment_type: event.target.value,
                        }))
                      }
                      className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                      placeholder="Type"
                    />
                    <input
                      type="date"
                      value={editingDraft.due_date}
                      onChange={(event) =>
                        setEditingDraft((current) => ({
                          ...current,
                          due_date: event.target.value,
                        }))
                      }
                      className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveAssignmentEdit(assignment.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-teal-300/40 bg-teal-500/20 px-2 py-1 text-[11px] text-teal-100 transition hover:bg-teal-500/30"
                    >
                      <Save className="h-3 w-3" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingAssignment}
                      className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/20 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-black/35"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold">
                    {assignment.assignment_name}
                  </p>
                  <p className="text-xs text-slate-400">{assignment.class_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {assignment.due_date
                      ? new Date(assignment.due_date).toLocaleDateString()
                      : "No due date"}
                  </p>
                  {toGuidancePreview(assignment) && (
                    <p className="mt-1 text-xs text-slate-400">
                      {toGuidancePreview(assignment)}
                    </p>
                  )}
                  {assignment.assignment_type === "paper" && (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/academic-studio/dashboard?workspace=paper-workflow&assignmentId=${assignment.id}`
                        )
                      }
                      className="mt-2 inline-flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-500/15 px-3 py-1 text-xs text-teal-200 transition hover:bg-teal-500/25"
                    >
                      <FileText className="h-3 w-3" />
                      Start paper
                    </button>
                  )}
                  {isCodingAssignment(assignment) &&
                    assignment.assignment_type !== "paper" && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/academic-studio/dashboard?workspace=coding-review&assignmentId=${assignment.id}`
                          )
                        }
                        className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs text-amber-100 transition hover:bg-amber-500/25"
                      >
                        <Code2 className="h-3 w-3" />
                        Open coding review
                      </button>
                    )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => markAssignmentComplete(assignment.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300/40 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-100 transition hover:bg-emerald-500/25"
                    >
                      <Check className="h-3 w-3" />
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditingAssignment(assignment)}
                      className="inline-flex items-center gap-1 rounded-md border border-teal-300/40 bg-teal-500/15 px-2 py-1 text-[11px] text-teal-100 transition hover:bg-teal-500/25"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAssignment(assignment.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300/40 bg-red-500/15 px-2 py-1 text-[11px] text-red-100 transition hover:bg-red-500/25"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </>
              )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
          <ListChecks className="h-4 w-4 text-slate-300" />
          Quick actions
        </div>
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
                  setNewAssignmentDraft((current) => ({
                    ...current,
                    assignment_name: event.target.value,
                  }))
                }
                className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                placeholder="Assignment title"
              />
              <input
                value={newAssignmentDraft.class_name}
                onChange={(event) =>
                  setNewAssignmentDraft((current) => ({
                    ...current,
                    class_name: event.target.value,
                  }))
                }
                className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                placeholder="Class name"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newAssignmentDraft.assignment_type}
                  onChange={(event) =>
                    setNewAssignmentDraft((current) => ({
                      ...current,
                      assignment_type: event.target.value,
                    }))
                  }
                  className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                  placeholder="Type (homework, lab, project...)"
                />
                <input
                  type="date"
                  value={newAssignmentDraft.due_date}
                  onChange={(event) =>
                    setNewAssignmentDraft((current) => ({
                      ...current,
                      due_date: event.target.value,
                    }))
                  }
                  className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                />
              </div>
              <input
                value={newAssignmentDraft.grading_weight}
                onChange={(event) =>
                  setNewAssignmentDraft((current) => ({
                    ...current,
                    grading_weight: event.target.value,
                  }))
                }
                className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                placeholder="Grading weight (optional, e.g. 0.2)"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={createAssignment}
                  disabled={creatingAssignment}
                  className="inline-flex items-center gap-1 rounded-md border border-teal-300/40 bg-teal-500/20 px-2 py-1 text-[11px] text-teal-100 transition hover:bg-teal-500/30 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/20 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-black/35"
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
                onChange={(event) =>
                  setPlanDraft((current) => ({
                    ...current,
                    class_name: event.target.value,
                  }))
                }
                className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                placeholder="Class name"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={planDraft.cadence}
                  onChange={(event) =>
                    setPlanDraft((current) => ({
                      ...current,
                      cadence: event.target.value as "weekly" | "custom",
                    }))
                  }
                  className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                >
                  <option value="weekly">Weekly cadence</option>
                  <option value="custom">Custom cadence</option>
                </select>
                <select
                  value={planDraft.due_weekday}
                  onChange={(event) =>
                    setPlanDraft((current) => ({
                      ...current,
                      due_weekday: event.target.value,
                    }))
                  }
                  className="rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day} value={day}>
                      Due on {day}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={planDraft.notes}
                onChange={(event) =>
                  setPlanDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={2}
                className="w-full rounded border border-white/20 bg-black/25 px-2 py-1 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                placeholder="Example: New homework opens Monday and is due Sunday night."
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveClassPlan}
                  className="inline-flex items-center gap-1 rounded-md border border-teal-300/40 bg-teal-500/20 px-2 py-1 text-[11px] text-teal-100 transition hover:bg-teal-500/30"
                >
                  <Save className="h-3 w-3" />
                  Save plan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountabilityForm(false);
                    setPlanDraft({
                      class_name: "",
                      cadence: "weekly",
                      due_weekday: "Sunday",
                      notes: "",
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/20 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-black/35"
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
                    {plan.class_name} ·{" "}
                    {plan.cadence === "weekly"
                      ? `weekly (${plan.due_weekday})`
                      : "custom"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeClassPlan(plan.class_name)}
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
                handleUpload(selected);
              }
            }}
          />
          {uploading && (
            <p className="text-xs text-slate-500">Parsing syllabus...</p>
          )}
          {parsedSyllabusId && (
            <div className="space-y-2 rounded-xl border border-teal-400/30 bg-teal-500/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">
                Review Required
              </p>
              {reviewClassName && (
                <p className="text-xs text-teal-50/90">{reviewClassName}</p>
              )}
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/academic-studio/dashboard?workspace=syllabi&syllabusId=${parsedSyllabusId}`
                  )
                }
                className="w-full rounded-lg border border-teal-300/30 bg-teal-500/15 px-3 py-2 text-xs text-teal-100 transition hover:bg-teal-500/25"
              >
                Open full review page
              </button>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {reviewDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="rounded-lg border border-white/15 bg-black/20 p-2"
                  >
                    <input
                      value={draft.assignment_name}
                      onChange={(event) =>
                        setReviewDrafts((current) =>
                          current.map((row) =>
                            row.id === draft.id
                              ? { ...row, assignment_name: event.target.value }
                              : row
                          )
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
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, assignment_type: event.target.value }
                                : row
                            )
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
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, due_date: event.target.value }
                                : row
                            )
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
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, class_name: event.target.value }
                                : row
                            )
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
                              current.map((row) =>
                                row.id === draft.id
                                  ? { ...row, approved: event.target.checked }
                                  : row
                              )
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
                onClick={publishReviewedSyllabus}
                disabled={publishing || reviewDrafts.length === 0}
                className="flex w-full items-center justify-between rounded-xl border border-teal-400/40 bg-teal-500/20 px-3 py-3 text-left text-xs text-teal-100 transition hover:bg-teal-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {publishing
                  ? "Publishing..."
                  : `Approve & publish ${approvedCount} assignments`}
                <Check className="h-4 w-4" />
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
