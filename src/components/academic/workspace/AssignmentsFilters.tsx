import { useTranslations } from "next-intl";
import shared from "../shared/academic.module.css";
import type { AssignmentStatus, DueRange, FilterChip, GroupBy, Priority } from "./assignmentsWorkspaceTypes";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./assignmentsWorkspaceTypes";
import { titleCaseStatus } from "./assignmentsWorkspaceUtils";

type AssignmentsFiltersProps = {
  classes: string[];
  classFilter: string;
  dueRange: DueRange;
  searchText: string;
  groupBy: GroupBy;
  statusFilter: AssignmentStatus[];
  priorityFilter: Priority[];
  activeFilterChips: FilterChip[];
  setClassFilter: (value: string) => void;
  setDueRange: (value: DueRange) => void;
  setSearchText: (value: string) => void;
  setGroupBy: (value: GroupBy) => void;
  setStatusFilter: (updater: (current: AssignmentStatus[]) => AssignmentStatus[]) => void;
  setPriorityFilter: (updater: (current: Priority[]) => Priority[]) => void;
};

export default function AssignmentsFilters({
  classes,
  classFilter,
  dueRange,
  searchText,
  groupBy,
  statusFilter,
  priorityFilter,
  activeFilterChips,
  setClassFilter,
  setDueRange,
  setSearchText,
  setGroupBy,
  setStatusFilter,
  setPriorityFilter,
}: AssignmentsFiltersProps) {
  const t = useTranslations("academic.workspace.filters");
  return (
    <div className={shared.surfacePanelCompact}>
      <div className="grid gap-2 lg:grid-cols-5">
        <select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          className={shared.control}
        >
          <option value="all">{t("allClasses")}</option>
          {classes.map((className) => (
            <option key={className} value={className}>
              {className}
            </option>
          ))}
        </select>
        <select
          value={dueRange}
          onChange={(event) => setDueRange(event.target.value as DueRange)}
          className={shared.control}
        >
          <option value="week">{t("thisWeek")}</option>
          <option value="month">{t("thisMonth")}</option>
          <option value="all">{t("all")}</option>
        </select>
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className={`${shared.control} lg:col-span-2`}
        />
        <select
          value={groupBy}
          onChange={(event) => setGroupBy(event.target.value as GroupBy)}
          className={shared.control}
        >
          <option value="class">{t("groupByClass")}</option>
          <option value="due">{t("groupByDueDate")}</option>
          <option value="flat">{t("flatList")}</option>
        </select>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((status) => {
          const active = statusFilter.includes(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() =>
                setStatusFilter((current) =>
                  current.includes(status)
                    ? current.filter((value) => value !== status)
                    : [...current, status]
                )
              }
              className={`rounded-full border px-2 py-1 text-[11px] ${
                active ? "border-sky-300/40 bg-sky-500/20 text-sky-100" : shared.chip
              }`}
            >
              {titleCaseStatus(status)}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRIORITY_OPTIONS.map((priority) => {
          const active = priorityFilter.includes(priority);
          return (
            <button
              key={priority}
              type="button"
              onClick={() =>
                setPriorityFilter((current) =>
                  current.includes(priority)
                    ? current.filter((value) => value !== priority)
                    : [...current, priority]
                )
              }
              className={`rounded-full border px-2 py-1 text-[11px] ${
                active ? "border-amber-300/40 bg-amber-500/20 text-amber-100" : shared.chip
              }`}
            >
              {titleCaseStatus(priority)}
            </button>
          );
        })}
      </div>
      {activeFilterChips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {activeFilterChips.map((chip) => (
            <button key={chip.key} type="button" onClick={chip.onClear} className={shared.chip}>
              {chip.label} ×
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
