"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import "mathlive";
import MathSymbolPalette from "./MathSymbolPalette";
import MathLatexDisplay from "./MathLatexDisplay";
import {
  getMathfieldElementConstructor,
  type MathfieldElement,
} from "./mathfield";

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
  variant?: "panel" | "dock" | "document";
}) {
  const t = useTranslations();
  const backspaceKey = "backspace";
  const leftKey = "left";
  const rightKey = "right";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const isDock = variant === "dock";
  const isDocument = variant === "document";

  useEffect(() => {
    if (!containerRef.current || fieldRef.current) return;
    const MathfieldElementCtor = getMathfieldElementConstructor(window);
    if (!MathfieldElementCtor) return;
    const mf = new MathfieldElementCtor();
    mf.value = latex;
    if (isDocument) {
      mf.style.width = "100%";
      mf.style.minHeight = "52px";
      mf.style.fontSize = "1.1rem";
      mf.style.background = "transparent";
      mf.style.border = "none";
      mf.style.color = "rgb(241 245 249)";
      mf.style.padding = "8px 0";
    }
    mf.addEventListener("input", () => onLatexChange(mf.value));
    mf.addEventListener("focus", () => onActiveFieldChange(mf));
    mf.addEventListener("blur", () => {
      window.setTimeout(() => onActiveFieldChange(null), 80);
    });
    containerRef.current.appendChild(mf);
    fieldRef.current = mf;

    return () => {
      mf.remove();
      fieldRef.current = null;
    };
    // Intentionally mount once to keep focus stable while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDocument]);

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
          fieldRef.current.keystroke(
            backspaceKey[0].toUpperCase() + backspaceKey.slice(1)
          );
        }
        fieldRef.current.focus();
        return;
      }
      if (symbol === "←") {
        if (typeof fieldRef.current.executeCommand === "function") {
          fieldRef.current.executeCommand("moveToPreviousChar");
        } else if (typeof fieldRef.current.keystroke === "function") {
          fieldRef.current.keystroke(leftKey[0].toUpperCase() + leftKey.slice(1));
        }
        fieldRef.current.focus();
        return;
      }
      if (symbol === "→") {
        if (typeof fieldRef.current.executeCommand === "function") {
          fieldRef.current.executeCommand("moveToNextChar");
        } else if (typeof fieldRef.current.keystroke === "function") {
          fieldRef.current.keystroke(rightKey[0].toUpperCase() + rightKey.slice(1));
        }
        fieldRef.current.focus();
        return;
      }
      if (typeof fieldRef.current.insert === "function") {
        fieldRef.current.insert(symbol);
      }
      fieldRef.current.focus();
    }
  };

  return (
    <div
      className={
        isDocument
          ? "p-0"
          : "rounded-2xl border border-white/10 bg-slate-950/70 p-5"
      }
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          {!isDock && !isDocument && (
            <>
              <h3 className="text-sm font-semibold text-white">{t("academic.entry.problem")}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {t("academic.entry.problemHint")}
              </p>
            </>
          )}
          {isDock && !isDocument && (
            <p className="text-xs text-slate-400">
              {t("academic.entry.problemDockHint")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={!latex.trim()}
          className={
            isDocument
              ? "text-xs uppercase tracking-[0.14em] text-sky-200 transition disabled:cursor-not-allowed disabled:opacity-50"
              : "rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 text-xs text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          }
        >
          {isDock ? t("academic.entry.start") : t("academic.entry.startProblem")}
        </button>
      </div>

      <div
        className={`${
          isDock ? "mt-2" : "mt-3"
        } ${isDocument ? "rounded-none border-b border-white/20 bg-transparent p-1" : "rounded-lg border border-white/10 bg-white/[0.03] p-3"}`}
        ref={containerRef}
      />

      {latex && !isDock && !isDocument && (
        <MathLatexDisplay
          latex={latex}
          className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-100"
        />
      )}

      {!isDocument && (
        <div className={`${isDock ? "mt-2" : "mt-4"}`}>
          <MathSymbolPalette
            onInsert={handleInsert}
            variant={isDock ? "dock" : "default"}
          />
        </div>
      )}
    </div>
  );
}
