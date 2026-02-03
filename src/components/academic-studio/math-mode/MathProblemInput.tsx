"use client";

import { useEffect, useRef } from "react";
import { MathfieldElement } from "mathlive";
import MathSymbolPalette from "./MathSymbolPalette";
import MathLatexDisplay from "./MathLatexDisplay";

export default function MathProblemInput({
  latex,
  onLatexChange,
  onStart,
  onActiveFieldChange,
}: {
  latex: string;
  onLatexChange: (value: string) => void;
  onStart: () => void;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || fieldRef.current) return;
    const mf = new MathfieldElement();
    mf.value = latex;
    mf.addEventListener("input", () => onLatexChange(mf.value));
    mf.addEventListener("focus", () => onActiveFieldChange(mf));
    containerRef.current.appendChild(mf);
    fieldRef.current = mf;

    return () => {
      mf.remove();
      fieldRef.current = null;
    };
    // Intentionally mount once to keep focus stable while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fieldRef.current && fieldRef.current.value !== latex) {
      fieldRef.current.value = latex;
    }
  }, [latex]);

  const handleInsert = (symbol: string) => {
    if (fieldRef.current) {
      fieldRef.current.insert(symbol);
      fieldRef.current.focus();
    }
  };

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Problem input
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Enter the problem
          </h3>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="rounded-xl border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-xs text-sky-100 transition hover:bg-sky-500/30"
        >
          Start problem
        </button>
      </div>

      <div className="mt-4" ref={containerRef} />

      {latex && (
        <MathLatexDisplay
          latex={latex}
          className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-slate-100"
        />
      )}

      <div className="mt-5">
        <MathSymbolPalette onInsert={handleInsert} />
      </div>
    </div>
  );
}
