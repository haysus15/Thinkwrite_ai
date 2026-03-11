"use client";

import { useCallback, useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import type {
  MathGuidance,
  MathProblem,
  MathSessionLifecycleState,
  MathSessionSummary,
  MathStep,
} from "@/types/math-mode";

interface UseMathSessionArgs {
  currentProblem: MathProblem | null;
  steps: MathStep[];
  problemLatex: string;
  customGraphExpression: string;
  missingStepIdsRef: MutableRefObject<Set<string>>;
  setCurrentProblem: (value: MathProblem | null) => void;
  setProblemLatex: (value: string) => void;
  setProblems: (value: MathProblem[] | ((prev: MathProblem[]) => MathProblem[])) => void;
  setSteps: (value: MathStep[] | ((prev: MathStep[]) => MathStep[])) => void;
  setGuidance: (
    value: MathGuidance[] | ((prev: MathGuidance[]) => MathGuidance[])
  ) => void;
  setCustomGraphExpression: (value: string) => void;
  setErrorMessage: (value: string | null) => void;
  setSuccessMessage: (value: string | null) => void;
  syncTeachingProgressFromSteps: (nextSteps: MathStep[]) => void;
  startTeachingSession: (content: string, existingSteps?: MathStep[]) => Promise<void>;
}

type GeneratedPracticeOption = {
  id: string;
  latex: string;
  plain_text: string;
  difficulty: number;
  concept_tag: string;
};

export function useMathSession(args: UseMathSessionArgs) {
  const {
    currentProblem,
    steps,
    problemLatex,
    customGraphExpression,
    missingStepIdsRef,
    setCurrentProblem,
    setProblemLatex,
    setProblems,
    setSteps,
    setGuidance,
    setCustomGraphExpression,
    setErrorMessage,
    setSuccessMessage,
    syncTeachingProgressFromSteps,
    startTeachingSession,
  } = args;
  const [isGeneratingPractice, setIsGeneratingPractice] = useState(false);
  const [sessionState, setSessionState] =
    useState<MathSessionLifecycleState>("idle");
  const [sessionSummary, setSessionSummary] = useState<MathSessionSummary | null>(
    null
  );
  const [generatedPracticeOptions, setGeneratedPracticeOptions] = useState<
    GeneratedPracticeOption[]
  >([]);

  useEffect(() => {
    if (!currentProblem && steps.length === 0) {
      setSessionState("idle");
      setSessionSummary(null);
      setGeneratedPracticeOptions([]);
      return;
    }
    if (currentProblem?.completed) {
      setSessionState((prev) => (prev === "completing" ? prev : "completed"));
      return;
    }
    setSessionState((prev) => (prev === "completing" ? prev : "active"));
  }, [currentProblem, steps.length]);

  useEffect(() => {
    let active = true;

    const loadProblems = async () => {
      try {
        const response = await fetch("/api/math/problem");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to load problem history.");
        }
        if (active) {
          setProblems(Array.isArray(data?.problems) ? data.problems : []);
        }
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load problem history."
        );
      }
    };

    loadProblems();
    return () => {
      active = false;
    };
  }, [setErrorMessage, setProblems]);

  const handleStartProblem = useCallback(async () => {
    if (!problemLatex.trim()) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/math/problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latex: problemLatex,
          graph_visible: true,
          graph_expression: problemLatex,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to create problem.");
      }
      setCurrentProblem(data.problem);
      setProblems((prev) => [
        data.problem,
        ...prev.filter((p) => p.id !== data.problem.id),
      ]);
      const stepResponse = await fetch("/api/math/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_id: data.problem.id,
          latex: "",
          step_number: 1,
        }),
      });
      const stepData = await stepResponse.json();
      setSteps(stepResponse.ok && stepData?.step ? [stepData.step] : []);
      setGuidance([]);
      await startTeachingSession(problemLatex, stepResponse.ok && stepData?.step ? [stepData.step] : []);
      if (!customGraphExpression.trim()) {
        setCustomGraphExpression(problemLatex);
      }
      missingStepIdsRef.current.clear();
      setSessionSummary(null);
      setGeneratedPracticeOptions([]);
      setSessionState("active");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create problem."
      );
    }
  }, [
    problemLatex,
    setErrorMessage,
    setSuccessMessage,
    setCurrentProblem,
    setProblems,
    setSteps,
    setGuidance,
    startTeachingSession,
    customGraphExpression,
    setCustomGraphExpression,
    missingStepIdsRef,
  ]);

  const handleAddStep = useCallback(async () => {
    if (!currentProblem) return;
    const lastStep = steps[steps.length - 1];
    if (
      lastStep &&
      !lastStep.latex.trim() &&
      !(lastStep.reasoning || "").trim()
    ) {
      setErrorMessage("Finish the current blank step before adding another one.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/math/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_id: currentProblem.id,
          latex: "",
          step_number: steps.length + 1,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to create step.");
      }
      missingStepIdsRef.current.delete(data.step.id);
      setSteps((prev) => [...prev, data.step]);
      setGeneratedPracticeOptions([]);
      setSessionState("active");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create step."
      );
    }
  }, [
    currentProblem,
    steps,
    setErrorMessage,
    setSuccessMessage,
    missingStepIdsRef,
    setSteps,
  ]);

  const handleUpdateStep = useCallback(
    async (id: string, latex: string, reasoning?: string) => {
      let nextSteps: MathStep[] = [];
      setSteps((prev) => {
        const editedIndex = prev.findIndex((step) => step.id === id);
        nextSteps = prev.map((step, index) => {
          if (step.id === id) {
            return {
              ...step,
              latex,
              reasoning,
              status: "unchecked",
              verified_at: undefined,
              feedback: undefined,
              error_type: undefined,
            };
          }
          if (editedIndex >= 0 && index > editedIndex) {
            return {
              ...step,
              status: "needs_recheck",
              feedback: "Earlier step changed. Re-verify this step.",
              error_type: undefined,
            };
          }
          return step;
        });
        return nextSteps;
      });
      if (nextSteps.length > 0) {
        syncTeachingProgressFromSteps(nextSteps);
      }
      if (missingStepIdsRef.current.has(id)) return;
      try {
        const response = await fetch(`/api/math/step/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latex, reasoning }),
        });
        if (!response.ok && response.status === 404) {
          missingStepIdsRef.current.add(id);
          setErrorMessage(
            "Autosave lost sync after a server refresh. Add a new step to continue autosave."
          );
        }
      } catch {
        // Preserve local edits even if background persistence fails.
      }
    },
    [setSteps, syncTeachingProgressFromSteps, missingStepIdsRef, setErrorMessage]
  );

  const handleDeleteStep = useCallback(
    async (id: string) => {
      setSteps((prev) => prev.filter((step) => step.id !== id));
      missingStepIdsRef.current.delete(id);
      try {
        const response = await fetch(`/api/math/step/${id}`, { method: "DELETE" });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data?.error || "Unable to delete step.");
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to delete step."
        );
      }
    },
    [setErrorMessage, setSteps, missingStepIdsRef]
  );

  const handleUndoLastStep = useCallback(async () => {
    if (!currentProblem || steps.length === 0) return;
    const lastStep = steps[steps.length - 1];
    if (!lastStep) return;
    if (!["unchecked", "incorrect"].includes(lastStep.status)) {
      setErrorMessage("Only final unchecked or incorrect steps can be undone.");
      return;
    }
    await handleDeleteStep(lastStep.id);
  }, [currentProblem, handleDeleteStep, setErrorMessage, steps]);

  const handleRevertToLastVerified = useCallback(async () => {
    if (!currentProblem || steps.length === 0) return;
    const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
    const lastVerified = [...sorted]
      .reverse()
      .find((step) => ["correct", "equivalent_form"].includes(step.status));
    if (!lastVerified) {
      setErrorMessage("No verified step to revert to yet.");
      return;
    }
    const removing = sorted.filter(
      (step) => step.step_number > lastVerified.step_number
    );
    if (removing.length === 0) return;
    const confirmed = window.confirm(
      `This will remove ${removing.length} step${
        removing.length === 1 ? "" : "s"
      } after your last verified step. This cannot be undone.`
    );
    if (!confirmed) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/math/step", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_id: currentProblem.id,
          after_step_number: lastVerified.step_number,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to revert steps.");
      }
      setSteps((prev) =>
        prev.filter((step) => step.step_number <= lastVerified.step_number)
      );
      setSuccessMessage("Reverted to your last verified step.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to revert steps."
      );
    }
  }, [
    currentProblem,
    setErrorMessage,
    setSteps,
    setSuccessMessage,
    steps,
  ]);

  const handleFlagStepForReview = useCallback(
    async (id: string) => {
      setSteps((prev) =>
        prev.map((step) =>
          step.id === id
            ? {
                ...step,
                status: "needs_recheck",
                feedback: "Earlier work looks close, but this step should be re-verified.",
              }
            : step
        )
      );
      if (missingStepIdsRef.current.has(id)) return;
      try {
        const response = await fetch(`/api/math/step/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "needs_recheck",
            verified_at: null,
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data?.error || "Unable to flag step for review.");
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to flag step for review."
        );
      }
    },
    [missingStepIdsRef, setErrorMessage, setSteps]
  );

  const handleSelectProblem = useCallback(
    async (id: string) => {
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const response = await fetch(`/api/math/problem/${id}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to load selected problem.");
        }
        setCurrentProblem(data.problem);
        setSteps(data.steps || []);
        setGuidance(data.guidance || []);
        setProblemLatex(data.problem?.latex || "");
        await startTeachingSession(data.problem?.latex || "", Array.isArray(data.steps) ? data.steps : []);
        missingStepIdsRef.current.clear();
        setSessionSummary(null);
        setGeneratedPracticeOptions([]);
        setSessionState(data.problem?.completed ? "completed" : "active");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load selected problem."
        );
      }
    },
    [
      setErrorMessage,
      setSuccessMessage,
      setCurrentProblem,
      setProblemLatex,
      setSteps,
      setGuidance,
      startTeachingSession,
      missingStepIdsRef,
    ]
  );

  const handleGeneratePracticeFromCurrent = useCallback(
    async (difficulty: "easier" | "same" | "harder") => {
      if (!currentProblem) return;
      if (isGeneratingPractice) return;
      setIsGeneratingPractice(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const practiceResponse = await fetch("/api/math/practice/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latex: currentProblem.latex,
            difficulty,
            problem_type: currentProblem.problem_type || "other",
          }),
        });
        const practiceData = await practiceResponse.json();
        if (!practiceResponse.ok) {
          throw new Error(
            practiceData?.error || "Unable to generate a practice problem."
          );
        }

        const nextLatex =
          typeof practiceData?.practice?.latex === "string"
            ? practiceData.practice.latex.trim()
            : "";
        if (!nextLatex) {
          throw new Error("Practice generation returned an empty problem.");
        }

        const createResponse = await fetch("/api/math/problem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latex: nextLatex,
            graph_visible: true,
            graph_expression: nextLatex,
            problem_type: currentProblem.problem_type || "other",
          }),
        });
        const createData = await createResponse.json();
        if (!createResponse.ok) {
          throw new Error(
            createData?.error || "Unable to open generated practice problem."
          );
        }

        setCurrentProblem(createData.problem);
        setProblemLatex(createData.problem?.latex || nextLatex);
        const stepResponse = await fetch("/api/math/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem_id: createData.problem.id,
            latex: "",
            step_number: 1,
          }),
        });
        const stepData = await stepResponse.json();
        setSteps(stepResponse.ok && stepData?.step ? [stepData.step] : []);
        setGuidance([]);
        setProblems((prev) => [
          createData.problem,
          ...prev.filter((item) => item.id !== createData.problem.id),
        ]);
        setCustomGraphExpression(createData.problem?.latex || nextLatex);
        missingStepIdsRef.current.clear();
        await startTeachingSession(
          createData.problem?.latex || nextLatex,
          stepResponse.ok && stepData?.step ? [stepData.step] : []
        );
        setSuccessMessage("Practice problem generated and ready.");
        setSessionSummary(null);
        setGeneratedPracticeOptions([]);
        setSessionState("active");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to generate practice right now."
        );
      } finally {
        setIsGeneratingPractice(false);
      }
    },
    [
      currentProblem,
      isGeneratingPractice,
      setErrorMessage,
      setCurrentProblem,
      setProblemLatex,
      setSteps,
      setGuidance,
      setProblems,
      setCustomGraphExpression,
      setSuccessMessage,
      missingStepIdsRef,
      startTeachingSession,
    ]
  );

  const handleCompleteSession = useCallback(
    async (stepId: string) => {
      if (!currentProblem?.id) return;
      setErrorMessage(null);
      setSuccessMessage(null);
      setSessionState("completing");
      setSessionSummary(null);
      setGeneratedPracticeOptions([]);

      try {
        const completeResponse = await fetch("/api/math/problem/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem_id: currentProblem.id,
            step_id: stepId,
          }),
        });
        const completeData = await completeResponse.json();
        if (!completeResponse.ok) {
          throw new Error(completeData?.error || "Unable to complete problem.");
        }

        if (completeData?.problem) {
          setCurrentProblem(completeData.problem as MathProblem);
          setProblems((prev) =>
            [completeData.problem as MathProblem, ...prev].filter(
              (problem, index, arr) =>
                arr.findIndex((item) => item.id === problem.id) === index
            )
          );
        }

        setSteps((prev) =>
          prev.map((entry) =>
            entry.id === stepId
              ? { ...entry, is_final_answer: true }
              : { ...entry, is_final_answer: false }
          )
        );

        const summaryResponse = await fetch("/api/math/session-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem_id: currentProblem.id,
            session_id: completeData?.sessionId || null,
          }),
        });
        const summaryData = await summaryResponse.json();
        if (!summaryResponse.ok) {
          throw new Error(
            summaryData?.error || "Unable to load completion summary."
          );
        }
        setSessionSummary(summaryData as MathSessionSummary);
        setSessionState("completed");
      } catch (error) {
        setSessionState("active");
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to complete problem."
        );
      }
    },
    [
      currentProblem,
      setCurrentProblem,
      setErrorMessage,
      setProblems,
      setSteps,
      setSuccessMessage,
    ]
  );

  const handleGeneratePracticeFromSummary = useCallback(
    async (conceptTag: string) => {
      if (!currentProblem?.id) return;
      if (isGeneratingPractice) return;
      setIsGeneratingPractice(true);
      setErrorMessage(null);
      try {
        const response = await fetch("/api/math/generate-practice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            concept_tag: conceptTag || "general",
            original_problem_id: currentProblem.id,
            difficulty: 3,
            user_id: currentProblem.user_id,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data?.error || "Unable to generate practice problems right now."
          );
        }
        const options = Array.isArray(data?.problems)
          ? (data.problems as GeneratedPracticeOption[])
          : [];
        setGeneratedPracticeOptions(options);
        setSuccessMessage("Practice set generated. Pick one to start.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to generate practice problems right now."
        );
      } finally {
        setIsGeneratingPractice(false);
      }
    },
    [
      currentProblem,
      isGeneratingPractice,
      setErrorMessage,
      setSuccessMessage,
    ]
  );

  const handleStartGeneratedPractice = useCallback(
    async (option: GeneratedPracticeOption) => {
      if (!option?.latex || !currentProblem) return;
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const createResponse = await fetch("/api/math/problem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latex: option.latex,
            graph_visible: true,
            graph_expression: option.latex,
            problem_type: currentProblem.problem_type || "other",
          }),
        });
        const createData = await createResponse.json();
        if (!createResponse.ok) {
          throw new Error(
            createData?.error || "Unable to open generated practice problem."
          );
        }

        setCurrentProblem(createData.problem);
        setProblemLatex(createData.problem?.latex || option.latex);
        const stepResponse = await fetch("/api/math/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem_id: createData.problem.id,
            latex: "",
            step_number: 1,
          }),
        });
        const stepData = await stepResponse.json();
        setSteps(stepResponse.ok && stepData?.step ? [stepData.step] : []);
        setGuidance([]);
        setProblems((prev) => [
          createData.problem,
          ...prev.filter((item) => item.id !== createData.problem.id),
        ]);
        setCustomGraphExpression(createData.problem?.latex || option.latex);
        missingStepIdsRef.current.clear();
        await startTeachingSession(
          createData.problem?.latex || option.latex,
          stepResponse.ok && stepData?.step ? [stepData.step] : []
        );
        setSessionSummary(null);
        setGeneratedPracticeOptions([]);
        setSessionState("active");
        setSuccessMessage("Practice problem generated and ready.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to open selected practice problem."
        );
      }
    },
    [
      currentProblem,
      missingStepIdsRef,
      setCurrentProblem,
      setCustomGraphExpression,
      setErrorMessage,
      setGuidance,
      setProblemLatex,
      setProblems,
      setSteps,
      setSuccessMessage,
      startTeachingSession,
    ]
  );

  return {
    handleStartProblem,
    handleAddStep,
    handleUpdateStep,
    handleDeleteStep,
    handleUndoLastStep,
    handleRevertToLastVerified,
    handleFlagStepForReview,
    handleSelectProblem,
    handleGeneratePracticeFromCurrent,
    handleCompleteSession,
    handleGeneratePracticeFromSummary,
    handleStartGeneratedPractice,
    isGeneratingPractice,
    sessionState,
    sessionSummary,
    generatedPracticeOptions,
  };
}
