"use client";

import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import AcademicEmptyState from "../../shared/AcademicEmptyState";
import AcademicErrorState from "../../shared/AcademicErrorState";
import AcademicLoadingState from "../../shared/AcademicLoadingState";
import StepByStepPanel from "../../shared/StepByStepPanel/StepByStepPanel";
import shared from "../../shared/academic.module.css";
import type { SystemStep } from "@/lib/academic/teachingEngine";
import type { OutputState } from "../hooks/useCodingReview";

type CodingReviewOutputPaneProps = {
  output: OutputState;
  error: string | null;
  assistLoading: boolean;
  assistError: string | null;
  assistResponse: string | null;
  teachingSteps: SystemStep[];
  teachingCurrentStepIndex: number;
  teachingLoading: boolean;
  onTeachingNextStep: (stepNumber: number) => void;
  onTeachingAttempt: (stepNumber: number, attempt: string) => void;
  onTeachingVictorHelp: (stepNumber: number) => void;
  onRequestSteps: () => void;
  onRequestAnswer: () => void;
};

export default function CodingReviewOutputPane({
  output,
  error,
  assistLoading,
  assistError,
  assistResponse,
  teachingSteps,
  teachingCurrentStepIndex,
  teachingLoading,
  onTeachingNextStep,
  onTeachingAttempt,
  onTeachingVictorHelp,
  onRequestSteps,
  onRequestAnswer,
}: CodingReviewOutputPaneProps) {
  const t = useTranslations("academic.codeReviewMode.output");
  return (
    <div className="coding-review-output">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-slate-400">
        {t("title")}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRequestSteps}
            disabled={assistLoading}
            className={`${shared.buttonBase} ${shared.buttonPrimary} inline-flex items-center gap-1 !px-2 !py-1 !text-[10px] normal-case tracking-normal disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Lightbulb className="h-3 w-3" />
            {t("showSteps")}
          </button>
          <button
            type="button"
            onClick={onRequestAnswer}
            disabled={assistLoading}
            className={`${shared.buttonBase} ${shared.buttonSecondary} inline-flex items-center gap-1 !px-2 !py-1 !text-[10px] normal-case tracking-normal disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {t("showReference")}
          </button>
          {output && <span className="text-[10px] text-slate-500">{output.executionTime} ms</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-950/30 px-4 py-3 text-xs text-slate-100">
        {teachingSteps.length > 0 && (
          <div className="mb-3">
            <StepByStepPanel
              steps={teachingSteps}
              currentStepIndex={teachingCurrentStepIndex}
              onRequestNextStep={onTeachingNextStep}
              onStepAttempt={onTeachingAttempt}
              onRequestHint={() => null}
              onRequestVictorHelp={onTeachingVictorHelp}
              isLoading={teachingLoading}
            />
          </div>
        )}
        {assistLoading && (
          <AcademicLoadingState
            message={t("guidanceLoading")}
            className="mb-3 !min-h-0 py-2"
          />
        )}
        {assistError && (
          <AcademicErrorState message={assistError} className="mb-3 !min-h-0 py-2" />
        )}
        {assistResponse && !assistLoading && (
          <div className="mb-3 rounded-md border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-slate-100">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sky-200">{t("guidedAssistance")}</p>
            <p className="mt-2 whitespace-pre-wrap">{assistResponse}</p>
          </div>
        )}
        {error && (
          <AcademicErrorState message={error} className="!min-h-0 py-2" />
        )}

        {!error && !output && (
          <AcademicEmptyState
            title={t("noOutputTitle")}
            description={t("noOutputDescription")}
            className="!min-h-0 py-3"
          />
        )}

        {output?.type === "sql" && (
          <div className="space-y-3">
            {output.error ? (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200">
                {output.error}
              </p>
            ) : output.columns.length === 0 ? (
              <p className="text-slate-300">{t("queryExecuted")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {output.columns.map((col) => (
                        <th key={col} className="border-b border-white/10 px-2 py-1 text-left text-slate-300">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {output.rows.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="border-b border-white/5 px-2 py-1 text-slate-100">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[10px] text-slate-400">{t("rows", { count: output.rowCount })}</p>
              </div>
            )}
          </div>
        )}

        {output?.type !== "sql" && output && (
          <div className="space-y-3">
            {output.error && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200">
                {output.error.message}
              </p>
            )}
            {output.stdout && (
              <pre className="whitespace-pre-wrap rounded-md border border-white/10 bg-white/5 px-3 py-2">
                {output.stdout}
              </pre>
            )}
            {output.stderr && (
              <pre className="whitespace-pre-wrap rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                {output.stderr}
              </pre>
            )}
            {!output.stdout && !output.stderr && !output.error && (
              <AcademicEmptyState
                title={t("noOutputShortTitle")}
                description={t("noOutputShortDescription")}
                className="!min-h-0 py-3"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
