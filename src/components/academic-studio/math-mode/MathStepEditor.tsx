"use client";

import { useEffect, useRef } from "react";
import { MathfieldElement } from "mathlive";
import { AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";
import type { MathStep, StepStatus } from "@/types/math-mode";

const statusIcon = (status: StepStatus) => {
  switch (status) {
    case "correct":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-400" />;
    case "partial":
      return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    default:
      return <Circle className="h-4 w-4 text-slate-500" />;
  }
};

export default function MathStepEditor({
  step,
  stepNumber,
  onUpdate,
  onVerify,
  onDelete,
  onActiveFieldChange,
}: {
  step: MathStep;
  stepNumber: number;
  onUpdate: (id: string, latex: string, reasoning?: string) => void;
  onVerify: (id: string) => void;
  onDelete: (id: string) => void;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || fieldRef.current) return;
    const mf = new MathfieldElement();
    mf.value = step.latex;
    mf.addEventListener("input", () =>
      onUpdate(step.id, mf.value, step.reasoning)
    );
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
    if (fieldRef.current && fieldRef.current.value !== step.latex) {
      fieldRef.current.value = step.latex;
    }
  }, [step.latex]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          {statusIcon(step.status)}
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Step {stepNumber}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onVerify(step.id)}
            className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-xs text-sky-200"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={() => onDelete(step.id)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3" ref={containerRef} />

      <textarea
        value={step.reasoning || ""}
        onChange={(event) => onUpdate(step.id, step.latex, event.target.value)}
        placeholder="Explain the step in plain language."
        rows={2}
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500"
      />

      {step.feedback && (
        <p
          className={`mt-3 text-xs ${
            step.status === "correct"
              ? "text-emerald-300"
              : step.status === "error"
              ? "text-red-300"
              : "text-amber-300"
          }`}
        >
          {step.feedback}
        </p>
      )}
    </div>
  );
}
