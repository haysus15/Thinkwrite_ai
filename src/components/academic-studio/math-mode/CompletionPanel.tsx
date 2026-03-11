"use client";

import { useMemo, useState } from "react";
import type { MathSessionSummary } from "@/types/math-mode";
import SessionSummary from "./SessionSummary";
import PracticePrompt from "./PracticePrompt";
import VictorDebriefOffer from "./VictorDebriefOffer";

export default function CompletionPanel({
  state,
  problemLatex,
  summary,
  onGeneratePractice,
  isGeneratingPractice,
  generatedPracticeOptions,
  onStartPractice,
  onVictorDebrief,
  showBackToWorksheet,
  onBackToWorksheet,
}: {
  state: "completing" | "completed";
  problemLatex: string;
  summary: MathSessionSummary | null;
  onGeneratePractice: (conceptTag: string) => void;
  isGeneratingPractice: boolean;
  generatedPracticeOptions: Array<{
    id: string;
    latex: string;
    plain_text: string;
    difficulty: number;
    concept_tag: string;
  }>;
  onStartPractice: (option: {
    id: string;
    latex: string;
    plain_text: string;
    difficulty: number;
    concept_tag: string;
  }) => void;
  onVictorDebrief: (variant: "error" | "clean") => void;
  showBackToWorksheet?: boolean;
  onBackToWorksheet?: () => void;
}) {
  const [practiceDismissed, setPracticeDismissed] = useState(false);
  const [victorDismissed, setVictorDismissed] = useState(false);

  const hadErrors = useMemo(
    () => Boolean(summary && summary.steps_revised > 0),
    [summary]
  );
  const targetConcept = useMemo(() => {
    if (!summary || summary.concepts.length === 0) return "general math reasoning";
    return summary.concepts[0]?.display_name || "general math reasoning";
  }, [summary]);
  const targetConceptTag = useMemo(() => {
    if (!summary || summary.concepts.length === 0) return "general";
    return summary.concepts[0]?.tag || "general";
  }, [summary]);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
        Problem complete.
      </div>
      {showBackToWorksheet && (
        <button
          type="button"
          onClick={onBackToWorksheet}
          className="w-fit rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
        >
          Back to worksheet
        </button>
      )}

      {state === "completing" && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-700/70" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-700/60" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-slate-700/60" />
          <div className="h-16 animate-pulse rounded bg-slate-700/40" />
        </div>
      )}

      {state === "completed" && summary && (
        <>
          <SessionSummary problemLatex={problemLatex} summary={summary} />

          <PracticePrompt
            visible={hadErrors}
            conceptLabel={targetConcept}
            onGenerate={() => onGeneratePractice(targetConceptTag)}
            onDismiss={() => setPracticeDismissed(true)}
            isDismissed={practiceDismissed}
            isLoading={isGeneratingPractice}
          />

          {generatedPracticeOptions.length > 0 && (
            <section className="space-y-2 rounded-xl border border-sky-300/30 bg-sky-500/10 p-3">
              <h4 className="text-sm font-medium text-sky-100">Practice set ready</h4>
              <p className="text-xs text-sky-100/85">
                Pick one of the generated problems to start now.
              </p>
              <div className="space-y-2">
                {generatedPracticeOptions.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onStartPractice(option)}
                    className="w-full rounded-lg border border-sky-300/35 bg-sky-400/10 px-3 py-2 text-left text-xs text-sky-50"
                  >
                    <span className="mr-2 text-sky-200/80">#{index + 1}</span>
                    {option.plain_text || option.latex}
                  </button>
                ))}
              </div>
            </section>
          )}

          <VictorDebriefOffer
            hadErrors={hadErrors}
            onAccept={() => onVictorDebrief(hadErrors ? "error" : "clean")}
            onDismiss={() => setVictorDismissed(true)}
            dismissed={victorDismissed}
          />
        </>
      )}
    </aside>
  );
}
