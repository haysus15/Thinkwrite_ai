"use client";

import { useCallback, useState } from "react";
import type { MathGuidance, MathProblem, MathStep } from "@/types/math-mode";

interface UseMathVerificationArgs {
  currentProblem: MathProblem | null;
  steps: MathStep[];
  teachingSessionId: string | null;
  setSteps: (value: MathStep[] | ((prev: MathStep[]) => MathStep[])) => void;
  setGuidance: (
    value: MathGuidance[] | ((prev: MathGuidance[]) => MathGuidance[])
  ) => void;
  setErrorMessage: (value: string | null) => void;
  syncTeachingProgressFromSteps: (nextSteps: MathStep[]) => void;
  onProblemRefreshed?: (problem: MathProblem) => void;
  onVictorTrigger?: (trigger: {
    reason:
      | "repeated_error"
      | "low_mastery"
      | "session_struggle"
      | "session_complete_errors";
    message: string;
    concept: string;
  }) => Promise<void>;
  onHintReceived?: () => void;
  onIncorrectVerified?: () => void;
}

function normalizeStepText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function useMathVerification(args: UseMathVerificationArgs) {
  const {
    currentProblem,
    steps,
    teachingSessionId,
    setSteps,
    setGuidance,
    setErrorMessage,
    syncTeachingProgressFromSteps,
    onProblemRefreshed,
    onVictorTrigger,
    onHintReceived,
    onIncorrectVerified,
  } = args;
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyingStepId, setVerifyingStepId] = useState<string | null>(null);

  const handleVerifyStep = useCallback(
    async (id: string) => {
      const step = steps.find((entry) => entry.id === id);
      if (!currentProblem || !step) return;
      if (!step.latex.trim()) {
        setErrorMessage(
          "Write the math expression for this step before verifying."
        );
        return;
      }

      const currentIndex = steps.findIndex((entry) => entry.id === id);
      const normalizedLatex = normalizeStepText(step.latex);
      const duplicate = steps.some((entry, index) => {
        if (index === currentIndex) return false;
        if (index > currentIndex) return false;
        return normalizeStepText(entry.latex) === normalizedLatex;
      });
      if (duplicate) {
        setSteps((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  status: "incorrect",
                  error_type: "procedural",
                  feedback:
                    "This repeats an earlier step. Move the equation forward with a new transformation.",
                }
              : entry
          )
        );
        setErrorMessage(
          "That step matches an earlier step. Apply the next transformation instead of repeating."
        );
        return;
      }

      setErrorMessage(null);
      setVerifyingStepId(id);
      try {
        const response = await fetch("/api/math/step/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem: currentProblem,
            step,
            steps,
            teachingSessionId,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to verify step.");
        }
        let updatedSteps = steps.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: data.result.status,
                error_type: data.result.error_type,
                feedback: data.result.feedback,
              }
            : entry
        );
        setSteps(updatedSteps);
        syncTeachingProgressFromSteps(updatedSteps);
        if (data.guidance) {
          setGuidance((prev) => [...prev, data.guidance]);
        }
        if (
          data.result.status === "incorrect" ||
          data.result.status === "error" ||
          data.result.status === "partial"
        ) {
          onIncorrectVerified?.();
        }
        if (data?.victorTrigger?.message && onVictorTrigger) {
          await onVictorTrigger(data.victorTrigger);
        }
        if (currentProblem?.id && onProblemRefreshed) {
          try {
            const problemResponse = await fetch(`/api/math/problem/${currentProblem.id}`);
            const problemData = await problemResponse.json();
            if (problemResponse.ok && problemData?.problem) {
              onProblemRefreshed(problemData.problem as MathProblem);
            }
          } catch {
            // best-effort refresh; keep verify flow responsive
          }
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to verify step."
        );
      } finally {
        setVerifyingStepId(null);
      }
    },
    [
      steps,
      currentProblem,
      teachingSessionId,
      setErrorMessage,
      setSteps,
      syncTeachingProgressFromSteps,
      setGuidance,
      onProblemRefreshed,
      onVictorTrigger,
      onIncorrectVerified,
    ]
  );

  const handleVerifyAll = useCallback(async () => {
    if (!currentProblem || steps.length === 0) return;
    const targetSteps = [...steps]
      .filter(
        (entry) =>
          (entry.status === "unchecked" || entry.status === "needs_recheck") &&
          (entry.latex.trim().length > 0 || (entry.reasoning || "").trim().length > 0)
      )
      .sort((a, b) => a.step_number - b.step_number);
    if (targetSteps.length === 0) {
      setErrorMessage("No pending steps to verify.");
      return;
    }
    const hasEmptyStep = targetSteps.some(
      (entry) =>
        !entry.latex.trim() && !(entry.reasoning || "").trim()
    );
    if (hasEmptyStep) {
      setErrorMessage("Complete all step expressions before running Verify all.");
      return;
    }
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/math/verify-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: currentProblem,
          steps: targetSteps,
          teachingSessionId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to verify all steps.");
      }
      const updatedSteps = steps.map((entry) => {
        const result = data.results.find(
          (item: { step_id: string }) => item.step_id === entry.id
        );
        return result
          ? {
              ...entry,
              status: result.status,
              error_type: result.error_type,
              feedback: result.feedback,
            }
          : entry;
      });
      setSteps(updatedSteps);
      syncTeachingProgressFromSteps(updatedSteps);
      if (
        updatedSteps.some(
          (entry) =>
            entry.status === "incorrect" ||
            entry.status === "error" ||
            entry.status === "partial"
        )
      ) {
        onIncorrectVerified?.();
      }
      if (data.guidance) {
        setGuidance((prev) => [...prev, data.guidance]);
      }
      if (data?.victorTrigger?.message && onVictorTrigger) {
        await onVictorTrigger(data.victorTrigger);
      }
      if (currentProblem?.id && onProblemRefreshed) {
        try {
          const problemResponse = await fetch(`/api/math/problem/${currentProblem.id}`);
          const problemData = await problemResponse.json();
          if (problemResponse.ok && problemData?.problem) {
            onProblemRefreshed(problemData.problem as MathProblem);
          }
        } catch {
          // best-effort refresh; keep verify-all flow responsive
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to verify all steps."
      );
    } finally {
      setIsVerifying(false);
    }
  }, [
    currentProblem,
    steps,
    teachingSessionId,
    setErrorMessage,
    setSteps,
    syncTeachingProgressFromSteps,
    setGuidance,
    onProblemRefreshed,
    onVictorTrigger,
    onIncorrectVerified,
  ]);

  const handleRequestHint = useCallback(async (stepNumber?: number) => {
    if (!currentProblem) return;
    setErrorMessage(null);
    try {
      const response = await fetch("/api/math/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: currentProblem,
          steps,
          step_number:
            typeof stepNumber === "number" && Number.isFinite(stepNumber)
              ? stepNumber
              : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to request hint.");
      }
      if (data?.guidance) {
        setGuidance((prev) => [...prev, data.guidance]);
      }
      onHintReceived?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to request hint."
      );
    }
  }, [currentProblem, steps, setErrorMessage, setGuidance, onHintReceived]);

  return {
    isVerifying,
    verifyingStepId,
    handleVerifyStep,
    handleVerifyAll,
    handleRequestHint,
  };
}
