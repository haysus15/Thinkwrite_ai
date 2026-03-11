type ApprovedDraft = {
  id: string;
  assignment_name: string;
  due_date: string;
  parser_confidence: number;
};

type SyllabusPublishPreviewModalProps = {
  publishing: boolean;
  approvedDrafts: ApprovedDraft[];
  rejectedCount: number;
  workloadByWeek: Array<[string, number]>;
  lowConfidenceApprovedCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function SyllabusPublishPreviewModal({
  publishing,
  approvedDrafts,
  rejectedCount,
  workloadByWeek,
  lowConfidenceApprovedCount,
  onClose,
  onConfirm,
}: SyllabusPublishPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-slate-950 p-5">
        <p className="text-base font-semibold text-slate-100">Here is what will be created</p>

        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
          <p>{approvedDrafts.length} new assignments will be added.</p>
          <div className="mt-2 space-y-1 text-xs">
            {approvedDrafts.map((draft) => (
              <div key={draft.id} className="flex items-center justify-between gap-3">
                <span>
                  {draft.assignment_name || "Untitled"} · {draft.due_date || "No due date"}
                </span>
                {draft.parser_confidence < 80 ? (
                  <span className="text-amber-200">Low confidence — verify this date</span>
                ) : null}
              </div>
            ))}
            {rejectedCount > 0 ? (
              <p className="pt-2 text-slate-500">
                {rejectedCount} item(s) rejected and will not be published.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
          <p className="mb-2 text-sm text-slate-200">Your upcoming workload</p>
          {workloadByWeek.length === 0 ? (
            <p>No due dates detected in approved drafts.</p>
          ) : (
            <div className="space-y-1">
              {workloadByWeek.map(([week, count]) => (
                <p key={week}>
                  Week of {new Date(`${week}T00:00:00`).toLocaleDateString()}: {count} assignment
                  {count === 1 ? "" : "s"} due
                  {count >= 3
                    ? " · This week looks heavy. Travis can help you plan it after publishing."
                    : ""}
                </p>
              ))}
            </div>
          )}
          {lowConfidenceApprovedCount > 0 ? (
            <p className="mt-2 text-amber-200">
              {lowConfidenceApprovedCount} approved item(s) are below 80% confidence.
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200"
          >
            Go back and review
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={publishing}
            className="rounded-lg border border-sky-300/35 bg-sky-500/15 px-3 py-2 text-xs text-sky-100"
          >
            {publishing ? "Publishing..." : "Confirm and publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
