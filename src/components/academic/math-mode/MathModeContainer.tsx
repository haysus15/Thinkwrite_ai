"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import shared from "../shared/academic.module.css";
import type { MathGuidance, MathProblem, MathStep } from "@/types/math-mode";
import type { VictorHandoffContext, SystemStep } from "@/lib/academic/teachingEngine";
import MathModeCanvas from "./MathModeCanvas";
import MathSymbolPalette from "./MathSymbolPalette";
import MathModeHeader from "./MathModeHeader";
import { useVictorChat } from "../victor-chat/VictorChatContext";
import { useMathSession } from "./hooks/useMathSession";
import { useMathVerification } from "./hooks/useMathVerification";
import type { MathfieldElement } from "./mathfield";
import { useAuth } from "@/contexts/AuthContext";

export default function MathModeContainer({
  initialProblemId = null,
  setContextId = null,
  autoSetDebrief = false,
}: {
  initialProblemId?: string | null;
  setContextId?: string | null;
  autoSetDebrief?: boolean;
}) {
  const t = useTranslations();
  const backspaceKey = "backspace";
  const leftKey = "left";
  const rightKey = "right";
  const router = useRouter();
  type MathTriggerReason =
    | "repeated_error"
    | "low_mastery"
    | "session_struggle"
    | "session_complete_errors"
    | "manual_request";
  const {
    setMode,
    conversationId,
    setConversationId,
    setMessages,
    coachingProfile,
  } = useVictorChat();
  const { profile } = useAuth();
  const outputLanguage = profile?.preferred_language || "en";
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [steps, setSteps] = useState<MathStep[]>([]);
  const [guidance, setGuidance] = useState<MathGuidance[]>([]);
  const [problemLatex, setProblemLatex] = useState("");
  const [mathTrack, setMathTrack] =
    useState<"general" | "algebra" | "calculus" | "statistics">("general");
  const [activeToolPanel, setActiveToolPanel] =
    useState<"graph" | "calculator" | "history" | "guidance" | null>(null);
  const [isTeacherCollapsed, setIsTeacherCollapsed] = useState(true);
  const [graphSource, setGraphSource] = useState<"problem" | "latest_step" | "custom">(
    "problem"
  );
  const [customGraphExpression, setCustomGraphExpression] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [teachingSessionId, setTeachingSessionId] = useState<string | null>(null);
  const [teachingSteps, setTeachingSteps] = useState<SystemStep[]>([]);
  const [teachingCurrentStepIndex, setTeachingCurrentStepIndex] = useState(0);
  const [teachingLoading, setTeachingLoading] = useState(false);
  const [setContextTitle, setSetContextTitle] = useState<string | null>(null);
  const initialProblemLoadedRef = useRef(false);
  const autoSetDebriefFiredRef = useRef(false);
  const activeMathFieldRef = useRef<MathfieldElement | null>(null);
  const [hasActiveMathField, setHasActiveMathField] = useState(false);
  const [paletteAnchor, setPaletteAnchor] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const clearFieldTimerRef = useRef<number | null>(null);
  const missingStepIdsRef = useRef<Set<string>>(new Set());
  const handleActiveField = (field: MathfieldElement | null) => {
    if (field) {
      if (clearFieldTimerRef.current) {
        window.clearTimeout(clearFieldTimerRef.current);
        clearFieldTimerRef.current = null;
      }
      activeMathFieldRef.current = field;
      setHasActiveMathField(true);
      if (typeof field.getBoundingClientRect === "function") {
        const rect = field.getBoundingClientRect();
        setPaletteAnchor({ top: rect.bottom, left: rect.left, width: rect.width });
      }
      return;
    }
    if (clearFieldTimerRef.current) {
      window.clearTimeout(clearFieldTimerRef.current);
    }
    clearFieldTimerRef.current = window.setTimeout(() => {
      activeMathFieldRef.current = null;
      setHasActiveMathField(false);
      setPaletteAnchor(null);
      clearFieldTimerRef.current = null;
    }, 220);
  };
  const graphExpression = useMemo(() => {
    const latestStep = [...steps]
      .reverse()
      .find((step) => (step.latex || "").trim().length > 0);
    if (graphSource === "latest_step") return latestStep?.latex || "";
    if (graphSource === "custom") return customGraphExpression;
    return currentProblem?.graph_expression || problemLatex || "";
  }, [currentProblem, customGraphExpression, graphSource, problemLatex, steps]);
  const hasProblem = Boolean(currentProblem);
  const syncTeachingProgressFromSteps = (nextSteps: MathStep[]) => {
    if (teachingSteps.length === 0) return;
    const meaningfulSteps = nextSteps.filter(
      (step) => Boolean(step.latex.trim()) || Boolean((step.reasoning || "").trim())
    );

    if (meaningfulSteps.length === 0) {
      setTeachingSteps((prev) =>
        prev.map((entry, index) => ({ ...entry, revealed: index === 0 }))
      );
      setTeachingCurrentStepIndex(0);
      return;
    }

    const firstAttentionIndex = meaningfulSteps.findIndex(
      (step) =>
        step.status === "unchecked" ||
        step.status === "needs_recheck" ||
        step.status === "incorrect" ||
        step.status === "error" ||
        step.status === "partial"
    );

    const rawTargetIndex =
      firstAttentionIndex >= 0 ? firstAttentionIndex : meaningfulSteps.length;
    const targetIndex = Math.min(
      Math.max(0, rawTargetIndex),
      teachingSteps.length - 1
    );

    setTeachingSteps((prev) =>
      prev.map((entry, index) =>
        index <= targetIndex ? { ...entry, revealed: true } : entry
      )
    );
    setTeachingCurrentStepIndex(targetIndex);
  };
  const handleInsertSymbol = (symbol: string) => {
    const activeMathField = activeMathFieldRef.current;
    if (!activeMathField) return;
    if (symbol === "⌫") {
      if (typeof activeMathField.executeCommand === "function") {
        activeMathField.executeCommand("deleteBackward");
      } else if (typeof activeMathField.keystroke === "function") {
        activeMathField.keystroke(
          backspaceKey[0].toUpperCase() + backspaceKey.slice(1)
        );
      }
      activeMathField.focus?.();
      return;
    }
    if (symbol === "←") {
      if (typeof activeMathField.executeCommand === "function") {
        activeMathField.executeCommand("moveToPreviousChar");
      } else if (typeof activeMathField.keystroke === "function") {
        activeMathField.keystroke(leftKey[0].toUpperCase() + leftKey.slice(1));
      }
      activeMathField.focus?.();
      return;
    }
    if (symbol === "→") {
      if (typeof activeMathField.executeCommand === "function") {
        activeMathField.executeCommand("moveToNextChar");
      } else if (typeof activeMathField.keystroke === "function") {
        activeMathField.keystroke(rightKey[0].toUpperCase() + rightKey.slice(1));
      }
      activeMathField.focus?.();
      return;
    }
    if (typeof activeMathField.insert === "function") {
      activeMathField.insert(symbol);
      activeMathField.focus?.();
    }
  };
  const sendVictorIntervention = async (
    context: VictorHandoffContext,
    reasonLabel: string
  ) => {
    const prompt = `I need help at Step ${context.struggleStep.stepNumber}: ${context.struggleStep.title}.`;
    const triggerReason: MathTriggerReason =
      context.interventionReason === "button"
        ? "manual_request"
        : "session_struggle";
    setActiveToolPanel(null);
    setMode("teaching");
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: prompt,
        timestamp: new Date().toISOString(),
      },
    ]);
    const response = await fetch("/api/victor/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: conversationId || undefined,
        mode: "teaching",
        message: prompt,
        outputLanguage,
        workspaceContext: `Math Mode · ${reasonLabel}`,
        mathTriggerReason: triggerReason,
        victorHandoffContext: context,
        coachingProfile,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || t("academic.mathMode.container.errors.victorIntervention"));
    }
    if (data?.conversationId) {
      setConversationId(data.conversationId);
    }
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.reply || t("academic.mathMode.container.victorInterventionStarted"),
        timestamp: new Date().toISOString(),
        responseType: data.responseType,
      },
    ]);
  };

  const sendVictorTriggerIntervention = async (
    prompt: string,
    reasonLabel: string,
    triggerReason?: MathTriggerReason
  ) => {
    setIsTeacherCollapsed(false);
    setActiveToolPanel(null);
    setMode("teaching");
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: prompt,
        timestamp: new Date().toISOString(),
      },
    ]);
    const response = await fetch("/api/victor/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: conversationId || undefined,
        mode: "teaching",
        message: prompt,
        outputLanguage,
        workspaceContext: `Math Mode · ${reasonLabel}`,
        mathTriggerReason: triggerReason,
        coachingProfile,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || t("academic.mathMode.container.errors.victorTriggerIntervention"));
    }
    if (data?.conversationId) {
      setConversationId(data.conversationId);
    }
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.reply || t("academic.mathMode.container.victorJumpedIn"),
        timestamp: new Date().toISOString(),
        responseType: data.responseType,
      },
    ]);
  };

  const startTeachingSession = async (
    content: string,
    existingSteps: MathStep[] = []
  ) => {
    if (!content.trim()) return;
    setTeachingLoading(true);
    try {
      const response = await fetch("/api/academic/teaching/decompose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content,
          subject: "math",
          workspaceContext: "math",
          outputLanguage,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("academic.mathMode.container.errors.startGuidance"));
      }
      const nextTeachingSteps = Array.isArray(data.steps) ? data.steps : [];
      setTeachingSessionId(data.sessionId || null);

      const meaningfulExisting = existingSteps.filter(
        (step) => Boolean(step.latex.trim()) || Boolean((step.reasoning || "").trim())
      );
      const firstAttentionIndex = meaningfulExisting.findIndex(
        (step) =>
          step.status === "unchecked" ||
          step.status === "needs_recheck" ||
          step.status === "incorrect" ||
          step.status === "error" ||
          step.status === "partial"
      );
      const initialIndexRaw =
        meaningfulExisting.length === 0
          ? 0
          : firstAttentionIndex >= 0
          ? firstAttentionIndex
          : meaningfulExisting.length;
      const initialIndex = Math.max(
        0,
        Math.min(initialIndexRaw, Math.max(0, nextTeachingSteps.length - 1))
      );

      setTeachingSteps(
        nextTeachingSteps.map((step: SystemStep, index: number) =>
          index <= initialIndex ? { ...step, revealed: true } : step
        )
      );
      setTeachingCurrentStepIndex(initialIndex);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("academic.mathMode.container.errors.startGuidance")
      );
    } finally {
      setTeachingLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (clearFieldTimerRef.current) {
        window.clearTimeout(clearFieldTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const activeMathField = activeMathFieldRef.current;
    if (!hasActiveMathField || !activeMathField || typeof activeMathField.getBoundingClientRect !== "function") {
      return;
    }
    const syncPaletteAnchor = () => {
      const rect = activeMathField.getBoundingClientRect();
      setPaletteAnchor({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    syncPaletteAnchor();
    window.addEventListener("resize", syncPaletteAnchor);
    window.addEventListener("scroll", syncPaletteAnchor, true);
    return () => {
      window.removeEventListener("resize", syncPaletteAnchor);
      window.removeEventListener("scroll", syncPaletteAnchor, true);
    };
  }, [hasActiveMathField]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    let active = true;
    const loadSetContext = async () => {
      if (!setContextId) {
        setSetContextTitle(null);
        return;
      }
      try {
        const response = await fetch("/api/math/problem-set");
        const data = await response.json();
        if (!response.ok) return;
        const sets = Array.isArray(data?.sets) ? data.sets : [];
        const found = sets.find((entry: { id: string }) => entry.id === setContextId);
        if (active) {
          setSetContextTitle(found?.title || null);
        }
      } catch {
        if (active) {
          setSetContextTitle(null);
        }
      }
    };
    void loadSetContext();
    return () => {
      active = false;
    };
  }, [setContextId]);

  const {
    handleStartProblem,
    handleAddStep,
    handleUpdateStep,
    handleDeleteStep,
    handleUndoLastStep,
    handleRevertToLastVerified,
    handleFlagStepForReview,
    handleSelectProblem,
    handleCompleteSession,
    handleGeneratePracticeFromSummary,
    handleStartGeneratedPractice,
    isGeneratingPractice,
    sessionState,
    sessionSummary,
    generatedPracticeOptions,
  } = useMathSession({
    currentProblem,
    steps,
    problemLatex,
    customGraphExpression,
    outputLanguage,
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
  });

  const {
    isVerifying,
    verifyingStepId,
    handleVerifyStep,
    handleVerifyAll,
    handleRequestHint,
  } = useMathVerification({
    currentProblem,
    steps,
    teachingSessionId,
    outputLanguage,
    setSteps,
    setGuidance,
    setErrorMessage,
    syncTeachingProgressFromSteps,
    onProblemRefreshed: (problem) => {
      setCurrentProblem(problem);
      setProblems((prev) => {
        const next = prev.filter((entry) => entry.id !== problem.id);
        return [problem, ...next];
      });
    },
    onVictorTrigger: async (trigger) => {
      await sendVictorTriggerIntervention(
        trigger.message,
        `Trigger: ${trigger.reason}`,
        trigger.reason
      );
    },
    onHintReceived: () => {
      setIsTeacherCollapsed(false);
      setActiveToolPanel("guidance");
    },
    onIncorrectVerified: () => {
      setIsTeacherCollapsed(false);
      setActiveToolPanel("guidance");
    },
  });

  const handleTeachingNextStep = (stepNumber: number) => {
    const requestedIndex = stepNumber - 1;
    const targetIndex = Math.max(
      0,
      Math.min(requestedIndex, Math.max(0, teachingSteps.length - 1))
    );
    setTeachingSteps((prev) => prev.map((step, index) => (index <= targetIndex ? { ...step, revealed: true } : step)));
    setTeachingCurrentStepIndex(targetIndex);
  };

  const classifyTeachingAttempt = (
    rawAttempt: string
  ): "correct" | "partial" | "wrong" | "skipped" => {
    const normalized = rawAttempt.trim();
    if (!normalized) return "skipped";

    const lower = normalized.toLowerCase();
    if (
      /(i\s*(don'?t|do not)\s*know|idk|unsure|not sure|confused|stuck|help)/.test(
        lower
      )
    ) {
      return "wrong";
    }

    return "partial";
  };

  const handleTeachingAttempt = async (stepNumber: number, attempt: string) => {
    if (!teachingSessionId) return;
    setTeachingLoading(true);
    try {
      const inferredResult = classifyTeachingAttempt(attempt);
      const response = await fetch("/api/academic/teaching/attempt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: teachingSessionId,
          stepNumber,
          attempt,
          result: inferredResult,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("academic.mathMode.container.errors.recordStepAttempt"));
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
          t("academic.mathMode.container.autoIntervention")
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("academic.mathMode.container.errors.recordStepAttempt")
      );
    } finally {
      setTeachingLoading(false);
    }
  };

  const handleTeachingHelp = async (stepNumber: number) => {
    if (!teachingSessionId) return;
    setIsTeacherCollapsed(false);
    setTeachingLoading(true);
    try {
      const response = await fetch("/api/academic/teaching/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: teachingSessionId,
          stepNumber,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("academic.mathMode.container.errors.requestHandoff"));
      }
      if (data?.victorHandoffContext) {
        await sendVictorIntervention(
          data.victorHandoffContext,
          t("academic.mathMode.container.manualIntervention")
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("academic.mathMode.container.errors.requestHandoff")
      );
    } finally {
      setTeachingLoading(false);
    }
  };

  const handleAskVictorStep = async (step: MathStep, stepNumber: number) => {
    const summary = step.latex?.trim() || "current transformation";
    await sendVictorTriggerIntervention(
      `I need help with step ${stepNumber}: ${summary}.`,
      t("academic.mathMode.container.manualRequest"),
      "manual_request"
    );
  };

  const handleVictorDebrief = async (variant: "error" | "clean") => {
    const meaningfulSteps = steps.filter((step) => step.latex.trim().length > 0);
    const revisedStep = meaningfulSteps.find(
      (step) =>
        step.status === "incorrect" ||
        step.status === "error" ||
        step.status === "partial"
    );
    const opening =
      variant === "error"
        ? `Good work finishing that. I noticed the revision on step ${
            revisedStep?.step_number ?? t("academic.mathMode.container.stepUnknown")
          } — that was a ${currentProblem?.problem_type || "math"} issue. Want to talk through why that transformation works the way it does?`
        : `Solid solve — you handled ${currentProblem?.problem_type || "this concept"} well. Want to push it? I can walk you through a variation with one more layer.`;

    await sendVictorTriggerIntervention(
      opening,
      variant === "error"
        ? t("academic.mathMode.container.completionDebriefRevisions")
        : t("academic.mathMode.container.completionDebriefClean"),
      "manual_request"
    );
  };

  useEffect(() => {
    if (!autoSetDebrief || autoSetDebriefFiredRef.current) return;
    if (!currentProblem) return;
    autoSetDebriefFiredRef.current = true;
    const meaningfulSteps = steps.filter((step) => step.latex.trim().length > 0);
    const hasRevisions = meaningfulSteps.some(
      (step) =>
        step.status === "incorrect" ||
        step.status === "error" ||
        step.status === "partial"
    );
    void sendVictorTriggerIntervention(
      hasRevisions
        ? `Let's review the full worksheet pattern. Focus on the revision trend around ${
            currentProblem.problem_type || "math reasoning"
          } and compare problem transitions.`
        : `Let's do a set-level debrief. I solved the worksheet cleanly and want a harder extension across ${currentProblem.problem_type || "these concepts"}.`,
      t("academic.mathMode.container.setLevelDebrief"),
      "manual_request"
    );
  }, [autoSetDebrief, currentProblem, sendVictorTriggerIntervention, steps]);

  const handleToggleTeacherCollapse = () => {
    setIsTeacherCollapsed((prev) => {
      const next = !prev;
      if (prev) {
        setActiveToolPanel(null);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!initialProblemId || initialProblemLoadedRef.current) return;
    if (problems.length === 0) return;
    initialProblemLoadedRef.current = true;
    void handleSelectProblem(initialProblemId);
  }, [handleSelectProblem, initialProblemId, problems.length]);

  return (
    <div className={`${shared.root} ${shared.page} ${shared.surfacePanel} !p-0 flex h-full min-h-0 flex-col overflow-hidden`}>
      <MathModeHeader
        hasProblem={hasProblem}
        stepCount={steps.length}
        mathTrack={mathTrack}
        onTrackChange={setMathTrack}
        breadcrumbLabel={
          setContextTitle && currentProblem?.set_order
            ? `${setContextTitle} -> ${t("academic.entry.problem")} ${currentProblem.set_order}`
            : null
        }
        onBreadcrumbClick={
          setContextId ? () => router.push(`/academic/math-mode/set/${setContextId}`) : undefined
        }
      />
      {errorMessage && (
        <div className={`${shared.surfacePanelCompact} mx-4 mt-3 text-sm text-rose-100`}>
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className={`${shared.surfacePanelCompact} mx-4 mt-3 text-sm text-emerald-100`}>
          {successMessage}
        </div>
      )}
      <div className="min-h-0 flex-1 p-3">
        <MathModeCanvas
          isTeacherCollapsed={isTeacherCollapsed}
          problemLatex={problemLatex}
          currentProblem={currentProblem}
          steps={steps}
          guidance={guidance}
          isVerifying={isVerifying}
          onStepChange={handleUpdateStep}
          onAddStep={handleAddStep}
          onDeleteStep={handleDeleteStep}
          onUndoLastStep={handleUndoLastStep}
          onRevertToLastVerified={handleRevertToLastVerified}
          onFlagForReview={handleFlagStepForReview}
          onVerifyStep={handleVerifyStep}
          verifyingStepId={verifyingStepId}
          onVerifyAll={handleVerifyAll}
          onRequestHint={handleRequestHint}
          onAskVictorStep={handleAskVictorStep}
          onMarkFinalAnswer={handleCompleteSession}
          onStartProblem={handleStartProblem}
          onActiveFieldChange={handleActiveField}
          onProblemChange={setProblemLatex}
          teachingSteps={teachingSteps}
          currentTeachingStepIndex={teachingCurrentStepIndex}
          onTeachingNextStep={handleTeachingNextStep}
          onTeachingAttempt={handleTeachingAttempt}
          onTeachingHint={(stepNumber) => {
            setIsTeacherCollapsed(false);
            setActiveToolPanel("guidance");
            void handleRequestHint(stepNumber);
          }}
          onTeachingHelp={handleTeachingHelp}
          teachingLoading={teachingLoading}
          activeToolPanel={activeToolPanel}
          onToolSelect={(tool) => {
            setIsTeacherCollapsed(false);
            setActiveToolPanel(tool);
          }}
          graphExpression={graphExpression}
          graphSource={graphSource}
          customGraphExpression={customGraphExpression}
          onGraphSourceChange={setGraphSource}
          onCustomGraphExpressionChange={setCustomGraphExpression}
          problems={problems}
          onSelectProblem={handleSelectProblem}
          isGeneratingPractice={isGeneratingPractice}
          onGenerateCompletionPractice={handleGeneratePracticeFromSummary}
          generatedPracticeOptions={generatedPracticeOptions}
          onStartGeneratedPractice={handleStartGeneratedPractice}
          onToggleTeacherCollapse={handleToggleTeacherCollapse}
          sessionState={sessionState}
          summary={sessionSummary}
          onVictorDebrief={handleVictorDebrief}
          showBackToWorksheet={Boolean(currentProblem?.problem_set_id)}
          onBackToWorksheet={
            currentProblem?.problem_set_id
              ? () => router.push(`/academic/math-mode/set/${currentProblem.problem_set_id}`)
              : undefined
          }
        />
      </div>
      {paletteAnchor && (
        <MathSymbolPalette
          onInsert={handleInsertSymbol}
          variant="dock"
          floatingAnchor={paletteAnchor}
        />
      )}
    </div>
  );
}
