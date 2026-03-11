"use client";

import { useEffect, useState } from "react";

export default function PaperCompletionPanel({
  paperId,
  topic,
  paperContent,
  rubricText,
  onBackToAssignment,
}: {
  paperId: string;
  topic: string;
  paperContent: string;
  rubricText?: string | null;
  onBackToAssignment?: () => void;
}) {
  const [assessment, setAssessment] = useState<string | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const wordCount = paperContent.trim().split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    let active = true;
    const runRubricCheck = async () => {
      if (!rubricText?.trim() || !paperContent.trim()) {
        setAssessment(null);
        return;
      }
      setLoadingAssessment(true);
      setAssessmentError(null);
      try {
        const response = await fetch("/api/paper/rubric-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paper_id: paperId,
            rubric_text: rubricText,
            paper_content: paperContent,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to run rubric self-check.");
        }
        if (active) setAssessment(String(data?.assessment || ""));
      } catch (error) {
        if (!active) return;
        setAssessmentError(
          error instanceof Error ? error.message : "Unable to run rubric self-check."
        );
      } finally {
        if (active) setLoadingAssessment(false);
      }
    };

    void runRubricCheck();
    return () => {
      active = false;
    };
  }, [paperContent, paperId, rubricText]);

  return (
    <section className="space-y-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
      <h3 className="text-sm font-semibold text-emerald-100">Paper complete</h3>
      <p className="text-xs text-emerald-50/90">{topic || "Untitled paper"}</p>
      <div className="grid gap-2 text-xs text-emerald-50/90 md:grid-cols-2">
        <p>{wordCount} words</p>
        <p>You moved from outline to full draft.</p>
      </div>

      {rubricText?.trim() ? (
        <div className="rounded-lg border border-white/15 bg-white/5 p-3">
          <p className="text-xs font-medium text-emerald-50">Rubric self-check</p>
          {loadingAssessment && <p className="mt-1 text-xs text-emerald-50/80">Checking rubric...</p>}
          {!loadingAssessment && assessment && <p className="mt-1 text-xs text-emerald-50/90">{assessment}</p>}
          {assessmentError && <p className="mt-1 text-xs text-rose-200">{assessmentError}</p>}
        </div>
      ) : null}

      <div className="rounded-lg border border-white/15 bg-white/5 p-3">
        <p className="text-xs font-medium text-emerald-50">Victor reflection offer</p>
        <p className="mt-1 text-xs text-emerald-50/90">
          {assessment && !assessmentError
            ? "Review with Victor: Walk through where the paper could better address the assignment."
            : "Reflect with Victor: Talk through your argument and where it could go deeper."}
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
