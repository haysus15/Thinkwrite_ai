"use client";

import { useEffect, useMemo, useState } from "react";

function challengeDescription(victorContext: unknown) {
  if (!victorContext || typeof victorContext !== "object") return "Untitled challenge";
  const row = victorContext as Record<string, unknown>;
  return String(row.challenge_description || "Untitled challenge");
}

export default function CodeReviewCompletionPanel({
  reviewId,
  language,
  code,
  victorContext,
  onBackToAssignment,
}: {
  reviewId: string;
  language: string;
  code: string;
  victorContext: unknown;
  onBackToAssignment?: () => void;
}) {
  const [assessment, setAssessment] = useState<string | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const challenge = useMemo(() => challengeDescription(victorContext), [victorContext]);
  const linesOfCode = useMemo(() => code.split("\n").filter((line) => line.trim().length > 0).length, [code]);

  useEffect(() => {
    let active = true;
    const runQualitySnapshot = async () => {
      if (!challenge.trim() || !code.trim()) {
        setAssessment(null);
        return;
      }
      setLoadingAssessment(true);
      setAssessmentError(null);
      try {
        const response = await fetch("/api/code-review/quality-snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_id: reviewId,
            challenge_description: challenge,
            code_content: code,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to run quality snapshot.");
        }
        if (active) setAssessment(String(data?.assessment || ""));
      } catch (error) {
        if (!active) return;
        setAssessmentError(
          error instanceof Error ? error.message : "Unable to run quality snapshot."
        );
      } finally {
        if (active) setLoadingAssessment(false);
      }
    };

    void runQualitySnapshot();
    return () => {
      active = false;
    };
  }, [challenge, code, reviewId]);

  return (
    <section className="space-y-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
      <h3 className="text-sm font-semibold text-emerald-100">Challenge complete</h3>
      <p className="text-xs text-emerald-50/90">{challenge}</p>
      <div className="grid gap-2 text-xs text-emerald-50/90 md:grid-cols-2">
        <p>Language: {language || "Not set"}</p>
        <p>{linesOfCode} lines of code</p>
      </div>

      <div className="rounded-lg border border-white/15 bg-white/5 p-3">
        <p className="text-xs font-medium text-emerald-50">Quick review</p>
        {loadingAssessment && <p className="mt-1 text-xs text-emerald-50/80">Reviewing code...</p>}
        {!loadingAssessment && assessment && <p className="mt-1 text-xs text-emerald-50/90">{assessment}</p>}
        {assessmentError && <p className="mt-1 text-xs text-rose-200">{assessmentError}</p>}
      </div>

      <div className="rounded-lg border border-white/15 bg-white/5 p-3">
        <p className="text-xs font-medium text-emerald-50">Victor reflection offer</p>
        <p className="mt-1 text-xs text-emerald-50/90">
          Review with Victor: Walk through your implementation decisions and one improvement path.
        </p>
      </div>

      {onBackToAssignment && (
        <button
          type="button"
          onClick={onBackToAssignment}
          className="rounded-full border border-emerald-200/40 bg-emerald-100/10 px-3 py-1.5 text-xs text-emerald-50"
        >
          Back to assignment
        </button>
      )}
    </section>
  );
}
