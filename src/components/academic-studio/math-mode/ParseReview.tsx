"use client";

import { useMemo, useState } from "react";
import type { ParsedWorksheetProblem } from "@/lib/math-mode/worksheetParser";

export default function ParseReview({
  initialProblems,
  onConfirm,
  onBack,
  isSaving,
}: {
  initialProblems: ParsedWorksheetProblem[];
  onConfirm: (problems: ParsedWorksheetProblem[]) => void;
  onBack: () => void;
  isSaving?: boolean;
}) {
  const [problems, setProblems] = useState<ParsedWorksheetProblem[]>(
    initialProblems
  );

  const normalized = useMemo(
    () =>
      problems.map((problem, index) => ({
        ...problem,
        order: index + 1,
      })),
    [problems]
  );

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <header>
        <h3 className="text-sm font-medium text-slate-100">Review parsed problems</h3>
        <p className="mt-1 text-xs text-slate-400">
          Edit, delete, reorder, or add any missing item before saving.
        </p>
      </header>

      <div className="space-y-2">
        {normalized.map((problem, index) => (
          <div key={`${problem.order}-${index}`} className="rounded-lg border border-white/10 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-300">#{index + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setProblems((prev) => {
                      if (index === 0) return prev;
                      const next = [...prev];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      return next;
                    })
                  }
                  className="rounded border border-white/20 px-1.5 py-0.5 text-[11px] text-slate-200"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProblems((prev) => {
                      if (index === prev.length - 1) return prev;
                      const next = [...prev];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      return next;
                    })
                  }
                  className="rounded border border-white/20 px-1.5 py-0.5 text-[11px] text-slate-200"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProblems((prev) => prev.filter((_, idx) => idx !== index))
                  }
                  className="rounded border border-rose-300/30 px-1.5 py-0.5 text-[11px] text-rose-100"
                >
                  Delete
                </button>
              </div>
            </div>
            <textarea
              value={problem.raw_text}
              onChange={(event) =>
                setProblems((prev) =>
                  prev.map((row, idx) =>
                    idx === index ? { ...row, raw_text: event.target.value } : row
                  )
                )
              }
              rows={2}
              className="w-full rounded border border-white/20 bg-slate-950/30 p-2 text-xs text-slate-100"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setProblems((prev) => [
            ...prev,
            {
              order: prev.length + 1,
              raw_text: "",
              latex: null,
              problem_type: "other",
            },
          ])
        }
        className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
      >
        Add problem
      </button>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
        >
          Back
        </button>
        <button
          type="button"
          disabled={Boolean(isSaving) || normalized.length === 0}
          onClick={() => onConfirm(normalized)}
          className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Confirm problems"}
        </button>
      </div>
    </section>
  );
}
