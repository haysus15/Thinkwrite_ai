// src/components/academic/paper-workflow/PaperGenerator.tsx
// Deprecated in Phase 9. PaperWorkflowContainer now uses PaperGenerationPanel
// for section-by-section generation. Keep this component during the transition
// as the legacy full-paper generation reference path.
"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import StepByStepPanel from "../shared/StepByStepPanel/StepByStepPanel";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import { useOutlineContext } from "./hooks/useOutlineContext";
import { usePaperTeaching } from "./hooks/usePaperTeaching";
import { usePaperGeneration } from "./hooks/usePaperGeneration";

interface PaperGeneratorProps {
  outlineId: string | null;
  assignmentId?: string | null;
  paperId?: string | null;
  assignmentSetId?: string | null;
  setOrder?: number | null;
  onBack: () => void;
  onGenerated?: () => void;
  onContinue: (paperId: string, generatedContent?: string) => void;
}

export default function PaperGenerator({
  outlineId,
  assignmentId,
  paperId,
  assignmentSetId,
  setOrder,
  onBack,
  onGenerated,
  onContinue,
}: PaperGeneratorProps) {
  const t = useTranslations("academic.paperWorkflow.generator");
  const { profile } = useAuth();
  const {
    outlineReady,
    outlineBody,
    outlineLoading,
    outlineError,
    outlineMeta,
    effectiveAssignmentId,
  } = useOutlineContext(outlineId, assignmentId);

  const {
    teachingSteps,
    teachingCurrentStepIndex,
    teachingLoading,
    teachingError,
    setTeachingSteps,
    setTeachingCurrentStepIndex,
    startPaperTeaching,
    handleTeachingAttempt,
    handleTeachingHelp,
  } = usePaperTeaching({ outlineBody, outlineMeta });

  const {
    loading,
    generationError,
    status,
    voiceSources,
    voiceSourceError,
    reloadVoiceSources,
    handleGenerate,
  } = usePaperGeneration({
    outlineId,
    outlineBody,
    effectiveAssignmentId,
    outputLanguage: profile?.preferred_language || "en",
    targetPaperId: paperId || null,
    assignmentSetId: assignmentSetId || null,
    setOrder: setOrder ?? null,
    onGenerated,
    onContinue,
  });

  const blockingError = generationError || teachingError || outlineError;

  if (!outlineReady) {
    return (
      <AcademicEmptyState
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }

  if (outlineLoading) {
    return <AcademicLoadingState message={t("loading")} />;
  }

  if (!outlineBody) {
    return (
      <AcademicErrorState
        message={
          blockingError || t("errors.loadOutline")
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-slate-200" />
          <p className="text-sm font-semibold text-slate-100">{t("title")}</p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          {t("voiceRequirement")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          <span className="uppercase tracking-[0.2em] text-slate-500">{t("voiceSources")}</span>
          {voiceSources.map((source) => (
            <span
              key={source}
              className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]"
            >
              {source}
            </span>
          ))}
        </div>
        {voiceSourceError && (
          <AcademicErrorState
            message={voiceSourceError}
            retry={() => void reloadVoiceSources()}
            className="mt-3 !min-h-0 py-3"
          />
        )}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("length")}</p>
            <p className="mt-2 text-sm text-slate-100">{t("assignmentRequirements")}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("citation")}</p>
            <p className="mt-2 text-sm text-slate-100">{t("assignmentRequirements")}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("sources")}</p>
            <p className="mt-2 text-sm text-slate-100">{t("assignmentRequirements")}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-sky-200" />
          <p className="text-sm font-semibold text-slate-100">{t("requirementsCheck")}</p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          {t("requirementsBody")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            {t("thesisLocked")}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            {t("sectionsMapped")}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            {t("sourcesQueued")}
          </span>
          {!outlineReady && (
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-amber-200">
              {t("outlineRequired")}
            </span>
          )}
          {assignmentId && (
            <span className="rounded-full border border-teal-400/40 bg-teal-500/10 px-3 py-1 text-teal-200">
              {t("assignmentLinked")}
            </span>
          )}
          <button
            type="button"
            onClick={() => void startPaperTeaching()}
            disabled={!outlineReady || teachingLoading}
            className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-sky-200 disabled:opacity-60"
          >
            {teachingLoading ? t("loadingSteps") : t("understandSection")}
          </button>
        </div>
        {status && (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {status}
          </div>
        )}
        {generationError && (
          <AcademicErrorState
            message={generationError}
            retry={() => void handleGenerate()}
            className="mt-4 !min-h-0 py-3"
          />
        )}
        {teachingError && (
          <AcademicErrorState
            message={teachingError}
            retry={() => void startPaperTeaching()}
            className="mt-4 !min-h-0 py-3"
          />
        )}
      </div>

      {teachingSteps.length > 0 && (
        <StepByStepPanel
          steps={teachingSteps}
          currentStepIndex={teachingCurrentStepIndex}
          onRequestNextStep={(stepNumber) => {
            setTeachingSteps((prev) =>
              prev.map((step, index) =>
                index <= stepNumber ? { ...step, revealed: true } : step
              )
            );
            setTeachingCurrentStepIndex((prev) =>
              Math.min(prev + 1, Math.max(0, teachingSteps.length - 1))
            );
          }}
          onStepAttempt={(stepNumber, attempt) =>
            void handleTeachingAttempt(stepNumber, attempt)
          }
          onRequestHint={() => null}
          onRequestVictorHelp={(stepNumber) => void handleTeachingHelp(stepNumber)}
          isLoading={teachingLoading}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-white/30"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToOutline")}
        </button>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 transition hover:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!outlineReady || loading}
        >
          {loading ? t("generating") : t("generateDraft")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
