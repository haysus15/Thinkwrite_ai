"use client";

import type { MathProblem } from "@/types/math-mode";

export default function MathProblemHistory({
  problems,
  onSelect,
}: {
  problems: MathProblem[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="glass-panel p-4">
      <h4 className="text-sm font-semibold text-white">Problem history</h4>
      <div className="mt-3 space-y-2 text-xs text-slate-300">
        {problems.length === 0 && (
          <p className="text-slate-500">No problems yet.</p>
        )}
        {problems.map((problem) => (
          <button
            key={problem.id}
            type="button"
            onClick={() => onSelect(problem.id)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.06]"
          >
            <p className="text-slate-200">{problem.latex || "Untitled"}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {new Date(problem.created_at).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
