// src/components/academic/paper-workflow/UnderstandingCheckpoint.tsx
"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import type { IntakeConversationEntry } from "@/components/academic/outline/outlineTypes";
import EmergencySkipModal from "./EmergencySkipModal";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";

type CheckpointQuestion = {
  question: string;
  targetGoal?: number;
  hint?: string;
};

interface UnderstandingCheckpointProps {
  paperId: string | null;
  intakeConversationHistory?: IntakeConversationEntry[];
  onBack: () => void;
  onStatusChange?: (status: {
    checkpointPassed: boolean;
    emergencySkipUsed: boolean;
  }) => void;
}

export default function UnderstandingCheckpoint({
  paperId,
  intakeConversationHistory,
  onBack,
  onStatusChange,
}: UnderstandingCheckpointProps) {
  const t = useTranslations("academic.paperWorkflow.checkpoint");
  const { profile } = useAuth();
  const prompts = useMemo(
    () => [
      t("prompts.thesis"),
      t("prompts.evidence"),
      t("prompts.conclusion"),
    ],
    [t]
  );
  const [responses, setResponses] = useState<string[]>(
    prompts.map(() => "")
  );
  const [generatedQuestions, setGeneratedQuestions] = useState<CheckpointQuestion[] | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipLoadError, setSkipLoadError] = useState<string | null>(null);
  const [skipEligible, setSkipEligible] = useState(false);
  const [skipUsedCount, setSkipUsedCount] = useState(0);
  const [showSkipModal, setShowSkipModal] = useState(false);

  const loadSkipStatus = async () => {
    try {
      const response = await fetch("/api/academic/paper/can-skip");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("errors.loadSkipEligibility"));
      }
      setSkipEligible(Boolean(data.eligible));
      setSkipUsedCount(Number(data.usedCount || 0));
      setSkipLoadError(null);
    } catch {
      setSkipLoadError(
        t("errors.loadCheckpointStatus")
      );
    }
  };

  useEffect(() => {
    void loadSkipStatus();
  }, []);

  useEffect(() => {
    if (!paperId) return;

    let active = true;
    setQuestionsLoading(true);

    void fetch(`/api/academic/paper/checkpoint/${paperId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate_questions",
        paperId,
        intakeHistory: intakeConversationHistory ?? [],
      }),
    })
      .then(async (response) => response.json())
      .then((data) => {
        if (!active) return;
        const questions = Array.isArray(data?.questions)
          ? (data.questions as CheckpointQuestion[])
          : [];
        if (questions.length > 0) {
          setGeneratedQuestions(questions);
          setResponses(questions.map(() => ""));
        }
      })
      .catch(() => {
        // Fall back to static prompts.
      })
      .finally(() => {
        if (active) {
          setQuestionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [intakeConversationHistory, paperId]);

  if (!paperId) {
    return (
      <AcademicEmptyState
        title={t("noPaperTitle")}
        description={t("noPaperDescription")}
      />
    );
  }

  if (questionsLoading) {
    return <AcademicLoadingState message="Preparing Victor's checkpoint questions..." />;
  }

  const activePrompts =
    generatedQuestions?.length
      ? generatedQuestions.map((question) => question.question)
      : prompts;

  const handleSubmit = async () => {
    if (!paperId) {
      setError(t("errors.paperNotFound"));
      return;
    }
    if (responses.some((response) => !response.trim())) {
      setError(t("errors.answerEveryQuestion"));
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const conversation = activePrompts.flatMap((prompt, index) => [
        { role: "assistant", content: prompt },
        { role: "user", content: responses[index] },
      ]);

      const response = await fetch(
        `/api/academic/paper/checkpoint/${paperId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            conversation,
            outputLanguage: profile?.preferred_language || "en",
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.checkpointFailed"));
      }
      setResult(
        data.passed
          ? t("passed")
          : t("failed")
      );
      onStatusChange?.({
        checkpointPassed: Boolean(data.passed),
        emergencySkipUsed: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.checkpointFailed"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-sky-200" />
          <p className="text-sm font-semibold text-slate-100">
            {t("title")}
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          {t("subtitle")}
        </p>
        <div className="mt-4 space-y-3 text-sm text-slate-300">
          {activePrompts.map((prompt, index) => (
            <div key={prompt} className="space-y-2">
              <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3">
                {t("victorPrefix")} {prompt}
              </div>
              <textarea
                value={responses[index]}
                onChange={(event) => {
                  const next = [...responses];
                  next[index] = event.target.value;
                  setResponses(next);
                }}
                rows={3}
                placeholder={t("responsePlaceholder")}
                aria-label={t("responseAria", { index: index + 1 })}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
              />
              {generatedQuestions?.[index]?.hint ? (
                <p className="text-xs text-slate-500">{generatedQuestions[index]?.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-slate-100">{t("rulesTitle")}</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          <li>{t("rules.structure")}</li>
          <li>{t("rules.defend")}</li>
          <li>{t("rules.noExport")}</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t("submitting") : t("submitResponses")}
          </button>
          {skipEligible && (
            <button
              type="button"
              onClick={() => setShowSkipModal(true)}
              className="rounded-full border border-red-400/40 bg-red-500/10 px-5 py-2 text-sm text-red-200"
            >
              {t("emergencySkip")}
            </button>
          )}
        </div>
        {result && (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {result}
          </div>
        )}
        {error && (
          <AcademicErrorState message={error} className="mt-4 !min-h-0 py-3" />
        )}
        {skipLoadError && (
          <AcademicErrorState
            message={skipLoadError}
            retry={() => void loadSkipStatus()}
            className="mt-4 !min-h-0 py-3"
          />
        )}
      </div>

      <div className="flex items-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-white/30"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToGenerator")}
        </button>
      </div>

      <EmergencySkipModal
        isOpen={showSkipModal}
        usedCount={skipUsedCount}
        limit={1}
        onClose={() => setShowSkipModal(false)}
        onConfirm={async () => {
          if (!paperId) {
            setError(t("errors.paperNotFound"));
            setShowSkipModal(false);
            return;
          }
          try {
            const response = await fetch(
              `/api/academic/paper/emergency-skip/${paperId}`,
              { method: "POST" }
            );
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || t("errors.emergencySkipFailed"));
            }
            setResult(t("emergencySkipUsed"));
            setSkipEligible(false);
            setSkipUsedCount((prev) => prev + 1);
            onStatusChange?.({
              checkpointPassed: false,
              emergencySkipUsed: true,
            });
          } catch (err) {
            setError(
              err instanceof Error ? err.message : t("errors.emergencySkipFailed")
            );
          } finally {
            setShowSkipModal(false);
          }
        }}
      />
    </div>
  );
}
