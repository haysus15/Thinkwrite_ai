"use client";

type PaperReference = {
  id: string;
  set_order: number | null;
  topic: string;
};

export default function PaperFinalReferencePanel({ papers }: { papers: PaperReference[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h3 className="text-sm font-medium text-slate-100">Your papers — for reference</h3>
      <div className="mt-3 space-y-2">
        {papers.map((paper) => (
          <div key={paper.id} className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2">
            <p className="text-xs font-medium text-slate-200">Paper {paper.set_order || "-"}</p>
            <p className="mt-1 text-xs text-slate-300">{String(paper.topic || "").slice(0, 140)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
