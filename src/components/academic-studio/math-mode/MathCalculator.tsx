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
}: {
  visible: boolean;
  onToggle: () => void;
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
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">Calculator</h4>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-slate-300"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>

      {visible ? (
        <div className="mt-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200">
            {expression || "0"}
          </div>
          {result && (
            <div className="mt-2 text-xs text-emerald-300">Result: {result}</div>
          )}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {BUTTONS.map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => setExpression((prev) => prev + btn)}
                className="rounded-lg border border-white/10 bg-white/[0.03] py-2 text-xs text-slate-200"
              >
                {btn}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="col-span-2 rounded-lg border border-white/10 bg-white/[0.06] py-2 text-xs text-slate-200"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleEvaluate}
              className="col-span-2 rounded-lg border border-emerald-400/40 bg-emerald-500/20 py-2 text-xs text-emerald-200"
            >
              Evaluate
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">Calculator hidden.</p>
      )}
    </div>
  );
}
