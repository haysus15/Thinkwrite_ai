// src/components/academic-studio/paper-workflow/PaperWorkflowContainer.tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import OutlineBuilder from "./OutlineBuilder";
import PaperGenerator from "./PaperGenerator";
import UnderstandingCheckpoint from "./UnderstandingCheckpoint";
import PaperLibrary from "./PaperLibrary";
import PaperCompletionPanel from "./PaperCompletionPanel";
import { isStepAccessible, type WorkflowState, type WorkflowStep } from "@/lib/paperWorkflowSteps";
import shared from "../shared/academic-studio.module.css";
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
};

type StepStyle = "active" | "completed" | "locked" | "available";

type SaveBeforeNavEvent = CustomEvent<{ done?: () => void }>;

type PaperWorkflowContainerProps = {
  initialPaperId?: string | null;
  setContextId?: string | null;
};

export default function PaperWorkflowContainer({
  initialPaperId = null,
  setContextId = null,
}: PaperWorkflowContainerProps) {
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
  const [showQuickOutlinePrompt, setShowQuickOutlinePrompt] = useState(false);
  const [quickOutlineMode, setQuickOutlineMode] = useState(false);
  const [quickTopic, setQuickTopic] = useState("");
  const [quickSections, setQuickSections] = useState(["", "", ""]);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const workflowState: WorkflowState = {
    outlineId: outlineId ?? null,
    paperId: paperId ?? null,
    checkpointPassed,
    emergencySkipUsed,
  };

  useEffect(() => {
    const id = searchParams.get("assignmentId");
    if (id) {
      setAssignmentId(id);
      setStep("outline");
    }
  }, [searchParams]);

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
          throw new Error(data?.error || "Could not load this paper.");
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
          message: error instanceof Error ? error.message : "Could not load paper.",
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
        const defaultTopic = (data.assignment?.assignment_name || "").trim();
        if (defaultTopic) setQuickTopic((prev) => prev || defaultTopic);
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paperId: targetPaperId,
        workflowStep: targetStep,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data?.error ||
          "We couldn't save your workflow position. Try again before continuing."
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
        data?.error || "Could not restore your paper workflow. Refresh and try again."
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
      setLockNotice(
        "It looks like your last session ended during generation. Your outline is saved — continue from here."
      );
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
          : "We couldn't save your workflow position. Try again before continuing.";
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "seed",
            assignmentId,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Progress seed failed.");
        }
      } catch {
        setInlineError({
          message:
            "Progress could not be synced to your assignment. Your paper is saved.",
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
            : "Could not restore your paper workflow. Refresh and try again.";
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
          throw new Error(data?.error || "Could not load your paper state.");
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
            : "Could not load your paper state. Refresh to try again.";
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
    if (typeof window === "undefined") return;
    if (step !== "outline" || outlineId || quickOutlineMode) return;

    const key = `academic:quick-outline:${assignmentId || "global"}`;
    const preference = window.sessionStorage.getItem(key);
    if (preference === "declined" || preference === "accepted") {
      if (preference === "accepted") setQuickOutlineMode(true);
      return;
    }

    let shouldPrompt = false;
    if (assignmentMeta?.due_date) {
      const dueAt = new Date(`${assignmentMeta.due_date}T23:59:59`);
      const dueSoon = dueAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000;
      shouldPrompt = dueSoon;
    }

    if (shouldPrompt) {
      setShowQuickOutlinePrompt(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowQuickOutlinePrompt(true);
    }, 5 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [assignmentId, assignmentMeta?.due_date, outlineId, quickOutlineMode, step]);

  const persistQuickOutlinePreference = (value: "accepted" | "declined") => {
    if (typeof window === "undefined") return;
    const key = `academic:quick-outline:${assignmentId || "global"}`;
    window.sessionStorage.setItem(key, value);
  };

  const getStepLockReason = (targetStep: WorkflowStep): string => {
    switch (targetStep) {
      case "generate":
        return "Complete your outline first";
      case "checkpoint":
        return "Generate your paper first";
      case "library":
        return "Complete the Understanding Checkpoint first";
      default:
        return "Complete the previous step first";
    }
  };

  const handleStepClick = (targetStep: WorkflowStep) => {
    if (paperIsComplete) {
      setLockNotice("Paper is complete. Unlock to edit.");
      return;
    }
    void navigateStep(targetStep);
  };

  const steps: WorkflowStep[] = ["outline", "generate", "checkpoint", "library"];

  const isStepCompleted = (target: WorkflowStep): boolean => {
    if (target === "outline") return Boolean(outlineId);
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

  const saveQuickOutlineAndContinue = async () => {
    const topic = quickTopic.trim();
    const sectionTitles = quickSections.map((item) => item.trim()).filter(Boolean).slice(0, 5);
    if (!topic || sectionTitles.length < 2) {
      setQuickError("Add a topic and at least two sections before continuing.");
      return;
    }

    setQuickSaving(true);
    setQuickError(null);
    try {
      const response = await fetch("/api/academic/outline/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          assignmentType: assignmentMeta?.assignment_type || "",
          className: assignmentMeta?.class_name || "",
          assignmentId,
          outline: {
            thesis: topic,
            conclusion: "",
            sections: sectionTitles.map((title, index) => ({
              id: `section_${index + 1}`,
              title,
              main_points: [],
              evidence: [],
              victor_confirmed: false,
              victor_confirmed_at: null,
              sources: [],
            })),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.outlineId) {
        throw new Error(data?.error || "Quick outline could not be saved.");
      }

      setOutlineId(data.outlineId as string);
      setQuickOutlineMode(false);
      setShowQuickOutlinePrompt(false);
      persistQuickOutlinePreference("accepted");
      await completeTask("outline");
      await navigateStep("generate");
    } catch (error) {
      setQuickError(
        error instanceof Error
          ? error.message
          : "Quick outline could not be saved. Try again."
      );
    } finally {
      setQuickSaving(false);
    }
  };

  const dueSoonLine = (() => {
    if (!assignmentMeta?.due_date) return null;
    const dueAt = new Date(`${assignmentMeta.due_date}T23:59:59`);
    if (Number.isNaN(dueAt.getTime())) return null;
    const isDueWithin24Hours = dueAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000;
    if (!isDueWithin24Hours) return null;
    return outlineId
      ? "Due tonight at 11:59pm - your outline is saved and ready."
      : "Due tonight at 11:59pm - start your outline now.";
  })();

  const stepContextLabel =
    step === "outline"
      ? "Build your structure and lock section understanding."
      : step === "generate"
        ? "Generate from the outline you confirmed."
        : step === "checkpoint"
          ? "Complete understanding checks before export."
          : "Export and finalize your paper package.";

  const completeTask = async (
    taskType: "outline" | "draft" | "revise" | "submit",
    targetAssignmentId?: string | null
  ) => {
    const resolvedAssignmentId = targetAssignmentId ?? assignmentId;
    if (!resolvedAssignmentId) return;
    try {
      const response = await fetch("/api/academic/assignment-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          assignmentId: resolvedAssignmentId,
          taskType,
          status: "complete",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Task sync failed.");
      }
    } catch {
      setInlineError({
        message:
          "Progress could not be synced to your assignment. Your paper is saved.",
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
        throw new Error(data?.error || "Could not mark this paper complete.");
      }
      setPaperIsComplete(true);
      setLockNotice("Problem complete.");
      if (data?.set_id) {
        setAssignmentSetId(String(data.set_id));
      }
    } catch (error) {
      setInlineError({
        message:
          error instanceof Error ? error.message : "Could not mark this paper complete.",
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_complete: false }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Could not unlock this paper.");
      }
      setPaperIsComplete(false);
      setLockNotice("Paper unlocked for editing.");
    } catch (error) {
      setInlineError({
        message: error instanceof Error ? error.message : "Could not unlock this paper.",
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
                ? "Outline"
                : stepOption === "generate"
                  ? "Generate"
                  : stepOption === "checkpoint"
                    ? "Checkpoint"
                    : "Library";
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
                Mark as complete
              </button>
            ) : null}
            {paperIsComplete ? (
              <button
                type="button"
                onClick={() => void handleUnlockPaper()}
                className={`${shared.buttonBase} ${shared.buttonSecondary}`}
              >
                Unlock to edit
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
            Assignment context reference
          </summary>
          {setAssignmentPrompt ? (
            <p className="mt-2 text-xs text-slate-300">{setAssignmentPrompt}</p>
          ) : null}
          {setRubricText ? (
            <p className="mt-2 text-xs text-slate-300">Rubric: {setRubricText}</p>
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
            This paper is locked in read-only mode. Use "Unlock to edit" to make changes.
          </div>
        )}
        {step === "outline" && showQuickOutlinePrompt && !quickOutlineMode && !outlineId && (
          <div className={`${shared.surfacePanelCompact} mb-4`}>
            <p className="text-sm text-slate-100">
              Your paper is due soon. Want to use the quick outline to move faster?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuickOutlineMode(true);
                  setShowQuickOutlinePrompt(false);
                  persistQuickOutlinePreference("accepted");
                }}
                className={`${shared.buttonBase} ${shared.buttonPrimary}`}
              >
                Use quick outline
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuickOutlinePrompt(false);
                  persistQuickOutlinePreference("declined");
                }}
                className={`${shared.buttonBase} ${shared.buttonSecondary}`}
              >
                I'll use the full builder
              </button>
            </div>
          </div>
        )}

        {step === "outline" && quickOutlineMode && !outlineId && (
          <div className={`${shared.surfacePanelCompact} mb-4 space-y-3`}>
            <p className="text-sm font-semibold text-slate-100">Quick outline</p>
            <label className="block text-xs text-slate-400">
              Topic
              <input
                value={quickTopic}
                onChange={(event) => setQuickTopic(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            {[0, 1, 2, 3, 4].map((index) => (
              <label key={`quick-section-${index}`} className="block text-xs text-slate-400">
                Section {index + 1}
                <input
                  value={quickSections[index] || ""}
                  onChange={(event) =>
                    setQuickSections((prev) => {
                      const next = [...prev];
                      next[index] = event.target.value;
                      return next;
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            ))}
            {quickError ? <p className="text-xs text-rose-300">{quickError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveQuickOutlineAndContinue()}
                disabled={quickSaving}
                className={`${shared.buttonBase} ${shared.buttonPrimary}`}
              >
                {quickSaving ? "Saving..." : "Save and generate my paper"}
              </button>
              <button
                type="button"
                onClick={() => setQuickOutlineMode(false)}
                className={`${shared.buttonBase} ${shared.buttonSecondary}`}
              >
                Switch to full builder
              </button>
            </div>
          </div>
        )}

        {!paperIsComplete && step === "outline" && (
          <OutlineBuilder
            outlineId={outlineId}
            assignmentId={assignmentId}
            onOutlineSaved={() => void completeTask("outline")}
            onContinue={(id) => {
              setOutlineId(id);
              void navigateStep("generate");
            }}
          />
        )}
        {!paperIsComplete && step === "generate" && (
          <PaperGenerator
            outlineId={outlineId}
            assignmentId={assignmentId}
            paperId={paperId}
            assignmentSetId={assignmentSetId}
            setOrder={paperSetOrder}
            onBack={() => void navigateStep("outline")}
            onGenerated={() => void completeTask("draft")}
            onContinue={(id, generatedContent) => {
              setPaperId(id);
              if (typeof generatedContent === "string" && generatedContent.trim().length > 0) {
                setPaperContent(generatedContent);
              }
              void navigateStep("checkpoint", id);
            }}
          />
        )}
        {!paperIsComplete && step === "checkpoint" && (
          <UnderstandingCheckpoint
            paperId={paperId}
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
    </div>
  );
}
