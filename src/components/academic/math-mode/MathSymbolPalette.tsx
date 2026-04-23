"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

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
  floatingAnchor,
}: {
  onInsert: (symbol: string) => void;
  variant?: PaletteVariant;
  floatingAnchor?: { top: number; left: number; width: number } | null;
}) {
  const categories = useMemo(() => Object.keys(SYMBOLS) as CategoryKey[], []);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("basic");
  const isDock = variant === "dock";

  const palette = (
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
            onMouseDown={(event) => event.preventDefault()}
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
                    onMouseDown={(event) => event.preventDefault()}
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

  if (floatingAnchor && typeof document !== "undefined") {
    const viewportPadding = 10;
    const paletteWidth = Math.min(Math.max(floatingAnchor.width, 280), 560);
    const maxLeft = Math.max(
      viewportPadding,
      window.innerWidth - paletteWidth - viewportPadding
    );

    let top: number | undefined = floatingAnchor.top + 8;
    let left = Math.max(viewportPadding, Math.min(floatingAnchor.left, maxLeft));
    let bottom: number | undefined;
    let maxHeight = `calc(100vh - ${viewportPadding * 2}px)`;

    if (isDock) {
      const centerAlignedLeft = floatingAnchor.left + floatingAnchor.width / 2 - paletteWidth / 2;
      left = Math.max(viewportPadding, Math.min(centerAlignedLeft, maxLeft));
      bottom = viewportPadding;
      top = undefined;
      maxHeight = `${Math.max(220, window.innerHeight - viewportPadding * 2 - 6)}px`;
    } else {
      const paletteHeight = 230;
      const preferredTop = floatingAnchor.top + 8;
      const flipTop = floatingAnchor.top - paletteHeight - 8;
      top =
        preferredTop + paletteHeight > window.innerHeight - viewportPadding
          ? Math.max(viewportPadding, flipTop)
          : preferredTop;
    }

    return createPortal(
      <div
        data-math-floating-palette="true"
        onMouseDown={(event) => event.preventDefault()}
        style={{
          position: "fixed",
          top,
          left,
          bottom,
          width: paletteWidth,
          maxHeight,
          overflowY: "auto",
          zIndex: 80,
          padding: "8px",
          borderRadius: "12px",
          border: "1px solid rgba(148,163,184,0.3)",
          background: "rgba(2,6,23,0.94)",
          boxShadow: "0 18px 34px rgba(2,6,23,0.45)",
        }}
      >
        {palette}
      </div>,
      document.body
    );
  }

  return palette;
}
