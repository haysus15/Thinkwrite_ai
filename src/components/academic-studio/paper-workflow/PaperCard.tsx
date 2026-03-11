"use client";

type PaperItem = {
  id: string;
  set_order: number | null;
  topic: string;
  outline_id: string | null;
  paper_content: string;
  is_complete: boolean;
  word_count: number | null;
  workflow_step?: string | null;
};

function deriveStatus(paper: PaperItem): "Not started" | "Outline in progress" | "Draft in progress" | "Complete" {
  if (paper.is_complete) return "Complete";
  const hasOutline = Boolean(paper.outline_id);
  const hasDraft = String(paper.paper_content || "").trim().length > 0;
  if (!hasOutline && !hasDraft) return "Not started";
  if (hasOutline && !hasDraft) return "Outline in progress";
  return "Draft in progress";
}

function statusClass(status: ReturnType<typeof deriveStatus>): string {
  if (status === "Complete") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "Draft in progress") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-200";
  }
  if (status === "Outline in progress") {
    return "border-sky-400/40 bg-sky-500/10 text-sky-200";
  }
  return "border-white/20 bg-white/5 text-slate-300";
}

export default function PaperCard({
  paper,
  onOpen,
}: {
  paper: PaperItem;
  onOpen: (paper: PaperItem) => void;
}) {
  const status = deriveStatus(paper);
  const preview = paper.topic?.trim() || "Untitled prompt";

  return (
    <button
      type="button"
      onClick={() => onOpen(paper)}
      className="w-full rounded-xl border border-white/10 bg-slate-950/30 p-3 text-left hover:border-sky-300/35"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-100">
            Paper {paper.set_order || "-"}
          </p>
          <p className="mt-1 text-xs text-slate-300">{preview.slice(0, 80)}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClass(status)}`}>
          {status}
        </span>
      </div>
      {paper.word_count ? (
        <p className="mt-2 text-[11px] text-slate-400">{paper.word_count} words</p>
      ) : null}
    </button>
  );
}
