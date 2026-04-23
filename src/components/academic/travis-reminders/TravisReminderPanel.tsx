"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";

type Reminder = {
  id: string;
  assignmentId: string;
  reminderType: string;
  createdAt: string;
  message: string;
};

type ActiveAssignment = {
  due_date: string | null;
  status: string | null;
  is_at_risk?: boolean | null;
};

const REMINDER_PRIORITY: Record<string, number> = {
  overdue: 0,
  due_today: 1,
  "1_day": 2,
  "3_days": 3,
  at_risk: 4,
};

function toWeekStartKey(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function TravisReminderPanel({
  mode = "floating",
}: {
  mode?: "floating" | "inline";
}) {
  const t = useTranslations("academic.travisUi.reminders");
  const [collapsed, setCollapsed] = useState(true);
  const [expandedList, setExpandedList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [currentWeekAtRiskCount, setCurrentWeekAtRiskCount] = useState(0);
  const [viewedWeekAtRiskCount, setViewedWeekAtRiskCount] = useState(0);
  const [viewedWeekKey, setViewedWeekKey] = useState(() => toWeekStartKey(new Date()));
  const dismissedSessionKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const readWeekKey = () => {
      const url = new URL(window.location.href);
      const queryValue = url.searchParams.get("weekStart");
      setViewedWeekKey(queryValue || toWeekStartKey(new Date()));
    };

    const handleWeekChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ weekStart?: string }>;
      const nextWeek = customEvent.detail?.weekStart;
      if (nextWeek) {
        setViewedWeekKey(nextWeek);
        return;
      }
      readWeekKey();
    };

    readWeekKey();
    window.addEventListener("academic:week-change", handleWeekChange);
    window.addEventListener("popstate", readWeekKey);
    return () => {
      window.removeEventListener("academic:week-change", handleWeekChange);
      window.removeEventListener("popstate", readWeekKey);
    };
  }, []);

  const loadActive = useCallback(async () => {
    const activeResponse = await fetch("/api/travis/reminders/active", {
      method: "GET",
      cache: "no-store",
    });
    const activeData = await activeResponse.json();
    if (!activeResponse.ok) {
        throw new Error(activeData?.error || t("errors.loadReminders"));
    }
    if (activeResponse.ok) {
      const nextReminders = Array.isArray(activeData?.reminders) ? activeData.reminders : [];
      const filtered = nextReminders.filter((reminder: Reminder) => {
        return !dismissedSessionKeysRef.current.has(reminder.assignmentId);
      });
      setReminders(filtered);
    }
  }, []);

  const loadAtRiskCounts = useCallback(async () => {
    const response = await fetch("/api/travis/assignments/all?status=active", {
      method: "GET",
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || t("errors.loadRiskData"));
    }
    const assignments: ActiveAssignment[] = Array.isArray(data?.assignments) ? data.assignments : [];

    const nowWeekKey = toWeekStartKey(new Date());
    const viewedKey = viewedWeekKey;

    const isAtRisk = (assignment: ActiveAssignment) =>
      Boolean(assignment?.is_at_risk) &&
      assignment?.status !== "submitted" &&
      assignment?.status !== "completed";
    const weekFromDueDate = (dueDate: string | null) => {
      if (!dueDate) return "";
      const date = new Date(`${dueDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) return "";
      return toWeekStartKey(date);
    };

    const currentWeekCount = assignments.filter(
      (assignment) => isAtRisk(assignment) && weekFromDueDate(assignment?.due_date || null) === nowWeekKey
    ).length;
    const viewedWeekCount = assignments.filter(
      (assignment) => isAtRisk(assignment) && weekFromDueDate(assignment?.due_date || null) === viewedKey
    ).length;

    setCurrentWeekAtRiskCount(currentWeekCount);
    setViewedWeekAtRiskCount(viewedWeekCount);
  }, [viewedWeekKey]);

  const evaluateAndLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const evaluateResponse = await fetch("/api/travis/reminders/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const evaluateData = await evaluateResponse.json();
      if (!evaluateResponse.ok) {
        throw new Error(evaluateData?.error || t("errors.evaluate"));
      }
      await loadActive();
      await loadAtRiskCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadReminders"));
    } finally {
      setLoading(false);
    }
  }, [loadActive, loadAtRiskCounts]);

  useEffect(() => {
    void evaluateAndLoad();
    const interval = window.setInterval(() => {
      void evaluateAndLoad();
    }, 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [evaluateAndLoad]);

  useEffect(() => {
    void loadAtRiskCounts();
  }, [loadAtRiskCounts]);

  const dismissReminder = async (reminder: Reminder) => {
    await fetch("/api/travis/reminders/dismiss", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assignmentId: reminder.assignmentId,
        reminderType: reminder.reminderType,
      }),
    });
    dismissedSessionKeysRef.current.add(reminder.assignmentId);
    setReminders((prev) => prev.filter((item) => item.id !== reminder.id));
  };

  const sortedReminders = useMemo(
    () =>
      [...reminders].sort((a, b) => {
        const priorityA = REMINDER_PRIORITY[a.reminderType] ?? 99;
        const priorityB = REMINDER_PRIORITY[b.reminderType] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [reminders]
  );
  const compactVisible = sortedReminders.slice(0, 3);
  const hiddenCount = Math.max(0, sortedReminders.length - compactVisible.length);
  const remindersToRender = expandedList ? sortedReminders : compactVisible;
  const urgentCount = sortedReminders.filter(
    (item) => item.reminderType === "overdue" || item.reminderType === "due_today"
  ).length;
  const isViewingCurrentWeek = viewedWeekKey === toWeekStartKey(new Date());

  const dismissVisible = async () => {
    await Promise.all(remindersToRender.map((reminder) => dismissReminder(reminder)));
  };

  if (reminders.length === 0 && !loading && !error) {
    return null;
  }

  if (mode === "floating" && collapsed) {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-[#0B1220] px-3 py-2 text-xs text-slate-100 shadow-lg"
        >
            <span className="font-semibold tracking-wide text-teal-200">{t("travis")}</span>
          <span className="rounded-full border border-white/20 px-1.5 py-0.5 text-[10px]">
            {sortedReminders.length}
          </span>
        </button>
      </div>
    );
  }

  const containerClass =
    mode === "inline"
      ? "w-full rounded-xl border border-teal-400/30 bg-[#0B1220] p-3 text-slate-100 shadow-lg"
      : "fixed bottom-5 right-5 z-40 w-[320px] max-w-[calc(100vw-2.5rem)] rounded-xl border border-teal-400/30 bg-[#0B1220] p-3 text-slate-100 shadow-lg";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">{t("title")}</p>
        <div className="flex items-center gap-1.5">
          {mode === "floating" ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded border border-white/20 px-2 py-1 text-[10px] text-slate-200"
            >
              {t("minimize")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-2">
        <p className="text-xs text-slate-300">
          {t("summary", { count: sortedReminders.length, urgent: urgentCount })}
        </p>
      </div>
      <div className="mt-2 space-y-2">
        {isViewingCurrentWeek && currentWeekAtRiskCount > 0 && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {t("currentWeekAtRisk", { count: currentWeekAtRiskCount })}
          </p>
        )}
        {!isViewingCurrentWeek && viewedWeekAtRiskCount === 0 && currentWeekAtRiskCount > 0 && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {t("viewedWeekClear", { count: currentWeekAtRiskCount })}
          </p>
        )}
        {loading && reminders.length === 0 && (
          <AcademicLoadingState
            message={t("checking")}
            className="!min-h-0 border-white/10 bg-black/20 py-3"
          />
        )}
        {error && (
          <AcademicErrorState
            message={error}
            className="!min-h-0 border-red-500/30 bg-red-500/10 py-3"
          />
        )}
      </div>
      <div className={`${expandedList ? "max-h-[420px]" : "max-h-[260px]"} mt-2 space-y-2 overflow-y-auto pr-1`}>
        {remindersToRender.map((reminder, index) => (
          <div
            key={reminder.id}
            className={`rounded-lg border border-white/10 bg-black/25 px-3 py-2 ${
              !expandedList ? `translate-y-[${Math.min(index * 2, 4)}px]` : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-xs text-slate-100">{reminder.message}</p>
              <button
                type="button"
                onClick={() => void dismissReminder(reminder)}
                className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-slate-200"
                aria-label={t("dismissReminder")}
                title={t("dismissReminder")}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hiddenCount > 0 && !expandedList && (
            <button
              type="button"
              onClick={() => setExpandedList(true)}
              className="rounded border border-white/20 px-2 py-1 text-[10px] text-slate-200"
            >
              {t("more", { count: hiddenCount })}
            </button>
          )}
          {expandedList && (
            <button
              type="button"
              onClick={() => setExpandedList(false)}
              className="rounded border border-white/20 px-2 py-1 text-[10px] text-slate-200"
            >
              {t("showLess")}
            </button>
          )}
        </div>
        {remindersToRender.length > 0 && (
          <button
            type="button"
            onClick={() => void dismissVisible()}
            className="rounded border border-white/20 px-2 py-1 text-[10px] text-slate-200"
          >
            {t("dismissVisible")}
          </button>
        )}
      </div>
    </div>
  );
}
