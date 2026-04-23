"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";

function challengeDescription(victorContext: unknown) {
  if (!victorContext || typeof victorContext !== "object") return "";
  const row = victorContext as Record<string, unknown>;
  return String(row.challenge_description || "");
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
  const t = useTranslations("academic.codeReviewMode.completion");
  const { profile } = useAuth();
  const [assessment, setAssessment] = useState<string | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const challenge = useMemo(
    () => challengeDescription(victorContext) || t("untitledChallenge"),
    [t, victorContext]
  );
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
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            review_id: reviewId,
            challenge_description: challenge,
            code_content: code,
            outputLanguage: profile?.preferred_language || "en",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || t("errors.qualitySnapshot"));
        }
        if (active) setAssessment(String(data?.assessment || ""));
      } catch (error) {
        if (!active) return;
        setAssessmentError(
          error instanceof Error ? error.message : t("errors.qualitySnapshot")
        );
      } finally {
        if (active) setLoadingAssessment(false);
      }
    };

    void runQualitySnapshot();
    return () => {
      active = false;
    };
  }, [challenge, code, profile?.preferred_language, reviewId]);

  return (
    <section className="space-y-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4">
      <h3 className="text-sm font-semibold text-emerald-100">{t("title")}</h3>
      <p className="text-xs text-emerald-50/90">{challenge}</p>
      <div className="grid gap-2 text-xs text-emerald-50/90 md:grid-cols-2">
        <p>{t("language", { language: language || t("notSet") })}</p>
        <p>{t("linesOfCode", { count: linesOfCode })}</p>
      </div>

      <div className="rounded-lg border border-white/15 bg-white/5 p-3">
        <p className="text-xs font-medium text-emerald-50">{t("quickReview")}</p>
        {loadingAssessment && <p className="mt-1 text-xs text-emerald-50/80">{t("reviewingCode")}</p>}
        {!loadingAssessment && assessment && <p className="mt-1 text-xs text-emerald-50/90">{assessment}</p>}
        {assessmentError && <p className="mt-1 text-xs text-rose-200">{assessmentError}</p>}
      </div>

      <div className="rounded-lg border border-white/15 bg-white/5 p-3">
        <p className="text-xs font-medium text-emerald-50">{t("victorReflection")}</p>
        <p className="mt-1 text-xs text-emerald-50/90">
          {t("victorReflectionBody")}
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
