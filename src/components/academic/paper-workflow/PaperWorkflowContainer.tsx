// src/components/academic/paper-workflow/PaperWorkflowContainer.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Lock } from "lucide-react";
import VictorOutlineWorkspace from "@/components/academic/outline/VictorOutlineWorkspace";
import type {
  ConversationHistoryEntry,
  IntakeConversationEntry,
  ParsedRequirements,
} from "@/components/academic/outline/outlineTypes";
import MirrorModeCheck from "./MirrorModeCheck";
import PaperGenerationPanel from "./PaperGenerationPanel";
import GenerationQualitySummary from "./GenerationQualitySummary";
import UnderstandingCheckpoint from "./UnderstandingCheckpoint";
import PaperLibrary from "./PaperLibrary";
import PaperCompletionPanel from "./PaperCompletionPanel";
import { isStepAccessible, type WorkflowState, type WorkflowStep } from "@/lib/paperWorkflowSteps";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import shared from "../shared/academic.module.css";
import AcademicErrorState from "../shared/AcademicErrorState";

type PaperStatus = {
  id: string;
  outline_id?: string | null;
  workflow_step?: WorkflowStep | null;
  has_paper_content?: boolean;
  checkpoint_passed?: boolean | null;
  emergency_skip_used?: boolean | null;
};

type InlineError = {
  message: string;
  retry: (() => void) | null;
};

type AssignmentMeta = {
  assignment_name?: string | null;
  assignment_type?: string | null;
  class_name?: string | null;
  due_date?: string | null;
  requirements?: Record<string, unknown> | null;
};

type StepStyle = "active" | "completed" | "locked" | "available";

type SaveBeforeNavEvent = CustomEvent<{ done?: () => void }>;

type PaperWorkflowContainerProps = {
  initialPaperId?: string | null;
  setContextId?: string | null;
  assignmentId?: string | null;
};

