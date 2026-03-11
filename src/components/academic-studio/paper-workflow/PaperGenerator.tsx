// src/components/academic-studio/paper-workflow/PaperGenerator.tsx
"use client";

import { ArrowLeft, ArrowRight, FileText, ShieldCheck } from "lucide-react";
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
        title="No outline to generate from"
        description="Complete and save your outline first, then return here to generate the draft."
      />
    );
  }

  if (outlineLoading) {
    return <AcademicLoadingState message="Preparing your paper generation context..." />;
  }

  if (!outlineBody) {
    return (
      <AcademicErrorState
        message={
          blockingError || "We could not load your outline details. Go back to outline and try again."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-slate-200" />
          <p className="text-sm font-semibold text-slate-100">Paper generator</p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Mirror Mode voice confidence must be above 50 before generation.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          <span className="uppercase tracking-[0.2em] text-slate-500">Voice sources:</span>
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
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Length</p>
            <p className="mt-2 text-sm text-slate-100">Assignment requirements</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Citation</p>
            <p className="mt-2 text-sm text-slate-100">Assignment requirements</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sources</p>
            <p className="mt-2 text-sm text-slate-100">Assignment requirements</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-sky-200" />
          <p className="text-sm font-semibold text-slate-100">Requirements check</p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Travis validates sources, sections, and formatting before you move forward.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Thesis locked
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Sections mapped
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Sources queued
          </span>
          {!outlineReady && (
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-amber-200">
              Outline required
            </span>
          )}
          {assignmentId && (
            <span className="rounded-full border border-teal-400/40 bg-teal-500/10 px-3 py-1 text-teal-200">
              Assignment linked
            </span>
          )}
          <button
            type="button"
            onClick={() => void startPaperTeaching()}
            disabled={!outlineReady || teachingLoading}
            className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-sky-200 disabled:opacity-60"
          >
            {teachingLoading ? "Loading steps..." : "Help me understand this section"}
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
          Back to outline
        </button>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 transition hover:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!outlineReady || loading}
        >
          {loading ? "Generating..." : "Generate draft"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
