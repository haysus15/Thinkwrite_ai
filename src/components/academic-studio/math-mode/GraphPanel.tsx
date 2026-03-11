"use client";

import MathGraphPanel from "./MathGraphPanel";

export default function GraphPanel({
  graphSource,
  graphExpression,
  customGraphExpression,
  onGraphSourceChange,
  onCustomGraphExpressionChange,
}: {
  graphSource: "problem" | "latest_step" | "custom";
  graphExpression: string;
  customGraphExpression: string;
  onGraphSourceChange: (value: "problem" | "latest_step" | "custom") => void;
  onCustomGraphExpressionChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Graph source
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onGraphSourceChange("problem")}
            className={`rounded-md border px-2 py-1 ${
              graphSource === "problem"
                ? "border-sky-400/40 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-white/[0.03] text-slate-300"
            }`}
          >
            Problem
          </button>
          <button
            type="button"
            onClick={() => onGraphSourceChange("latest_step")}
            className={`rounded-md border px-2 py-1 ${
              graphSource === "latest_step"
                ? "border-sky-400/40 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-white/[0.03] text-slate-300"
            }`}
          >
            Latest step
          </button>
          <button
            type="button"
            onClick={() => onGraphSourceChange("custom")}
            className={`rounded-md border px-2 py-1 ${
              graphSource === "custom"
                ? "border-sky-400/40 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-white/[0.03] text-slate-300"
            }`}
          >
            Custom
          </button>
        </div>
        {graphSource === "custom" && (
          <input
            value={customGraphExpression}
            onChange={(event) => onCustomGraphExpressionChange(event.target.value)}
            placeholder="e.g., x^2 + 3*x - 4"
            className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-100"
          />
        )}
      </div>
      <MathGraphPanel expression={graphExpression} visible onToggle={() => null} showToggle={false} />
    </div>
  );
}

