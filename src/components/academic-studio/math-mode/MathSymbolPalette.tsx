"use client";

import { useMemo, useState } from "react";

const SYMBOLS = {
  basic: ["+", "-", "×", "÷", "=", "≠", "<", ">", "≤", "≥", "±"],
  powers: ["x²", "x³", "xⁿ", "√", "∛", "ⁿ√"],
  fractions: ["½", "⅓", "¼", "a/b"],
  calculus: ["∫", "∂", "d/dx", "∑", "∏", "∞", "lim"],
  trig: [
    "sin",
    "cos",
    "tan",
    "cot",
    "sec",
    "csc",
    "arcsin",
    "arccos",
    "arctan",
  ],
  greek: ["π", "θ", "α", "β", "γ", "δ", "Δ", "λ", "μ", "σ", "Σ", "φ", "ω"],
  other: ["(", ")", "[", "]", "{", "}", "|x|", "log", "ln", "e"],
};

type CategoryKey = keyof typeof SYMBOLS;

export default function MathSymbolPalette({
  onInsert,
}: {
  onInsert: (symbol: string) => void;
}) {
  const categories = useMemo(() => Object.keys(SYMBOLS) as CategoryKey[], []);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("basic");

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto text-xs">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`rounded-full border px-3 py-1.5 uppercase tracking-[0.2em] transition ${
              activeCategory === category
                ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-white/[0.03] text-slate-400"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {SYMBOLS[activeCategory].map((symbol) => (
          <button
            key={symbol}
            type="button"
            onClick={() => onInsert(symbol)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-xs text-slate-200 transition hover:bg-white/[0.08]"
          >
            {symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
