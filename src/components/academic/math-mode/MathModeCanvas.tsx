"use client";

import layout from "./MathModeContainer.module.css";
import type {
  MathGuidance,
  MathProblem,
  MathSessionSummary,
  MathStep,
} from "@/types/math-mode";
import type { SystemStep } from "@/lib/academic/teachingEngine";
import MathDocument from "./MathDocument/MathDocument";
import VictorRail from "./VictorRail";
import CompletionPanel from "./CompletionPanel";
import type { MathfieldElement } from "./mathfield";
type ToolPanel = "graph" | "calculator" | "history" | "guidance" | null;

export default function MathModeCanvas({
  isTeacherCollapsed,
  problemLatex,
  currentProblem,
  steps,
  guidance,
  isVerifying,
  onStepChange,
  onAddStep,
  onDeleteStep,
  onUndoLastStep,
  onRevertToLastVerified,
  onFlagForReview,
  onVerifyStep,
  verifyingStepId,
  onVerifyAll,
  onRequestHint,
  onAskVictorStep,
  onMarkFinalAnswer,
  onStartProblem,
  onActiveFieldChange,
  onProblemChange,
  teachingSteps,
  currentTeachingStepIndex,
  onTeachingNextStep,
  onTeachingAttempt,
  onTeachingHint,
  onTeachingHelp,
  teachingLoading,
  activeToolPanel,
  onToolSelect,
  graphExpression,
  graphSource,
  customGraphExpression,
  onGraphSourceChange,
  onCustomGraphExpressionChange,
  problems,
  onSelectProblem,
  isGeneratingPractice,
  onGenerateCompletionPractice,
  generatedPracticeOptions,
  onStartGeneratedPractice,
  onToggleTeacherCollapse,
  sessionState,
  summary,
  onVictorDebrief,
  showBackToWorksheet,
  onBackToWorksheet,
}: {
  isTeacherCollapsed: boolean;
  problemLatex: string;
  currentProblem: MathProblem | null;
  steps: MathStep[];
  guidance: MathGuidance[];
  isVerifying: boolean;
  onStepChange: (stepId: string, value: string, reasoning?: string) => void;
  onAddStep: () => void;
  onDeleteStep: (id: string) => void;
  onUndoLastStep: () => void;
  onRevertToLastVerified: () => void;
  onFlagForReview: (id: string) => void;
  onVerifyStep: (id: string) => void;
  verifyingStepId: string | null;
  onVerifyAll: () => void;
  onRequestHint: () => void;
  onAskVictorStep: (step: MathStep, stepNumber: number) => void;
  onMarkFinalAnswer: (stepId: string) => void;
  onStartProblem: () => void;
  onActiveFieldChange: (field: MathfieldElement | null) => void;
  onProblemChange: (value: string) => void;
  teachingSteps: SystemStep[];
  currentTeachingStepIndex: number;
  onTeachingNextStep: (stepNumber: number) => void;
  onTeachingAttempt: (stepNumber: number, attempt: string) => void;
  onTeachingHint: (stepNumber: number) => void;
  onTeachingHelp: (stepNumber: number) => void;
  teachingLoading: boolean;
  activeToolPanel: ToolPanel;
  onToolSelect: (tool: ToolPanel) => void;
  graphExpression: string;
  graphSource: "problem" | "latest_step" | "custom";
  customGraphExpression: string;
  onGraphSourceChange: (value: "problem" | "latest_step" | "custom") => void;
  onCustomGraphExpressionChange: (value: string) => void;
  problems: MathProblem[];
  onSelectProblem: (id: string) => void;
  isGeneratingPractice: boolean;
  onGenerateCompletionPractice: (conceptTag: string) => void;
  generatedPracticeOptions: Array<{
    id: string;
    latex: string;
    plain_text: string;
    difficulty: number;
    concept_tag: string;
  }>;
  onStartGeneratedPractice: (option: {
    id: string;
    latex: string;
    plain_text: string;
    difficulty: number;
    concept_tag: string;
  }) => void;
  onToggleTeacherCollapse: () => void;
  sessionState: "idle" | "active" | "completing" | "completed";
  summary: MathSessionSummary | null;
  onVictorDebrief: (variant: "error" | "clean") => void;
  showBackToWorksheet?: boolean;
  onBackToWorksheet?: () => void;
}) {
  const hasPersistedProblem = Boolean(currentProblem);
  const hasSteps = steps.length > 0;
  const hasStarted = hasPersistedProblem || hasSteps;
  const isWorkspaceLocked =
    sessionState === "completing" || sessionState === "completed";
  const showCompletionPanel =
    hasStarted &&
    (sessionState === "completing" || sessionState === "completed");
  const isRailCollapsed = isTeacherCollapsed && !showCompletionPanel;

  return (
    <div
      className={`${layout.root} ${
        isRailCollapsed ? layout.rootTeacherCollapsed : ""
      } ${!hasStarted ? layout.rootDocumentOnly : ""}`}
    >
      <div className={layout.documentZone}>
        <MathDocument
          problemStatement={problemLatex}
          steps={steps}
          onStepChange={onStepChange}
          onAddStep={onAddStep}
          onDeleteStep={onDeleteStep}
          onUndoLastStep={onUndoLastStep}
          onRevertToLastVerified={onRevertToLastVerified}
          onFlagForReview={onFlagForReview}
          onVerifyStep={onVerifyStep}
          verifyingStepId={verifyingStepId}
          onVerifyAll={onVerifyAll}
          onRequestHint={onRequestHint}
          onAskVictorStep={onAskVictorStep}
          onMarkFinalAnswer={onMarkFinalAnswer}
          isCompletingSession={sessionState === "completing"}
          isWorkspaceLocked={isWorkspaceLocked}
          isVerifying={isVerifying}
          isStarted={hasStarted}
          onStart={onStartProblem}
          onActiveFieldChange={onActiveFieldChange}
          onProblemChange={onProblemChange}
        />
      </div>
      {hasStarted && (
        <div
          className={`${layout.teacherZone} ${
            isRailCollapsed ? layout.teacherZoneCollapsed : ""
          }`}
        >
          {showCompletionPanel ? (
            <CompletionPanel
              state={sessionState === "completing" ? "completing" : "completed"}
              problemLatex={problemLatex}
              summary={summary}
              onGeneratePractice={onGenerateCompletionPractice}
              isGeneratingPractice={isGeneratingPractice}
              generatedPracticeOptions={generatedPracticeOptions}
              onStartPractice={onStartGeneratedPractice}
              onVictorDebrief={onVictorDebrief}
              showBackToWorksheet={showBackToWorksheet}
              onBackToWorksheet={onBackToWorksheet}
            />
          ) : (
            <VictorRail
              isCollapsed={isRailCollapsed}
              onToggleCollapse={onToggleTeacherCollapse}
              onOpenChat={() => onToolSelect(null)}
              onOpenTool={onToolSelect}
              onQuickCheck={onVerifyAll}
              teachingSteps={teachingSteps}
              currentTeachingStepIndex={currentTeachingStepIndex}
              onTeachingNextStep={onTeachingNextStep}
              onTeachingAttempt={onTeachingAttempt}
              onTeachingHint={onTeachingHint}
              onTeachingHelp={onTeachingHelp}
              teachingLoading={teachingLoading}
              activeToolPanel={activeToolPanel}
              onToolSelect={onToolSelect}
              guidance={guidance}
              steps={steps}
              graphExpression={graphExpression}
              graphSource={graphSource}
              customGraphExpression={customGraphExpression}
              onGraphSourceChange={onGraphSourceChange}
              onCustomGraphExpressionChange={onCustomGraphExpressionChange}
              problems={problems}
              onSelectProblem={onSelectProblem}
              onVerifyAll={onVerifyAll}
              isVerifying={isVerifying}
            />
          )}
        </div>
      )}
    </div>
  );
}
