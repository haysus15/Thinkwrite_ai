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
type PaletteVariant = "default" | "dock";

const DOCK_KEYPAD: string[][] = [
  ["(", ")", "|", "[", "]", "√", "∛", "≥"],
  ["x", "7", "8", "9", "=", "÷", "≠", "π"],
  ["y", "4", "5", "6", "/", "^", "≤", "∞"],
  ["z", "1", "2", "3", "-", "+", "<", ">"],
  ["abc", ",", "0", ".", "%", "∑", "∫", "log"],
  ["⌫", "←", "→", "", "", "", "", ""],
];

export default function MathSymbolPalette({
  onInsert,
  variant = "default",
}: {
  onInsert: (symbol: string) => void;
  variant?: PaletteVariant;
}) {
  const categories = useMemo(() => Object.keys(SYMBOLS) as CategoryKey[], []);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("basic");
  const isDock = variant === "dock";

  return (
    <div className={`space-y-${isDock ? "2" : "3"}`}>
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
      <div className={`grid ${isDock ? "grid-cols-8" : "grid-cols-6"} gap-2`}>
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
      {isDock && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
          <div className="space-y-2">
            {DOCK_KEYPAD.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="grid grid-cols-8 gap-2">
                {row.map((symbol, colIndex) => (
                  <button
                    key={`dock-${rowIndex}-${colIndex}-${symbol || "empty"}`}
                    type="button"
                    disabled={!symbol}
                    onClick={() => onInsert(symbol)}
                    className={`rounded-lg border px-2 py-1.5 text-xs transition ${
                      !symbol
                        ? "cursor-default border-transparent bg-transparent"
                        : ""
                    } ${
                      ["abc"].includes(symbol)
                        ? "border-white/10 bg-white/[0.05] text-slate-300"
                        : ["⌫", "←", "→"].includes(symbol)
                        ? "border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                        : "border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                    }`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
