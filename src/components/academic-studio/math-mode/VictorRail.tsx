"use client";

import type { MathGuidance, MathProblem, MathStep } from "@/types/math-mode";
import type { SystemStep } from "@/lib/academic/teachingEngine";
import MathTeacher from "./MathTeacher/MathTeacher";

type ToolPanel = "graph" | "calculator" | "history" | "guidance" | null;

export default function VictorRail({
  isCollapsed,
  onToggleCollapse,
  onOpenChat,
  onOpenTool,
  onQuickCheck,
  teachingSteps,
  currentTeachingStepIndex,
  onTeachingNextStep,
  onTeachingAttempt,
  onTeachingHint,
  onTeachingHelp,
  teachingLoading,
  activeToolPanel,
  onToolSelect,
  guidance,
  steps,
  graphExpression,
  graphSource,
  customGraphExpression,
  onGraphSourceChange,
  onCustomGraphExpressionChange,
  problems,
  onSelectProblem,
  onVerifyAll,
  isVerifying,
}: {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenChat: () => void;
  onOpenTool: (tool: ToolPanel) => void;
  onQuickCheck: () => void;
  teachingSteps: SystemStep[];
  currentTeachingStepIndex: number;
  onTeachingNextStep: (stepNumber: number) => void;
  onTeachingAttempt: (stepNumber: number, attempt: string) => void;
  onTeachingHint: (stepNumber: number) => void;
  onTeachingHelp: (stepNumber: number) => void;
  teachingLoading: boolean;
  activeToolPanel: ToolPanel;
  onToolSelect: (tool: ToolPanel) => void;
  guidance: MathGuidance[];
  steps: MathStep[];
  graphExpression: string;
  graphSource: "problem" | "latest_step" | "custom";
  customGraphExpression: string;
  onGraphSourceChange: (value: "problem" | "latest_step" | "custom") => void;
  onCustomGraphExpressionChange: (value: string) => void;
  problems: MathProblem[];
  onSelectProblem: (id: string) => void;
  onVerifyAll: () => void;
  isVerifying: boolean;
}) {
  return (
    <MathTeacher
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      onOpenChat={onOpenChat}
      onOpenTool={onOpenTool}
      onQuickCheck={onQuickCheck}
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
  );
}
