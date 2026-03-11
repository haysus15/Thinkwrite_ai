"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import "mathlive";
import type { MathStep } from "@/types/math-mode";
import StepStatusBadge from "./StepStatusBadge";
import VerificationFeedback from "./VerificationFeedback";
import {
  getMathfieldElementConstructor,
  type MathfieldElement,
} from "./mathfield";

export default function MathStepEditor({
  step,
  stepNumber,
  onUpdate,
  onVerify,
  onDelete,
  onAddStep,
  onFlagForReview,
  onHint,
  onAskVictor,
  onMarkFinalAnswer,
  isLastStep,
  isCompletingSession,
  isWorkspaceLocked,
  onActiveFieldChange,
  isVerifying,
}: {
  step: MathStep;
  stepNumber: number;
  onUpdate: (id: string, latex: string, reasoning?: string) => void;
  onVerify: (id: string) => void;
  onDelete: (id: string) => void;
  onAddStep: () => void;
  onFlagForReview: (id: string) => void;
  onHint?: () => void;
  onAskVictor?: () => void;
  onMarkFinalAnswer?: (id: string) => void;
  isLastStep?: boolean;
  isCompletingSession?: boolean;
  isWorkspaceLocked?: boolean;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
  isVerifying?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const [isEditing, setIsEditing] = useState(
    step.status === "unchecked" ||
      step.status === "needs_recheck" ||
      !step.latex.trim()
  );

  useEffect(() => {
    if (!containerRef.current || fieldRef.current) return;
    const MathfieldElementCtor = getMathfieldElementConstructor(window);
    if (!MathfieldElementCtor) return;
    const mf = new MathfieldElementCtor();
    mf.value = step.latex;
    mf.addEventListener("input", () =>
      onUpdate(step.id, mf.value, step.reasoning)
    );
    mf.addEventListener("focus", () => onActiveFieldChange(mf));
    mf.addEventListener("blur", () => {
      window.setTimeout(() => onActiveFieldChange(null), 80);
    });
    mf.readOnly = !isEditing;
    containerRef.current.appendChild(mf);
    fieldRef.current = mf;
    if (!step.latex.trim() && stepNumber === 1) {
      window.setTimeout(() => {
        mf.focus?.();
        onActiveFieldChange(mf);
      }, 50);
    }

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

  useEffect(() => {
    if (
      step.status === "unchecked" ||
      step.status === "needs_recheck" ||
      !step.latex.trim()
    ) {
      setIsEditing(true);
    }
  }, [step.status, step.latex]);

  useEffect(() => {
    if (fieldRef.current) {
      fieldRef.current.readOnly = !isEditing || Boolean(isWorkspaceLocked);
    }
  }, [isEditing, isWorkspaceLocked]);

  const primaryAction = (() => {
    if (step.status === "correct" || step.status === "equivalent_form" || step.status === "likely_correct") {
      return {
        label: "Add next step",
        onClick: () => onAddStep(),
        disabled: Boolean(isWorkspaceLocked),
      };
    }
    if (step.status === "incorrect" || step.status === "error" || step.status === "partial") {
      return {
        label: "Edit step",
        onClick: () => {
          if (isWorkspaceLocked) return;
          setIsEditing(true);
          fieldRef.current?.focus?.();
          if (fieldRef.current) onActiveFieldChange(fieldRef.current);
        },
        disabled: Boolean(isWorkspaceLocked),
      };
    }
    return {
      label: step.status === "needs_recheck" ? "Re-verify" : "Verify",
      onClick: () => onVerify(step.id),
      disabled: !step.latex.trim() || Boolean(isWorkspaceLocked),
    };
  })();
  const primaryLabel =
    isVerifying &&
    (primaryAction.label === "Verify" || primaryAction.label === "Re-verify")
      ? "Verifying..."
      : primaryAction.label;
  const primaryDisabled =
    Boolean(primaryAction.disabled) ||
    Boolean(isVerifying) ||
    Boolean(isWorkspaceLocked);

  const canMarkFinalAnswer =
    Boolean(isLastStep) &&
    (step.status === "correct" || step.status === "equivalent_form");

  const secondaryAction = (() => {
    if (isWorkspaceLocked) return null;
    if (step.status === "unchecked") {
      return { label: "Request hint", onClick: () => onHint?.(), disabled: !onHint };
    }
    if (step.status === "equivalent_form") {
      return {
        label: "See note",
        onClick: () => feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        disabled: false,
      };
    }
    if (step.status === "likely_correct") {
      return {
        label: "Flag for review",
        onClick: () => onFlagForReview(step.id),
        disabled: false,
      };
    }
    if (step.status === "incorrect" || step.status === "error" || step.status === "partial") {
      return { label: "Request hint", onClick: () => onHint?.(), disabled: !onHint };
    }
    return null;
  })();

  return (
    <div className="group border-b border-white/10 pb-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="text-sm font-semibold text-slate-100">Step {stepNumber}</span>
          <StepStatusBadge status={step.status} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryDisabled}
            className="rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {primaryLabel}
          </button>
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {secondaryAction.label}
            </button>
          )}
          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                if (isWorkspaceLocked) return;
                setIsEditing(true);
                fieldRef.current?.focus?.();
                if (fieldRef.current) onActiveFieldChange(fieldRef.current);
              }}
              disabled={Boolean(isWorkspaceLocked)}
              className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[10px] text-slate-300 opacity-0 transition group-hover:opacity-100"
              title="Edit step"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onAskVictor?.()}
            disabled={!onAskVictor || Boolean(isWorkspaceLocked)}
            className="rounded-full border border-violet-300/35 bg-violet-500/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-violet-100"
          >
            Ask Victor
          </button>
          <button
            type="button"
            onClick={() => onDelete(step.id)}
            disabled={Boolean(isWorkspaceLocked)}
            className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3 border-b border-white/10 pb-2" ref={containerRef} />

      <textarea
        value={step.reasoning || ""}
        onChange={(event) => onUpdate(step.id, step.latex, event.target.value)}
        placeholder="Why is this transformation valid?"
        rows={2}
        disabled={Boolean(isWorkspaceLocked)}
        className="mt-2 w-full border-none bg-transparent px-0 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
      />

      <div ref={feedbackRef}>
        <VerificationFeedback status={step.status} feedback={step.feedback} />
      </div>

      {canMarkFinalAnswer && (
        <div className="mt-2">
          <button
            type="button"
            disabled={Boolean(isWorkspaceLocked) || Boolean(isCompletingSession)}
            onClick={() => onMarkFinalAnswer?.(step.id)}
            className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCompletingSession ? "Completing..." : step.is_final_answer ? "Final answer marked" : "Mark as final answer"}
          </button>
        </div>
      )}
    </div>
  );
}
