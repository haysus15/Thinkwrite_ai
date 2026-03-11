// src/components/academic-studio/coding-review/CodingReviewPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Trash2 } from "lucide-react";
import shared from "../shared/academic-studio.module.css";
import {
  useVictorChatOptional,
  type VictorMessage,
} from "../victor-chat/VictorChatContext";
import { useCodingReview } from "./hooks/useCodingReview";
import CodeEditor from "./components/CodeEditor";
import CodingReviewCoachPanel from "./components/CodingReviewCoachPanel";
import CodingReviewHeaderBar from "./components/CodingReviewHeaderBar";
import CodingReviewOutputPane from "./components/CodingReviewOutputPane";
import CodingReviewPathPickerModal from "./components/CodingReviewPathPickerModal";
import { useCodingExecutionActions } from "./hooks/useCodingExecutionActions";
import { useCodingLearningActions } from "./hooks/useCodingLearningActions";
import { useCodingReviewEffects } from "./hooks/useCodingReviewEffects";
import type { SystemStep } from "@/lib/academic/teachingEngine";
import CodeReviewCompletionPanel from "./CodeReviewCompletionPanel";

export default function CodingReviewPanel({
  initialReviewId = null,
  setContextId = null,
}: {
  initialReviewId?: string | null;
  setContextId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");
  const reviewIdFromQuery = searchParams.get("reviewId");
  const setIdFromQuery = searchParams.get("setId");
  const reviewId = initialReviewId || reviewIdFromQuery;
  const effectiveSetId = setContextId || setIdFromQuery;
  const victorChat = useVictorChatOptional();
  const [, setLocalMessages] = useState<VictorMessage[]>([]);
  const codingReviewSessionId = victorChat?.codingReviewSessionId ?? null;
  const setCodingReviewSessionId =
    victorChat?.setCodingReviewSessionId ?? (() => null);
  const conversationId = victorChat?.conversationId ?? null;
  const setConversationId = victorChat?.setConversationId ?? (() => null);
  const setMode = victorChat?.setMode ?? (() => null);
  const setMessages = victorChat?.setMessages ?? setLocalMessages;
  const coachingProfile = victorChat?.coachingProfile ?? "tutor";
  const {
    language,
    setLanguage,
    code,
    setCode,
    output,
    setOutput,
    running,
    setRunning,
    error,
    setError,
    layoutMode,
    setLayoutMode,
    activeTab,
    setActiveTab,
    templates,
    setTemplates,
    toast,
    setToast,
    templateQuery,
    setTemplateQuery,
    recentTemplates,
    setRecentTemplates,
    pathPickerOpen,
    setPathPickerOpen,
    pathOptions,
    setPathOptions,
    pathsLoading,
    setPathsLoading,
    pathsError,
    setPathsError,
    placementActive,
    setPlacementActive,
    placementPath,
    setPlacementPath,
    placementChallenges,
    setPlacementChallenges,
    placementIndex,
    setPlacementIndex,
    placementNote,
    setPlacementNote,
    placementError,
    setPlacementError,
    hasRunCode,
    setHasRunCode,
    guidedTrackEnabled,
    setGuidedTrackEnabled,
    pendingPathId,
    setPendingPathId,
    checkpointOpen,
    setCheckpointOpen,
    checkpointExplain,
    setCheckpointExplain,
    checkpointModify,
    setCheckpointModify,
    checkpointError,
    setCheckpointError,
    skipEligible,
    setSkipEligible,
    checkpointFeedback,
    setCheckpointFeedback,
    checkpointReviewing,
    setCheckpointReviewing,
    checkpointHistory,
    setCheckpointHistory,
    struggleTopics,
    setStruggleTopics,
    activePathId,
    setActivePathId,
    activeLessons,
    setActiveLessons,
    activeProgress,
    setActiveProgress,
    saveTimerRef,
    assistLoading,
    setAssistLoading,
    assistError,
    setAssistError,
    assistResponse,
    setAssistResponse,
    creatingStudyGuide,
    setCreatingStudyGuide,
    canRun,
    currentLesson,
    activePathTitle,
  } = useCodingReview();
  const [sessionMeta, setSessionMeta] = useState<{
    challenge_set_id: string | null;
    set_order: number | null;
    victor_context: unknown;
    is_complete: boolean;
  } | null>(null);
  const [setContext, setSetContext] = useState<{
    id: string;
    title: string;
    assignment_prompt: string | null;
  } | null>(null);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [setCompleteResponse, setSetCompleteResponse] = useState<{
    set_complete: boolean;
    set_id: string | null;
  } | null>(null);
  const [teachingSessionId, setTeachingSessionId] = useState<string | null>(null);
  const [teachingSteps, setTeachingSteps] = useState<SystemStep[]>([]);
  const [teachingCurrentStepIndex, setTeachingCurrentStepIndex] = useState(0);
  const [teachingLoading, setTeachingLoading] = useState(false);

  const {
    generateStudyGuide,
    handleStartPath,
    handleDisableGuidedTrack,
    handleSubmitPlacement,
    handleStartLesson,
    handleOpenCheckpoint,
    handleSubmitCheckpoint,
    handleEmergencySkip,
    requestAssistance,
    handleTeachingNextStep,
    handleTeachingAttempt,
    handleTeachingVictorHelp,
  } = useCodingLearningActions({
    language,
    code,
    output,
    conversationId,
    currentLesson,
    activeLessons,
    activePathId,
    activePathTitle,
    activeProgress,
    struggleTopics,
    placementActive,
    placementPath,
    placementChallenges,
    placementIndex,
    placementNote,
    placementError,
    hasRunCode,
    codingReviewSessionId,
    checkpointExplain,
    checkpointModify,
    teachingSessionId,
    teachingStepsLength: teachingSteps.length,
    coachingProfile,
    setMode,
    setMessages,
    setConversationId,
    setCreatingStudyGuide,
    setError,
    setToast,
    onOpenStudyHub: () => router.push("/academic/study-hub?tab=library"),
    setGuidedTrackEnabled,
    setPlacementActive,
    setPlacementPath,
    setPlacementChallenges,
    setPlacementIndex,
    setPlacementNote,
    setPlacementError,
    setHasRunCode,
    setActivePathId,
    setActiveLessons,
    setActiveProgress,
    setPathPickerOpen,
    setCode,
    setCheckpointError,
    setCheckpointFeedback,
    setCheckpointOpen,
    setCheckpointExplain,
    setCheckpointModify,
    setSkipEligible,
    setCheckpointHistory,
    setCheckpointReviewing,
    setAssistLoading,
    setAssistError,
    setAssistResponse,
    setTeachingLoading,
    setTeachingSessionId,
    setTeachingSteps,
    setTeachingCurrentStepIndex,
  });
  const { loadPaths } = useCodingReviewEffects({
    language,
    assignmentId,
    initialSessionId: reviewId,
    codingReviewSessionId,
    code,
    output,
    toast,
    activePathId,
    saveTimerRef,
    setCodingReviewSessionId,
    setTemplates,
    setPathsLoading,
    setPathsError,
    setPathOptions,
    setActiveLessons,
    setActiveProgress,
    setLayoutMode,
    setRecentTemplates,
    setToast,
  });

  const { handleRun, handleClear, handleLoadTemplate } = useCodingExecutionActions({
    canRun,
    running,
    language,
    code,
    codingReviewSessionId,
    struggleTopics,
    activePathId,
    activeProgress,
    setRunning,
    setError,
    setOutput,
    setStruggleTopics,
    setHasRunCode,
    setPlacementError,
    setCode,
    setLanguage,
    setToast,
    setTemplateQuery,
    setRecentTemplates,
  });

  useEffect(() => {
    if (!reviewId || reviewId === "new") return;
    let active = true;
    const loadReview = async () => {
      try {
        const response = await fetch(`/api/code-review/${reviewId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to load coding review.");
        }
        if (!active) return;
        const review = data?.review || {};
        setCodingReviewSessionId(String(review.id));
        if (typeof review.language === "string") {
          const normalized = review.language.trim().toLowerCase();
          if (normalized === "sql" || normalized === "javascript" || normalized === "python") {
            setLanguage(normalized);
          }
        }
        if (typeof review.code_snapshot === "string") {
          setCode(review.code_snapshot);
        }
        setSessionMeta({
          challenge_set_id: review.challenge_set_id || null,
          set_order:
            review.set_order == null || Number.isNaN(Number(review.set_order))
              ? null
              : Number(review.set_order),
          victor_context: review.victor_context || null,
          is_complete: Boolean(review.is_complete),
        });
        setSetContext(data?.set || null);
      } catch (loadError) {
        if (!active) return;
        setCompletionError(
          loadError instanceof Error ? loadError.message : "Unable to load coding review."
        );
      }
    };
    void loadReview();
    return () => {
      active = false;
    };
  }, [reviewId, setCode, setCodingReviewSessionId, setLanguage]);

  const hasCodeContent = useMemo(() => code.trim().length > 0, [code]);
  const isComplete = Boolean(sessionMeta?.is_complete);
  const canMarkComplete = Boolean(codingReviewSessionId && !isComplete && hasCodeContent);
  const handleMarkComplete = async () => {
    if (!codingReviewSessionId) return;
    setCompletionBusy(true);
    setCompletionError(null);
    try {
      const response = await fetch(`/api/code-review/${codingReviewSessionId}/complete`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to complete challenge.");
      }
      setSessionMeta((prev) =>
        prev
          ? { ...prev, is_complete: true }
          : {
              challenge_set_id: data?.set_id || null,
              set_order: null,
              victor_context: null,
              is_complete: true,
            }
      );
      setSetCompleteResponse({
        set_complete: Boolean(data?.set_complete),
        set_id: data?.set_id || null,
      });
    } catch (markError) {
      setCompletionError(
        markError instanceof Error ? markError.message : "Unable to complete challenge."
      );
    } finally {
      setCompletionBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (!codingReviewSessionId) return;
    setCompletionBusy(true);
    setCompletionError(null);
    try {
      const response = await fetch(`/api/code-review/${codingReviewSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_complete: false }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to unlock challenge.");
      }
      setSessionMeta((prev) =>
        prev
          ? { ...prev, is_complete: false }
          : {
              challenge_set_id: data?.review?.challenge_set_id || null,
              set_order: null,
              victor_context: data?.review?.victor_context || null,
              is_complete: false,
            }
      );
      setSetCompleteResponse(null);
    } catch (unlockError) {
      setCompletionError(
        unlockError instanceof Error ? unlockError.message : "Unable to unlock challenge."
      );
    } finally {
      setCompletionBusy(false);
    }
  };

  return (
    <div className={`${shared.root} ${shared.page} coding-review-entrance flex h-full min-h-0 flex-col`}>
      <CodingReviewHeaderBar
        language={language}
        setLanguage={setLanguage}
        running={running}
        canRun={canRun && !isComplete}
        onRun={handleRun}
        onClear={handleClear}
        toast={toast}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-900/40 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {setContext && sessionMeta?.set_order ? (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/academic/code-review/set/${setContext.id}`
                )
              }
              className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300"
            >
              {setContext.title} → Challenge {sessionMeta.set_order}
            </button>
          ) : null}
          {setContext?.assignment_prompt ? (
            <details className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300">
              <summary className="cursor-pointer">Challenge context</summary>
              <p className="mt-1 max-w-3xl text-[11px] text-slate-400">{setContext.assignment_prompt}</p>
            </details>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isComplete ? (
            <button
              type="button"
              onClick={() => void handleMarkComplete()}
              disabled={!canMarkComplete || completionBusy}
              className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 disabled:opacity-60"
            >
              {completionBusy ? "Saving..." : "Mark as complete"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleUnlock()}
              disabled={completionBusy}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-60"
            >
              {completionBusy ? "Unlocking..." : "Unlock to edit"}
            </button>
          )}
        </div>
      </div>
      <CodingReviewCoachPanel
        guidedTrackEnabled={guidedTrackEnabled}
        activePathId={activePathId}
        pathOptions={pathOptions}
        activeLessons={activeLessons}
        activeProgress={activeProgress}
        placementActive={placementActive}
        placementChallenges={placementChallenges}
        placementIndex={placementIndex}
        placementNote={placementNote}
        placementError={placementError}
        hasRunCode={hasRunCode}
        checkpointOpen={checkpointOpen}
        checkpointExplain={checkpointExplain}
        checkpointModify={checkpointModify}
        checkpointError={checkpointError}
        skipEligible={skipEligible}
        checkpointFeedback={checkpointFeedback}
        checkpointReviewing={checkpointReviewing}
        checkpointHistory={checkpointHistory}
        struggleTopics={struggleTopics}
        assistLoading={assistLoading}
        creatingStudyGuide={creatingStudyGuide}
        layoutMode={layoutMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setPathPickerOpen={setPathPickerOpen}
        onDisableGuidedTrack={handleDisableGuidedTrack}
        onStartLesson={handleStartLesson}
        onRequestSteps={() => void requestAssistance("steps")}
        onRequestAnswer={() => void requestAssistance("answer")}
        onOpenCheckpoint={() => void handleOpenCheckpoint()}
        onGenerateStudyGuide={generateStudyGuide}
        onOpenLibrary={() => router.push("/academic/study-hub?tab=library")}
        setCheckpointOpen={setCheckpointOpen}
        setCheckpointExplain={setCheckpointExplain}
        setCheckpointModify={setCheckpointModify}
        onSubmitCheckpoint={handleSubmitCheckpoint}
        onEmergencySkip={handleEmergencySkip}
        onSubmitPlacement={handleSubmitPlacement}
        setPlacementNote={setPlacementNote}
      />

      <div className="coding-review-layout">
        {(layoutMode !== "tablet" || activeTab === "editor") && (
          <CodeEditor
            language={language}
            code={code}
            templateQuery={templateQuery}
            templates={templates}
            recentTemplates={recentTemplates}
            readOnly={isComplete}
            onChangeCode={isComplete ? () => null : setCode}
            onChangeTemplateQuery={setTemplateQuery}
            onLoadTemplate={handleLoadTemplate}
          />
        )}

        {(layoutMode !== "tablet" || activeTab === "output") && (
          <CodingReviewOutputPane
            output={output}
            error={error}
            assistLoading={assistLoading}
            assistError={assistError}
            assistResponse={assistResponse}
            teachingSteps={teachingSteps}
            teachingCurrentStepIndex={teachingCurrentStepIndex}
            teachingLoading={teachingLoading}
            onTeachingNextStep={handleTeachingNextStep}
            onTeachingAttempt={handleTeachingAttempt}
            onTeachingVictorHelp={handleTeachingVictorHelp}
            onRequestSteps={() => void requestAssistance("steps")}
            onRequestAnswer={() => void requestAssistance("answer")}
          />
        )}
      </div>

      <div className="coding-review-sticky-bar">
        <button
          type="button"
          onClick={handleRun}
          disabled={!canRun || running || isComplete}
          className={`${shared.buttonBase} ${shared.buttonPrimary} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <Play className="h-3.5 w-3.5" />
          {running ? "Running" : "Run"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className={`${shared.buttonBase} ${shared.buttonSecondary} inline-flex items-center gap-2`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      <CodingReviewPathPickerModal
        open={pathPickerOpen}
        onClose={() => setPathPickerOpen(false)}
        pathsLoading={pathsLoading}
        pathsError={pathsError}
        pathOptions={pathOptions}
        pendingPathId={pendingPathId}
        setPendingPathId={setPendingPathId}
        onRetry={loadPaths}
        onConfirmPath={handleStartPath}
      />
      {isComplete && codingReviewSessionId ? (
        <div className="mt-3 px-4 pb-4">
          <CodeReviewCompletionPanel
            reviewId={codingReviewSessionId}
            language={language}
            code={code}
            victorContext={sessionMeta?.victor_context}
            onBackToAssignment={
              (effectiveSetId || setCompleteResponse?.set_id)
                ? () =>
                    router.push(
                      `/academic/code-review/set/${effectiveSetId || setCompleteResponse?.set_id}`
                    )
                : undefined
            }
          />
        </div>
      ) : null}
      {completionError ? <p className="px-4 pb-2 text-xs text-rose-200">{completionError}</p> : null}
      {setCompleteResponse?.set_complete && setCompleteResponse.set_id ? (
        <p className="px-4 pb-2 text-xs text-emerald-200">
          Assignment set complete. Use Back to assignment to view the full set summary.
        </p>
      ) : null}
    </div>
  );
}
