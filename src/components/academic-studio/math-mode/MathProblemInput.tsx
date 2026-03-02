"use client";

import { useEffect, useRef } from "react";
import "mathlive";
type MathfieldElement = any;
import MathSymbolPalette from "./MathSymbolPalette";
import MathLatexDisplay from "./MathLatexDisplay";

export default function MathProblemInput({
  latex,
  onLatexChange,
  onStart,
  onActiveFieldChange,
  variant = "panel",
}: {
  latex: string;
  onLatexChange: (value: string) => void;
  onStart: () => void;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
  variant?: "panel" | "dock";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || fieldRef.current) return;
    const MathfieldElementCtor = (window as any).MathfieldElement;
    if (!MathfieldElementCtor) return;
    const mf = new MathfieldElementCtor();
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
      if (symbol === "⌫") {
        if (typeof fieldRef.current.executeCommand === "function") {
          fieldRef.current.executeCommand("deleteBackward");
        } else if (typeof fieldRef.current.keystroke === "function") {
          fieldRef.current.keystroke("Backspace");
        }
        fieldRef.current.focus();
        return;
      }
      if (symbol === "←") {
        if (typeof fieldRef.current.executeCommand === "function") {
          fieldRef.current.executeCommand("moveToPreviousChar");
        } else if (typeof fieldRef.current.keystroke === "function") {
          fieldRef.current.keystroke("Left");
        }
        fieldRef.current.focus();
        return;
      }
      if (symbol === "→") {
        if (typeof fieldRef.current.executeCommand === "function") {
          fieldRef.current.executeCommand("moveToNextChar");
        } else if (typeof fieldRef.current.keystroke === "function") {
          fieldRef.current.keystroke("Right");
        }
        fieldRef.current.focus();
        return;
      }
      fieldRef.current.insert(symbol);
      fieldRef.current.focus();
    }
  };

  const isDock = variant === "dock";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          {!isDock && (
            <>
              <h3 className="text-sm font-semibold text-white">Problem</h3>
              <p className="mt-1 text-xs text-slate-500">
                Use plain text or math notation. Keep it to one clear problem.
              </p>
            </>
          )}
          {isDock && (
            <p className="text-xs text-slate-400">
              Enter a problem to start your worksheet.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={!latex.trim()}
          className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 text-xs text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDock ? "Start" : "Start problem"}
        </button>
      </div>

      <div
        className={`${isDock ? "mt-2" : "mt-3"} rounded-lg border border-white/10 bg-white/[0.03] p-3`}
        ref={containerRef}
      />

      {latex && !isDock && (
        <MathLatexDisplay
          latex={latex}
          className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-100"
        />
      )}

      <div className={`${isDock ? "mt-2" : "mt-4"}`}>
        <MathSymbolPalette
          onInsert={handleInsert}
          variant={isDock ? "dock" : "default"}
        />
      </div>
    </div>
  );
}
