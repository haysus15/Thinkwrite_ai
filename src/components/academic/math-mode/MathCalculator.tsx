"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations();
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const handleEvaluate = () => {
    try {
      const value = evaluate(expression);
      setResult(String(value));
    } catch {
      setResult(t("errors.generic"));
    }
  };

  const handleClear = () => {
    setExpression("");
    setResult(null);
  };

  return (
    <div className="max-h-full overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">{t("academic.mathMode.calculator.title")}</h4>
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300 transition hover:bg-white/[0.08]"
          >
            {visible ? t("global.close") : t("global.view")}
          </button>
        )}
      </div>

      {visible ? (
        <div className="mt-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-100">
            {expression || "0"}
          </div>
          {result && (
            <div className="mt-2 text-xs text-emerald-200">{t("academic.mathMode.calculator.result", { result })}</div>
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
              {t("global.reset")}
            </button>
            <button
              type="button"
              onClick={handleEvaluate}
              className="col-span-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 py-2 text-xs text-emerald-200"
            >
              {t("academic.mathMode.calculator.evaluate")}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{t("academic.mathMode.calculator.hidden")}</p>
      )}
    </div>
  );
}
