"use client";

import StepCard from "../StepCard/StepCard";
import type { TeachingSession } from "@/types/academic-studio";

type TeachingSessionPanelProps = {
  session: TeachingSession;
  loading: boolean;
  onSubmitAttempt: (attempt: string) => void;
};

export default function TeachingSessionPanel({
  session,
  loading,
  onSubmitAttempt,
}: TeachingSessionPanelProps) {
  const totalSteps = session.plannedStepCount || Math.max(1, session.steps.length);
  const currentStep = Math.max(0, Math.min(session.currentStepIndex + 1, totalSteps));

  return (
    <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Teaching Session</p>
      <h3 className="mt-2 text-sm font-semibold text-slate-100">{session.problemStatement}</h3>
      <p className="mt-1 text-xs text-slate-400">
        Subject: {session.subject} · Step {currentStep} of {totalSteps}
      </p>

      <div className="mt-4 grid gap-3">
        {Array.from({ length: totalSteps }, (_, index) => {
          const step = session.steps[index] || {
            stepNumber: index + 1,
            title: `Step ${index + 1}`,
            instruction: "",
            gap: index === 0 ? null : "",
            revealed: false,
            studentAttempt: null,
            attemptResult: null,
            victorFeedback: null,
            subSteps: [],
          };

          const isLocked = !step.revealed && index > session.currentStepIndex;
          const isActive = index === session.currentStepIndex && !session.completedAt;

          return (
            <StepCard
              key={`step-${index + 1}`}
              step={step}
              totalSteps={totalSteps}
              isLocked={isLocked}
              isActive={isActive}
              onSubmitAttempt={onSubmitAttempt}
              loading={loading}
            />
          );
        })}
      </div>

      {session.completedAt ? (
        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-50">
          <p className="font-semibold">Problem complete.</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-100/85">Victor&apos;s assessment</p>
          <p className="mt-2 text-sm text-emerald-50">
            Demonstrated clearly: {session.understandingProfile.strongConcepts.join(", ") || "None recorded"}
          </p>
          <p className="mt-1 text-sm text-emerald-50">
            Needs reinforcement: {session.understandingProfile.gapConcepts.join(", ") || "None identified"}
          </p>
          <p className="mt-1 text-sm text-emerald-50">
            Misconceptions addressed: {session.understandingProfile.misconceptions.join(", ") || "None identified"}
          </p>
        </div>
      ) : null}
    </section>
  );
}