export default function PaperWorkflowContainer({
  initialPaperId = null,
  setContextId = null,
  assignmentId: initialAssignmentId = null,
}: PaperWorkflowContainerProps) {
  const { user } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const t = useTranslations("academic.paperWorkflow.container");
  const [step, setStep] = useState<WorkflowStep>("outline");
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [assignmentSetId, setAssignmentSetId] = useState<string | null>(setContextId);
  const [checkpointPassed, setCheckpointPassed] = useState(false);
  const [emergencySkipUsed, setEmergencySkipUsed] = useState(false);
  const [paperIsComplete, setPaperIsComplete] = useState(false);
  const [paperContent, setPaperContent] = useState("");
  const [paperTopic, setPaperTopic] = useState("");
  const [paperSetOrder, setPaperSetOrder] = useState<number | null>(null);
  const [setTitle, setSetTitle] = useState<string | null>(null);
  const [setAssignmentPrompt, setSetAssignmentPrompt] = useState<string | null>(null);
  const [setRubricText, setSetRubricText] = useState<string | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<InlineError | null>(null);
  const [assignmentMeta, setAssignmentMeta] = useState<AssignmentMeta | null>(null);
  const [showQualitySummary, setShowQualitySummary] = useState(false);
  const [intakeHistory, setIntakeHistory] = useState<IntakeConversationEntry[] | null>(null);
  const [voiceApplied, setVoiceApplied] = useState(false);
  const searchParams = useSearchParams();
  const searchParamsAssignmentId = searchParams?.get("assignmentId") ?? null;

  const parseRequirements = (
    requirements: Record<string, unknown> | null,
    dueDate?: string | null,
    assignmentType?: string | null
  ): ParsedRequirements | null => {
    if (!requirements && !dueDate && !assignmentType) return null;
    return {
      assignmentType:
        assignmentType ||
        (typeof requirements?.assignment_type === "string"
          ? requirements.assignment_type
          : undefined),
      requiredSections: Array.isArray(requirements?.required_sections)
        ? requirements.required_sections.map((item) => String(item))
        : undefined,
      requiredTopics: Array.isArray(requirements?.required_topics)
        ? requirements.required_topics.map((item) => String(item))
        : Array.isArray(requirements?.topics_to_cover)
          ? requirements.topics_to_cover.map((item) => String(item))
          : undefined,
      minSources:
        typeof requirements?.min_sources === "number"
          ? requirements.min_sources
          : typeof requirements?.minSources === "number"
            ? requirements.minSources
          : undefined,
      citationFormat:
        typeof requirements?.citation_style === "string"
          ? requirements.citation_style
          : typeof requirements?.citationFormat === "string"
            ? requirements.citationFormat
          : undefined,
      dueDate: dueDate || undefined,
      wordCount:
        typeof requirements?.word_count === "number"
          ? String(requirements.word_count)
          : typeof requirements?.word_count === "string"
            ? requirements.word_count
            : undefined,
      minSections:
        typeof requirements?.min_sections === "number"
          ? requirements.min_sections
          : typeof requirements?.minSections === "number"
            ? requirements.minSections
          : undefined,
    };
  };

  const parsedRequirements = parseRequirements(
    assignmentMeta?.requirements || null,
    assignmentMeta?.due_date || null,
    assignmentMeta?.assignment_type || null
  );

  const workflowState: WorkflowState = {
    outlineId: outlineId ?? null,
    paperId: paperId ?? null,
    checkpointPassed,
    emergencySkipUsed,
  };

  useEffect(() => {
    const id = initialAssignmentId ?? searchParams.get("assignmentId");
    if (id) {
      setAssignmentId(id);
      setStep("outline");
    }
  }, [initialAssignmentId, searchParams]);

  useEffect(() => {
    const id = searchParams.get("setId");
    if (id) {
      setAssignmentSetId(id);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!initialPaperId) return;
    let active = true;
    const loadPaper = async () => {
      try {
        const response = await fetch(`/api/paper/${initialPaperId}`);
        const data = await response.json();
        if (!response.ok || !data?.paper) {
          throw new Error(data?.error || t("errors.loadPaper"));
        }
        if (!active) return;
        const paper = data.paper as {
          id: string;
          assignment_id: string | null;
          assignment_set_id: string | null;
          set_order: number | null;
          outline_id: string | null;
          workflow_step: WorkflowStep | null;
          checkpoint_passed: boolean;
          emergency_skip_used: boolean;
          is_complete?: boolean;
          paper_content?: string | null;
          topic?: string | null;
        };
        setPaperId(paper.id);
        setAssignmentId(paper.assignment_id || null);
        setAssignmentSetId(paper.assignment_set_id || setContextId || null);
        setOutlineId(paper.outline_id || null);
        setCheckpointPassed(Boolean(paper.checkpoint_passed));
        setEmergencySkipUsed(Boolean(paper.emergency_skip_used));
        setPaperIsComplete(Boolean(paper.is_complete));
        setPaperContent(String(paper.paper_content || ""));
        setPaperTopic(String(paper.topic || ""));
        setPaperSetOrder(
          paper.set_order == null || Number.isNaN(Number(paper.set_order))
            ? null
            : Number(paper.set_order)
        );
        setStep(paper.workflow_step || "outline");
        const setData = data?.set as
          | {
              title?: string | null;
              assignment_prompt?: string | null;
              rubric_text?: string | null;
            }
          | null;
        if (setData) {
          setSetTitle(setData.title || null);
          setSetAssignmentPrompt(setData.assignment_prompt || null);
          setSetRubricText(setData.rubric_text || null);
        }
      } catch (error) {
        if (!active) return;
        setInlineError({
          message: error instanceof Error ? error.message : t("errors.loadPaperFallback"),
          retry: null,
        });
      }
    };
    void loadPaper();
    return () => {
      active = false;
    };
  }, [initialPaperId, setContextId]);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const loadAssignmentMeta = async () => {
      try {
        const response = await fetch(`/api/travis/assignment/${assignmentId}`);
        const data = await response.json();
        if (!response.ok || !data?.assignment || !active) return;
        setAssignmentMeta(data.assignment as AssignmentMeta);
      } catch {
        if (!active) return;
        setAssignmentMeta(null);
      }
    };
    void loadAssignmentMeta();
    return () => {
      active = false;
    };
  }, [assignmentId]);

  useEffect(() => {
    if (!outlineId) return;
    let active = true;

    void supabase
      .from("academic_outlines")
      .select("conversation_history")
      .eq("id", outlineId)
      .single()
      .then(({ data }) => {
        if (!active || !data?.conversation_history) return;
        const history = data.conversation_history as ConversationHistoryEntry[];
        setIntakeHistory(
          history.filter((entry): entry is IntakeConversationEntry => entry.type === "intake")
        );
      });

    return () => {
      active = false;
    };
  }, [outlineId, supabase]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    void supabase
      .from("voice_chambers")
      .select("confidence_level")
      .eq("user_id", user.id)
      .eq("chamber", "academic")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setVoiceApplied(Number(data?.confidence_level || 0) >= 30);
      });

    return () => {
      active = false;
    };
  }, [supabase, user?.id]);

  const persistWorkflowStep = async (
    targetStep: WorkflowStep,
    explicitPaperId?: string | null
  ) => {
    const targetPaperId = explicitPaperId ?? paperId;
    if (!targetPaperId) {
      return targetStep === "outline" || targetStep === "generate";
    }

    const response = await fetch("/api/academic/paper/workflow", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paperId: targetPaperId,
        workflowStep: targetStep,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data?.error ||
          t("errors.saveWorkflowPosition")
      );
    }
    return true;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as Window & { __academicHasUnsavedState?: boolean }).__academicHasUnsavedState = true;

    const onSaveBeforeNav = (event: Event) => {
      const custom = event as SaveBeforeNavEvent;
      const done = custom.detail?.done;
      const finish = () => {
        if (done) done();
      };

      void (async () => {
        try {
          await persistWorkflowStep(step);
        } catch {
          // Non-blocking: navigation guard already has timeout fallback.
        } finally {
          finish();
        }
      })();
    };

    window.addEventListener("academic:save-before-nav", onSaveBeforeNav);
    return () => {
      window.removeEventListener("academic:save-before-nav", onSaveBeforeNav);
      (window as Window & { __academicHasUnsavedState?: boolean }).__academicHasUnsavedState =
        false;
    };
  }, [step, paperId]);

  const restoreWorkflowState = async (id: string) => {
    const response = await fetch(
      `/api/academic/paper/workflow?assignmentId=${encodeURIComponent(id)}`
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data?.error || t("errors.restoreWorkflow")
      );
    }

    const paper = data?.paper as PaperStatus | null;
    if (!paper) return;

    setPaperId(paper.id);
    if (paper.outline_id) setOutlineId(paper.outline_id);
    setCheckpointPassed(Boolean(paper.checkpoint_passed));
    setEmergencySkipUsed(Boolean(paper.emergency_skip_used));

    const persistedStep = paper.workflow_step || "outline";
    if (persistedStep === "generate" && !paper.has_paper_content) {
      setStep("outline");
      setLockNotice(t("notices.restoreGeneration"));
      return;
    }
    setStep(persistedStep);
  };

  const navigateStep = async (
    targetStep: WorkflowStep,
    explicitPaperId?: string | null
  ) => {
    if (!isStepAccessible(targetStep, workflowState)) {
      setLockNotice(getStepLockReason(targetStep));
      return;
    }
    setInlineError(null);
    try {
      await persistWorkflowStep(targetStep, explicitPaperId);
      setStep(targetStep);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("errors.saveWorkflowPosition");
      setInlineError({
        message,
        retry: () => {
          void navigateStep(targetStep, explicitPaperId);
        },
      });
    }
  };

  useEffect(() => {
    if (!assignmentId) return;
    const seedTasks = async () => {
      try {
        const response = await fetch("/api/academic/assignment-tasks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "seed",
            assignmentId,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || t("errors.progressSeed"));
        }
      } catch {
        setInlineError({
          message: t("errors.progressSync"),
          retry: null,
        });
      }
    };
    void seedTasks();
  }, [assignmentId]);

  useEffect(() => {
    if (initialPaperId) return;
    if (!assignmentId) return;
    let active = true;
    const runRestore = async () => {
      try {
        await restoreWorkflowState(assignmentId);
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : t("errors.restoreWorkflow");
        setInlineError({
          message,
          retry: () => {
            void runRestore();
          },
        });
      }
    };
    void runRestore();
    return () => {
      active = false;
    };
  }, [assignmentId, initialPaperId]);

  useEffect(() => {
    if (!paperId) {
      setCheckpointPassed(false);
      setEmergencySkipUsed(false);
      setPaperIsComplete(false);
      setPaperContent("");
      setPaperTopic("");
      setPaperSetOrder(null);
      return;
    }

    let active = true;
    const loadPaperState = async () => {
      try {
        const response = await fetch(`/api/paper/${paperId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || t("errors.loadPaperState"));
        }
        if (!active) return;
        const paper = data?.paper as
          | (PaperStatus & {
              is_complete?: boolean;
              paper_content?: string | null;
              topic?: string | null;
              assignment_set_id?: string | null;
              set_order?: number | null;
            })
          | undefined;
        if (!paper) return;
        setCheckpointPassed(Boolean(paper.checkpoint_passed));
        setEmergencySkipUsed(Boolean(paper.emergency_skip_used));
        setPaperIsComplete(Boolean(paper.is_complete));
        setPaperContent(String(paper.paper_content || ""));
        setPaperTopic(String(paper.topic || ""));
        setPaperSetOrder(
          paper.set_order == null || Number.isNaN(Number(paper.set_order))
            ? null
            : Number(paper.set_order)
        );
        if (paper.assignment_set_id) {
          setAssignmentSetId(String(paper.assignment_set_id));
        }
        const setData = data?.set as
          | { title?: string | null; assignment_prompt?: string | null; rubric_text?: string | null }
          | null;
        if (setData) {
          setSetTitle(setData.title || null);
          setSetAssignmentPrompt(setData.assignment_prompt || null);
          setSetRubricText(setData.rubric_text || null);
        }
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : t("errors.loadPaperStateFallback");
        setInlineError({
          message,
          retry: () => {
            void loadPaperState();
          },
        });
      }
    };

    void loadPaperState();
    return () => {
      active = false;
    };
  }, [paperId]);

  useEffect(() => {
    if (!lockNotice) return;
    const timeout = window.setTimeout(() => setLockNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [lockNotice]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const shell = document.querySelector(".academic-studio-shell");
    if (!(shell instanceof HTMLElement)) return;

    if (step === "outline") {
      shell.dataset.hideLayoutChat = "true";
    } else {
      delete shell.dataset.hideLayoutChat;
    }

    return () => {
      delete shell.dataset.hideLayoutChat;
    };
  }, [step]);

  const getStepLockReason = (targetStep: WorkflowStep): string => {
    switch (targetStep) {
      case "mirror_mode_check":
        return "Complete the pre-generation check before continuing.";
      case "generate":
        return t("lockReasons.generate");
      case "checkpoint":
        return t("lockReasons.checkpoint");
      case "library":
        return t("lockReasons.library");
      default:
        return t("lockReasons.default");
    }
  };

  const handleStepClick = (targetStep: WorkflowStep) => {
    if (paperIsComplete) {
      setLockNotice(t("notices.paperCompleteLocked"));
      return;
    }
    void navigateStep(targetStep);
  };

  const steps: WorkflowStep[] = [
    "outline",
    "mirror_mode_check",
    "generate",
    "checkpoint",
    "library",
  ];

  const isStepCompleted = (target: WorkflowStep): boolean => {
    if (target === "outline") return Boolean(outlineId);
    if (target === "mirror_mode_check") {
      return Boolean(outlineId) && step !== "outline";
    }
    if (target === "generate") return Boolean(paperId);
    if (target === "checkpoint") return checkpointPassed || emergencySkipUsed;
    return false;
  };

  const getStepStyle = (target: WorkflowStep): StepStyle => {
    if (target === step) return "active";
    if (isStepCompleted(target)) return "completed";
    if (!isStepAccessible(target, workflowState)) return "locked";
    return "available";
  };

  const dueSoonLine = (() => {
    if (!assignmentMeta?.due_date) return null;
    const dueAt = new Date(`${assignmentMeta.due_date}T23:59:59`);
    if (Number.isNaN(dueAt.getTime())) return null;
    const isDueWithin24Hours = dueAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000;
    if (!isDueWithin24Hours) return null;
    return outlineId
      ? t("dueSoonReady")
      : t("dueSoonNoOutline");
  })();

  const stepContextLabel =
    step === "outline"
      ? t("stepContexts.outline")
      : step === "mirror_mode_check"
        ? "Mirror Mode check"
      : step === "generate"
        ? t("stepContexts.generate")
        : step === "checkpoint"
          ? t("stepContexts.checkpoint")
          : t("stepContexts.library");

  const handleAddSamples = () => {
    const returnTarget = paperId
      ? `/academic/paper-workflow?paperId=${encodeURIComponent(paperId)}`
      : assignmentId
        ? `/academic/paper-workflow?assignmentId=${encodeURIComponent(assignmentId)}`
        : "/academic/paper-workflow";
    router.push(
      `/mirror-mode/dashboard?tab=identity&return=${encodeURIComponent(returnTarget)}`
    );
  };

  const completeTask = async (
    taskType: "outline" | "draft" | "revise" | "submit",
    targetAssignmentId?: string | null
  ) => {
    const resolvedAssignmentId = targetAssignmentId ?? assignmentId;
    if (!resolvedAssignmentId) return;
    try {
      const response = await fetch("/api/academic/assignment-tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          assignmentId: resolvedAssignmentId,
          taskType,
          status: "complete",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("errors.taskSync"));
      }
    } catch {
      setInlineError({
        message: t("errors.progressSync"),
        retry: null,
      });
    }
  };

  const handleMarkComplete = async () => {
    if (!paperId) return;
    try {
      const response = await fetch(`/api/paper/${paperId}/complete`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("errors.markComplete"));
      }
      setPaperIsComplete(true);
      setLockNotice(t("notices.problemComplete"));
      if (data?.set_id) {
        setAssignmentSetId(String(data.set_id));
      }
    } catch (error) {
      setInlineError({
        message:
          error instanceof Error ? error.message : t("errors.markComplete"),
        retry: () => {
          void handleMarkComplete();
        },
      });
    }
  };

  const handleUnlockPaper = async () => {
    if (!paperId) return;
    try {
      const response = await fetch(`/api/paper/${paperId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_complete: false }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("errors.unlockPaper"));
      }
      setPaperIsComplete(false);
      setLockNotice(t("notices.paperUnlocked"));
    } catch (error) {
      setInlineError({
        message: error instanceof Error ? error.message : t("errors.unlockPaper"),
        retry: () => {
          void handleUnlockPaper();
        },
      });
    }
  };

  return (
    <div className={`${shared.root} ${shared.page} ${shared.surfacePanel}`}>
      {/* Workflow header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          {assignmentSetId && setTitle ? (
            <button
              type="button"
              onClick={() => {
                window.location.href = `/academic/paper-workflow/set/${assignmentSetId}`;
              }}
              className="text-xs text-sky-200/90 hover:text-sky-100"
            >
              {setTitle} {paperSetOrder ? `→ Paper ${paperSetOrder}` : ""}
            </button>
          ) : null}
          <p className="mt-2 text-sm text-slate-400">
            {stepContextLabel}
          </p>
        </div>
        {/* Step navigation */}
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          {steps.map((stepOption) => {
            const style = getStepStyle(stepOption);
            const locked = style === "locked";
            const label =
              stepOption === "outline"
                ? t("steps.outline")
                : stepOption === "mirror_mode_check"
                  ? "Mirror Mode"
                : stepOption === "generate"
                  ? t("steps.generate")
                  : stepOption === "checkpoint"
                    ? t("steps.checkpoint")
                    : t("steps.library");
            const lockReason = locked ? getStepLockReason(stepOption) : undefined;

            return (
              <button
                key={stepOption}
                type="button"
                title={lockReason}
                aria-label={lockReason ? `${label}. ${lockReason}` : label}
                onClick={() => handleStepClick(stepOption)}
                className={`${shared.buttonBase} inline-flex items-center gap-1 ${
                  style === "active"
                    ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                    : style === "completed"
                      ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                      : style === "available"
                        ? "border-white/20 bg-white/5 text-slate-100"
                        : "border-white/10 bg-white/5 text-slate-400"
                } ${locked ? "cursor-not-allowed opacity-60 hover:border-white/10 hover:bg-white/5" : ""}`}
              >
                {label}
                {locked && <Lock className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
        {paperId && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {!paperIsComplete && paperContent.trim().length > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkComplete()}
                className={`${shared.buttonBase} ${shared.buttonPrimary}`}
              >
                {t("markComplete")}
              </button>
            ) : null}
            {paperIsComplete ? (
              <button
                type="button"
                onClick={() => void handleUnlockPaper()}
                className={`${shared.buttonBase} ${shared.buttonSecondary}`}
              >
                {t("unlockToEdit")}
              </button>
            ) : null}
          </div>
        )}
      </div>
      {lockNotice && (
        <p className={`${shared.surfacePanelCompact} mt-4 text-xs text-amber-100`}>
          {lockNotice}
        </p>
      )}
      {dueSoonLine && (
        <p className={`${shared.surfacePanelCompact} mt-4 text-xs text-amber-100`}>
          {dueSoonLine}
        </p>
      )}
      {assignmentSetId && (setAssignmentPrompt || setRubricText) && (
        <details className={`${shared.surfacePanelCompact} mt-4`}>
          <summary className="cursor-pointer text-xs text-slate-200">
            {t("assignmentContextReference")}
          </summary>
          {setAssignmentPrompt ? (
            <p className="mt-2 text-xs text-slate-300">{setAssignmentPrompt}</p>
          ) : null}
          {setRubricText ? (
            <p className="mt-2 text-xs text-slate-300">{t("rubricPrefix")} {setRubricText}</p>
          ) : null}
        </details>
      )}
      {inlineError && (
        <AcademicErrorState
          message={inlineError.message}
          retry={inlineError.retry || undefined}
          className="mt-4 !min-h-0 py-3"
        />
      )}
      {paperIsComplete && paperId && (
        <div className="mt-4">
          <PaperCompletionPanel
            paperId={paperId}
            topic={paperTopic}
            paperContent={paperContent}
            rubricText={setRubricText}
            onBackToAssignment={
              assignmentSetId
                ? () => {
                    window.location.href = `/academic/paper-workflow/set/${assignmentSetId}`;
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* Step content */}
      <div className="mt-6">
        {paperIsComplete && (
          <div className={`${shared.surfacePanelCompact} mb-4 text-xs text-slate-200`}>
            {t("readOnlyNotice")}
          </div>
        )}
        {!paperIsComplete && step === "outline" && (
          <VictorOutlineWorkspace
            outlineId={outlineId}
            assignmentId={assignmentId}
            onOutlineSaved={() => void completeTask("outline")}
            onContinue={(id) => {
              setOutlineId(id);
              void navigateStep("mirror_mode_check");
            }}
            className={assignmentMeta?.class_name ?? null}
            assignmentType={assignmentMeta?.assignment_type ?? null}
          />
        )}
        {!paperIsComplete && step === "mirror_mode_check" && user?.id ? (
          <MirrorModeCheck
            userId={user.id}
            assignmentDueDate={assignmentMeta?.due_date ?? null}
            onProceed={() => {
              void navigateStep("generate");
            }}
            onAddSamples={handleAddSamples}
          />
        ) : null}
        {!paperIsComplete &&
        step === "generate" &&
        showQualitySummary &&
        paperId &&
        outlineId ? (
          <GenerationQualitySummary
            paperId={paperId}
            outlineId={outlineId}
            requirements={parsedRequirements}
            voiceApplied={voiceApplied}
            onReview={() => {
              setShowQualitySummary(false);
            }}
            onProceed={() => {
              setShowQualitySummary(false);
              void navigateStep("checkpoint");
            }}
          />
        ) : null}
        {!paperIsComplete &&
        step === "generate" &&
        !showQualitySummary &&
        outlineId &&
        user?.id && (
          <PaperGenerationPanel
            paperId={paperId}
            outlineId={outlineId}
            userId={user.id}
            assignmentDueDate={assignmentMeta?.due_date ?? null}
            onGenerationComplete={(id, generatedContent) => {
              setPaperId(id);
              if (generatedContent.trim()) {
                setPaperContent(generatedContent);
              }
              void completeTask("draft");
              setShowQualitySummary(true);
            }}
          />
        )}
        {!paperIsComplete && step === "checkpoint" && (
          <UnderstandingCheckpoint
            paperId={paperId}
            intakeConversationHistory={intakeHistory ?? []}
            onBack={() => void navigateStep("generate")}
            onStatusChange={(status) => {
              setCheckpointPassed(status.checkpointPassed);
              setEmergencySkipUsed(status.emergencySkipUsed);
              if (status.checkpointPassed || status.emergencySkipUsed) {
                void completeTask("revise");
              }
            }}
          />
        )}
        {!paperIsComplete && step === "library" && (
          <PaperLibrary
            onPaperExport={(exportAssignmentId) =>
              void completeTask("submit", exportAssignmentId)
            }
          />
        )}
      </div>
      <style jsx global>{`
        @media (min-width: 1280px) {
          .academic-studio-shell[data-hide-layout-chat="true"] .academic-layout-chat-panel {
            display: none !important;
          }

          .academic-studio-shell[data-hide-layout-chat="true"] .academic-studio-main {
            width: 100% !important;
            max-width: 100% !important;
            flex: 0 1 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
