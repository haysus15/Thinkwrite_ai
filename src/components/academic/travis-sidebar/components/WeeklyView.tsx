"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toLocalDateKey } from "@/lib/academic/dueDate";
import { startOfWeek, WEEKDAYS } from "../hooks/travisShared";
import shared from "../../shared/academic.module.css";

type WeeklyViewProps = {
  weeklyUpcomingAssignmentsLength: number;
  weeklyClassCount: number;
  overdueAssignmentsLength: number;
  visibleMonthStart: Date;
  canGoPrevMonth: boolean;
  canGoNextMonth: boolean;
  goToMonth: (offset: number) => void;
  selectedWeekStart: Date;
  jumpToToday: () => void;
  monthGridDays: Date[];
  calendarSignalByDate: Record<string, "overdue" | "due_today" | "planned">;
  selectedWeekDayKey: string;
  todayDateKey: string;
  weekCalendarDays: Date[];
  setSelectedWeekStart: (day: Date) => void;
  setSelectedWeekDayKey: (value: string) => void;
  canGoPrevWeek: boolean;
  canGoNextWeek: boolean;
  goToWeek: (offset: number) => void;
};

export default function WeeklyView({
  weeklyUpcomingAssignmentsLength,
  weeklyClassCount,
  overdueAssignmentsLength,
  visibleMonthStart,
  canGoPrevMonth,
  canGoNextMonth,
  goToMonth,
  selectedWeekStart,
  jumpToToday,
  monthGridDays,
  calendarSignalByDate,
  selectedWeekDayKey,
  todayDateKey,
  weekCalendarDays,
  setSelectedWeekStart,
  setSelectedWeekDayKey,
  canGoPrevWeek,
  canGoNextWeek,
  goToWeek,
}: WeeklyViewProps) {
  const t = useTranslations("academic.travisUi.weeklyView");
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <div className={`${shared.surfacePanelCompact} p-3`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-300 lg:hidden">
        <span className={shared.chip}>{t("thisWeek", { count: weeklyUpcomingAssignmentsLength })}</span>
        <span className={shared.chip}>{t("classes", { count: weeklyClassCount })}</span>
        <button
          type="button"
          onClick={() => setMobileExpanded((current) => !current)}
          className={`${shared.buttonBase} ${shared.buttonSecondary} !px-2 !py-0.5 !text-[10px] ml-auto`}
        >
          {mobileExpanded ? t("hideCalendar") : t("showCalendar")}
        </button>
      </div>

      <div className={`${mobileExpanded ? "block" : "hidden"} lg:block`}>
      <div className="mb-2 hidden flex-wrap items-center gap-2 text-[10px] text-slate-300 lg:flex">
        <span className={shared.chip}>
          {t("thisWeek", { count: weeklyUpcomingAssignmentsLength })}
        </span>
        <span className={shared.chip}>
          {t("classes", { count: weeklyClassCount })}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 ${
            overdueAssignmentsLength > 0
              ? "border-red-400/40 bg-red-500/15 text-red-100"
              : shared.chip
          }`}
        >
          {t("overdue", { count: overdueAssignmentsLength })}
        </span>
      </div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            <CalendarDays className="h-4 w-4 text-teal-300" />
            {t("calendar")}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              disabled={!canGoPrevMonth}
              className={`${shared.buttonBase} ${shared.buttonSecondary} !rounded-lg !p-1 disabled:cursor-not-allowed disabled:opacity-40`}
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
              className={`${shared.buttonBase} ${shared.buttonSecondary} !rounded-lg !p-1 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] text-slate-500">
            {t("weekOf", {
              date: selectedWeekStart.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }),
            })}
          </p>
          <button
            type="button"
            onClick={jumpToToday}
            className={`${shared.buttonBase} ${shared.buttonSecondary} !px-2 !py-0.5 !text-[10px]`}
          >
            {t("jumpToToday")}
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
            const signal = calendarSignalByDate[key];
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
                <p
                  className={`mt-1 text-[10px] ${
                    signal === "overdue"
                      ? "text-red-300"
                      : signal === "due_today"
                        ? "text-amber-300"
                        : signal === "planned"
                          ? "text-sky-300"
                          : "text-transparent"
                  }`}
                >
                  {signal ? "•" : "·"}
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
              className={`${shared.buttonBase} ${shared.buttonSecondary} !rounded-lg !px-2 !py-1 !text-[10px] disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {t("previousWeek")}
            </button>
            <button
              type="button"
              onClick={() => goToWeek(1)}
              disabled={!canGoNextWeek}
              className={`${shared.buttonBase} ${shared.buttonSecondary} !rounded-lg !px-2 !py-1 !text-[10px] disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {t("nextWeek")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedWeekDayKey("all")}
            className={`${shared.buttonBase} !px-2 !py-0.5 !text-[10px] ${
              selectedWeekDayKey === "all"
                ? "border-teal-300/40 bg-teal-500/20 text-teal-100"
                : `${shared.buttonSecondary}`
            }`}
          >
            {t("showFullWeek")}
          </button>
        </div>
      </div>
    </div>
  );
}
