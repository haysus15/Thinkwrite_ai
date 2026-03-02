"use client";

import { useState } from "react";
import { evaluate } from "mathjs";

const BUTTONS = [
  "7",
  "8",
  "9",
  "/",
  "4",
  "5",
  "6",
  "*",
  "1",
  "2",
  "3",
  "-",
  "0",
  ".",
  "(",
  ")",
  "+",
];

export default function MathCalculator({
  visible,
  onToggle,
  showToggle = true,
}: {
  visible: boolean;
  onToggle: () => void;
  showToggle?: boolean;
}) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const handleEvaluate = () => {
    try {
      const value = evaluate(expression);
      setResult(String(value));
    } catch {
      setResult("Error");
    }
  };

  const handleClear = () => {
    setExpression("");
    setResult(null);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">Quick calculator</h4>
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300 transition hover:bg-white/[0.08]"
          >
            {visible ? "Hide" : "Show"}
          </button>
        )}
      </div>

      {visible ? (
        <div className="mt-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-100">
            {expression || "0"}
          </div>
          {result && (
            <div className="mt-2 text-xs text-emerald-200">Result: {result}</div>
          )}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {BUTTONS.map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => setExpression((prev) => prev + btn)}
                className="rounded-lg border border-white/10 bg-white/[0.03] py-2 text-xs text-slate-100"
              >
                {btn}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="col-span-2 rounded-lg border border-white/10 bg-white/[0.06] py-2 text-xs text-slate-300"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleEvaluate}
              className="col-span-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 py-2 text-xs text-emerald-200"
            >
              Evaluate
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Calculator hidden.</p>
      )}
    </div>
  );
}
