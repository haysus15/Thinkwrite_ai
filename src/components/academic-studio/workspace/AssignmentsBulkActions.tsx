import { useRouter } from "next/navigation";
import shared from "../shared/academic-studio.module.css";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "./assignmentsWorkspaceTypes";
import type { AssignmentStatus, Priority } from "./assignmentsWorkspaceTypes";
import { titleCaseStatus } from "./assignmentsWorkspaceUtils";

type AssignmentsBulkActionsProps = {
  selectedIds: string[];
  applyBulkStatus: (status: AssignmentStatus) => Promise<void>;
  applyBulkPriority: (priority: Priority) => Promise<void>;
  archiveSelected: () => Promise<void>;
};

export default function AssignmentsBulkActions({
  selectedIds,
  applyBulkStatus,
  applyBulkPriority,
  archiveSelected,
}: AssignmentsBulkActionsProps) {
  const router = useRouter();

  if (selectedIds.length < 2) return null;

  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 p-3">
      <span className="text-xs text-slate-300">{selectedIds.length} selected</span>
      <select
        onChange={(event) => void applyBulkStatus(event.target.value as AssignmentStatus)}
        className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-slate-100"
        defaultValue=""
      >
        <option value="" disabled>
          Set status
        </option>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {titleCaseStatus(status)}
          </option>
        ))}
      </select>
      <select
        onChange={(event) => void applyBulkPriority(event.target.value as Priority)}
        className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-slate-100"
        defaultValue=""
      >
        <option value="" disabled>
          Set priority
        </option>
        {PRIORITY_OPTIONS.map((priority) => (
          <option key={priority} value={priority}>
            {titleCaseStatus(priority)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void archiveSelected()}
        className={`${shared.buttonBase} ${shared.buttonDanger}`}
      >
        Archive selected
      </button>
      <button
        type="button"
        onClick={() => {
          const url = new URL("/academic/agenda", window.location.origin);
          url.searchParams.set("focusMany", selectedIds.join(","));
          router.push(`${url.pathname}${url.search}`);
        }}
        className={`${shared.buttonBase} ${shared.buttonPrimary}`}
      >
        Plan all selected in Agenda
      </button>
    </div>
  );
}
