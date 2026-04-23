"use client";

import type { MathProblem } from "@/types/math-mode";

export default function FinalAnswersReference({
  problems,
}: {
  problems: MathProblem[];
}) {
  return (
    <section className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h4 className="text-sm font-medium text-slate-100">Your answers — for reference</h4>
      <div className="space-y-1.5">
        {problems.map((problem) => (
          <div
            key={problem.id}
            className="rounded border border-white/10 bg-slate-950/30 p-2"
          >
            <p className="text-xs text-slate-300">Problem {problem.set_order || "?"}</p>
            <p className="mt-1 text-xs text-slate-100">{problem.latex}</p>
            {problem.plain_text && (
              <p className="mt-1 text-[11px] text-slate-400">{problem.plain_text}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
