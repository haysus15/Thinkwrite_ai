"use client";

import type { StepStatus } from "@/types/math-mode";

export default function VerificationFeedback({
  status,
  feedback,
}: {
  status: StepStatus;
  feedback?: string;
}) {
  if (!feedback) return null;

  const colorClass =
    status === "correct" || status === "equivalent_form"
      ? "text-emerald-800"
      : status === "incorrect" || status === "error"
      ? "text-red-800"
      : status === "likely_correct"
      ? "text-teal-800"
      : status === "needs_recheck"
      ? "text-amber-800"
      : "text-amber-900";

  return (
    <p className={`mt-2 text-sm leading-6 ${colorClass}`}>
      {feedback}
    </p>
  );
}
