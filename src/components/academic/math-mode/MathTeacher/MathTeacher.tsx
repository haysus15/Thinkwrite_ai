"use client";

import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { MathGuidance, MathProblem, MathStep } from "@/types/math-mode";
import type { VictorMode } from "@/types/academic";
import type { SystemStep } from "@/lib/academic/teachingEngine";
import { useVictorChat } from "../../victor-chat/VictorChatContext";
import VictorChatContainer from "../../victor-chat/VictorChatContainer";
import MathCalculator from "../MathCalculator";
import MathProblemHistory from "../MathProblemHistory";
import MathVictorGuidance from "../MathVictorGuidance";
import StepByStepPanel from "../../shared/StepByStepPanel/StepByStepPanel";
import GraphPanel from "../GraphPanel";
import styles from "./MathTeacher.module.css";

type ToolPanel = "graph" | "calculator" | "history" | "guidance" | null;

interface MathTeacherProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenChat?: () => void;
  onOpenTool?: (tool: ToolPanel) => void;
  onQuickCheck?: () => void;
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
}

const MODES: VictorMode[] = [
  "math",
  "teaching",
  "default",
  "study",
  "challenge",
  "idea_expansion",
];

export default function MathTeacher({
  isCollapsed,
  onToggleCollapse,
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
}: MathTeacherProps) {
  const t = useTranslations();
  const { mode, setMode } = useVictorChat();
  const meaningfulSteps = steps.filter(
    (step) => Boolean(step.latex.trim()) || Boolean((step.reasoning || "").trim())
  );
  const pendingCount = meaningfulSteps.filter(
    (step) => step.status === "unchecked" || step.status === "needs_recheck"
  ).length;

  if (isCollapsed) {
    return (
      <aside className={`${styles.teacher} ${styles.teacherCollapsed}`}>
        <button
          type="button"
          className={styles.railToggle}
          onClick={onToggleCollapse}
          title={t("academic.mathMode.teacher.expand")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className={styles.teacher}>
      <header className={styles.header}>
        <div className={styles.presenceRow}>
          <div className={styles.presence}>
            <span className={styles.dot} />
            {t("academic.mathMode.guidance.victor")}
          </div>
          <span className="text-[11px] text-slate-400">{t("academic.mathMode.teacher.zone")}</span>
        </div>
        <div className={styles.modeRow}>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={onToggleCollapse}
          >
            <ChevronRight className="h-3.5 w-3.5" />
            {t("academic.mathMode.teacher.collapse")}
          </button>
          {MODES.map((modeId) => (
            <button
              key={modeId}
              type="button"
              className={`${styles.modeBtn} ${
                mode === modeId ? styles.modeBtnActive : ""
              }`}
              onClick={() => setMode(modeId)}
            >
              {modeId.replace("_", " ")}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.teachingContent}>
        {teachingSteps.length > 0 && (
          <StepByStepPanel
            steps={teachingSteps}
            currentStepIndex={currentTeachingStepIndex}
            onRequestNextStep={onTeachingNextStep}
            onStepAttempt={onTeachingAttempt}
            onRequestHint={onTeachingHint}
            onRequestVictorHelp={onTeachingHelp}
            isLoading={teachingLoading}
          />
        )}
        <div className="mt-2 h-[220px] min-h-[170px] overflow-hidden">
          <VictorChatContainer
            workspaceContext={t("academic.mathMode.teacher.workspaceContext")}
            variant="sidebar"
            showStudyPanel={false}
          />
        </div>
      </div>

      <div className={styles.toolsRow}>
        {(
          [
            ["graph", t("academic.mathMode.teacher.tools.graph")],
            ["calculator", t("academic.mathMode.teacher.tools.calculator")],
            ["history", t("academic.mathMode.teacher.tools.history")],
            ["guidance", t("academic.mathMode.teacher.tools.guidance")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`${styles.toolBtn} ${
              activeToolPanel === id ? styles.toolBtnActive : ""
            }`}
            onClick={() => onToolSelect(activeToolPanel === id ? null : id)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeToolPanel && (
        <div className={styles.toolContent}>
          {activeToolPanel === "graph" && (
            <GraphPanel
              graphSource={graphSource}
              graphExpression={graphExpression}
              customGraphExpression={customGraphExpression}
              onGraphSourceChange={onGraphSourceChange}
              onCustomGraphExpressionChange={onCustomGraphExpressionChange}
            />
          )}
          {activeToolPanel === "calculator" && (
            <MathCalculator visible onToggle={() => null} showToggle={false} />
          )}
          {activeToolPanel === "history" && (
            <MathProblemHistory problems={problems} onSelect={onSelectProblem} />
          )}
          {activeToolPanel === "guidance" && (
            <MathVictorGuidance guidance={guidance} steps={steps} />
          )}
        </div>
      )}

      <footer className={styles.verification}>
        <div className={styles.resultList}>
          {meaningfulSteps.length === 0 ? (
            <span>{t("academic.mathMode.teacher.noSteps")}</span>
          ) : (
            <span>{t("academic.mathMode.teacher.pendingVerification", { count: pendingCount })}</span>
          )}
        </div>
        <button
          type="button"
          className={styles.verifyBtn}
          onClick={onVerifyAll}
          disabled={meaningfulSteps.length === 0 || pendingCount === 0 || isVerifying}
        >
          {isVerifying
            ? t("academic.mathMode.teacher.checking")
            : pendingCount > 0
            ? t("academic.mathMode.teacher.checkMyWorkPending", { count: pendingCount })
            : t("academic.mathMode.teacher.checkMyWork")}
        </button>
      </footer>
    </aside>
  );
}
