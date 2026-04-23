"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("academic.paperWorkflow.completion");
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
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            paper_id: paperId,
            rubric_text: rubricText,
            paper_content: paperContent,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || t("errors.rubricCheck"));
        }
        if (active) setAssessment(String(data?.assessment || ""));
      } catch (error) {
        if (!active) return;
        setAssessmentError(
          error instanceof Error ? error.message : t("errors.rubricCheck")
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
      <h3 className="text-sm font-semibold text-emerald-100">{t("title")}</h3>
      <p className="text-xs text-emerald-50/90">{topic || t("untitledPaper")}</p>
      <div className="grid gap-2 text-xs text-emerald-50/90 md:grid-cols-2">
        <p>{t("words", { count: wordCount })}</p>
        <p>{t("fromOutlineToDraft")}</p>
      </div>

      {rubricText?.trim() ? (
        <div className="rounded-lg border border-white/15 bg-white/5 p-3">
          <p className="text-xs font-medium text-emerald-50">{t("rubricCheck")}</p>
          {loadingAssessment && <p className="mt-1 text-xs text-emerald-50/80">{t("checkingRubric")}</p>}
          {!loadingAssessment && assessment && <p className="mt-1 text-xs text-emerald-50/90">{assessment}</p>}
          {assessmentError && <p className="mt-1 text-xs text-rose-200">{assessmentError}</p>}
        </div>
      ) : null}

      <div className="rounded-lg border border-white/15 bg-white/5 p-3">
        <p className="text-xs font-medium text-emerald-50">{t("victorReflection")}</p>
        <p className="mt-1 text-xs text-emerald-50/90">
          {assessment && !assessmentError
            ? t("reviewWithVictor")
            : t("reflectWithVictor")}
        </p>
      </div>

      {onBackToAssignment && (
        <button
          type="button"
          onClick={onBackToAssignment}
          className="rounded-full border border-emerald-200/40 bg-emerald-100/10 px-3 py-1.5 text-xs text-emerald-50"
        >
          {t("backToAssignment")}
        </button>
      )}
    </section>
  );
}
