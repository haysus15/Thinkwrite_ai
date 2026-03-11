// src/components/academic-studio/quiz/QuestionReview.tsx
"use client";

import { useEffect, useState } from "react";
import type { QuizResultItem } from "@/types/academic-studio";
import StepByStepPanel from "../shared/StepByStepPanel/StepByStepPanel";
import { useVictorChat } from "../victor-chat/VictorChatContext";
import type { SystemStep, VictorHandoffContext } from "@/lib/academic/teachingEngine";

interface QuestionReviewProps {
  result: QuizResultItem;
}

export default function QuestionReview({ result }: QuestionReviewProps) {
  const { setMode, conversationId, setConversationId, setMessages, coachingProfile } =
    useVictorChat();
  const [teachingSessionId, setTeachingSessionId] = useState<string | null>(null);
  const [teachingSteps, setTeachingSteps] = useState<SystemStep[]>([]);
  const [teachingCurrentStepIndex, setTeachingCurrentStepIndex] = useState(0);
  const [teachingLoading, setTeachingLoading] = useState(false);
  const [teachingError, setTeachingError] = useState<string | null>(null);

  const sendVictorIntervention = async (
    context: VictorHandoffContext,
    reasonLabel: string
  ) => {
    const prompt = `Please explain Step ${context.struggleStep.stepNumber}: ${context.struggleStep.title}.`;
    setMode("teaching");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt, timestamp: new Date().toISOString() },
    ]);
    const response = await fetch("/api/victor/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          mode: "teaching",
          message: prompt,
          workspaceContext: `Quiz review · ${reasonLabel}`,
          victorHandoffContext: context,
          coachingProfile,
        }),
      });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Victor intervention failed.");
    }
    if (data?.conversationId) {
      setConversationId(data.conversationId);
    }
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.reply || "Victor intervention started.",
        timestamp: new Date().toISOString(),
        responseType: data.responseType,
      },
    ]);
  };

  useEffect(() => {
    if (result.correct !== false) return;
    let active = true;
    const run = async () => {
      setTeachingLoading(true);
      setTeachingError(null);
      try {
        const response = await fetch("/api/academic/teaching/decompose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `Question ${result.questionId}. Feedback: ${
              result.feedback || "No feedback provided."
            }. Correct answer: ${String(result.correctAnswer ?? "")}`,
            subject: "general",
            workspaceContext: "study",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to build step-by-step explanation.");
        }
        if (!active) return;
        setTeachingSessionId(data.sessionId || null);
        setTeachingSteps(Array.isArray(data.steps) ? data.steps : []);
        setTeachingCurrentStepIndex(0);
      } catch (error) {
        if (!active) return;
        setTeachingError(
          error instanceof Error
            ? error.message
            : "Unable to build step-by-step explanation."
        );
      } finally {
        if (active) setTeachingLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [result.correct, result.correctAnswer, result.feedback, result.questionId]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Question {result.questionId}</p>
        <span
          className={`rounded-full border px-2 py-1 text-xs ${
            result.correct === true
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : result.correct === false
                ? "border-red-400/40 bg-red-500/10 text-red-200"
                : "border-white/10 bg-white/5 text-slate-400"
          }`}
        >
          {result.correct === null ? "Reviewed" : result.correct ? "Correct" : "Incorrect"}
        </span>
      </div>
      {result.feedback && (
        <p className="mt-3 text-slate-400">{result.feedback}</p>
      )}
      {result.correct === false && result.correctAnswer !== undefined && (
        <p className="mt-2 text-xs text-slate-500">
          Correct answer: {String(result.correctAnswer)}
        </p>
      )}
      {teachingError && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {teachingError}
        </p>
      )}
      {result.correct === false && teachingSteps.length > 0 && (
        <div className="mt-3">
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
            onStepAttempt={async (stepNumber, attempt) => {
              if (!teachingSessionId) return;
              setTeachingLoading(true);
              try {
                const response = await fetch("/api/academic/teaching/attempt", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId: teachingSessionId,
                    stepNumber,
                    attempt,
                    result: "wrong",
                  }),
                });
                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data?.error || "Unable to record attempt.");
                }
                if (Array.isArray(data?.steps)) {
                  setTeachingSteps(data.steps);
                }
                if (typeof data?.currentStepIndex === "number") {
                  setTeachingCurrentStepIndex(data.currentStepIndex);
                }
                if (data?.struggleDetected && data?.victorHandoffContext) {
                  await sendVictorIntervention(
                    data.victorHandoffContext,
                    "Auto intervention"
                  );
                }
              } catch (error) {
                setTeachingError(
                  error instanceof Error ? error.message : "Unable to record attempt."
                );
              } finally {
                setTeachingLoading(false);
              }
            }}
            onRequestHint={() => null}
            onRequestVictorHelp={async (stepNumber) => {
              if (!teachingSessionId) return;
              setTeachingLoading(true);
              try {
                const response = await fetch("/api/academic/teaching/handoff", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId: teachingSessionId,
                    stepNumber,
                  }),
                });
                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data?.error || "Unable to request Victor help.");
                }
                if (data?.victorHandoffContext) {
                  await sendVictorIntervention(
                    data.victorHandoffContext,
                    "Manual intervention"
                  );
                }
              } catch (error) {
                setTeachingError(
                  error instanceof Error
                    ? error.message
                    : "Unable to request Victor help."
                );
              } finally {
                setTeachingLoading(false);
              }
            }}
            isLoading={teachingLoading}
          />
        </div>
      )}
    </div>
  );
}
