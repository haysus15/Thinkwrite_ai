"use client";

import { useTranslations } from "next-intl";
import LessonViewer from "./LessonViewer";
import shared from "../../shared/academic.module.css";
import AcademicErrorState from "../../shared/AcademicErrorState";

type Lesson = {
  lesson_index: number;
  title: string;
  concept_summary: string;
  challenge_prompt: string;
};

type Progress = {
  current_lesson: number;
  lessons_completed: number[];
};

type CheckpointHistoryItem = {
  id: string;
  pass: boolean;
  feedback: string;
  reviewed_at: string;
};

type PathOption = { id: string; title: string };

type CodingReviewCoachPanelProps = {
  guidedTrackEnabled: boolean;
  activePathId: string | null;
  pathOptions: PathOption[];
  activeLessons: Lesson[];
  activeProgress: Progress | null;
  placementActive: boolean;
  placementChallenges: string[];
  placementIndex: number;
  placementNote: string;
  placementError: string | null;
  hasRunCode: boolean;
  checkpointOpen: boolean;
  checkpointExplain: string;
  checkpointModify: string;
  checkpointError: string | null;
  skipEligible: boolean | null;
  checkpointFeedback: string | null;
  checkpointReviewing: boolean;
  checkpointHistory: CheckpointHistoryItem[];
  struggleTopics: string[];
  assistLoading: boolean;
  creatingStudyGuide: boolean;
  layoutMode: "desktop" | "tablet" | "mobile";
  activeTab: "editor" | "output";
  setActiveTab: (tab: "editor" | "output") => void;
  setPathPickerOpen: (open: boolean) => void;
  onDisableGuidedTrack: () => void;
  onStartLesson: () => void;
  onRequestSteps: () => void;
  onRequestAnswer: () => void;
  onOpenCheckpoint: () => void;
  onGenerateStudyGuide: () => Promise<void>;
  onOpenLibrary: () => void;
  setCheckpointOpen: (open: boolean) => void;
  setCheckpointExplain: (value: string) => void;
  setCheckpointModify: (value: string) => void;
  onSubmitCheckpoint: () => Promise<void>;
  onEmergencySkip: () => Promise<void>;
  onSubmitPlacement: () => Promise<void>;
  setPlacementNote: (value: string) => void;
};

export default function CodingReviewCoachPanel({
  guidedTrackEnabled,
  activePathId,
  pathOptions,
  activeLessons,
  activeProgress,
  placementActive,
  placementChallenges,
  placementIndex,
  placementNote,
  placementError,
  hasRunCode,
  checkpointOpen,
  checkpointExplain,
  checkpointModify,
  checkpointError,
  skipEligible,
  checkpointFeedback,
  checkpointReviewing,
  checkpointHistory,
  struggleTopics,
  assistLoading,
  creatingStudyGuide,
  layoutMode,
  activeTab,
  setActiveTab,
  setPathPickerOpen,
  onDisableGuidedTrack,
  onStartLesson,
  onRequestSteps,
  onRequestAnswer,
  onOpenCheckpoint,
  onGenerateStudyGuide,
  onOpenLibrary,
  setCheckpointOpen,
  setCheckpointExplain,
  setCheckpointModify,
  onSubmitCheckpoint,
  onEmergencySkip,
  onSubmitPlacement,
  setPlacementNote,
}: CodingReviewCoachPanelProps) {
  const t = useTranslations("academic.codeReviewMode.coach");
  return (
    <>
      <div className={`${shared.surfacePanelCompact} !rounded-none border-x-0 border-t-0 px-5 py-3 text-xs text-slate-300`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{t("title")}</p>
            <p className="mt-1 text-sm text-slate-100">{t("subtitle")}</p>
            <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span className={`rounded-full px-2 py-0.5 ${guidedTrackEnabled ? "bg-emerald-500/20 text-emerald-100" : "bg-white/5 text-slate-400"}`}>
                {guidedTrackEnabled ? t("on") : t("off")}
              </span>
              {guidedTrackEnabled && activePathId && (
                <span className="text-slate-300">{t("track")}: {pathOptions.find((path) => path.id === activePathId)?.title}</span>
              )}
            </div>
            {!guidedTrackEnabled && <p className="mt-1 text-[11px] text-slate-500">{t("choosePath")}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!guidedTrackEnabled ? (
              <button type="button" onClick={() => setPathPickerOpen(true)} className={`${shared.buttonBase} ${shared.buttonPrimary} inline-flex items-center gap-2`}>
                {t("turnOn")}
              </button>
            ) : (
              <button type="button" onClick={onDisableGuidedTrack} className={`${shared.buttonBase} ${shared.buttonSecondary} inline-flex items-center gap-2`}>
                {t("turnOff")}
              </button>
            )}
          </div>
        </div>
      </div>

      {activePathId && activeLessons.length > 0 && activeProgress && !placementActive && (
        <LessonViewer
          currentLessonIndex={activeProgress.current_lesson}
          lessonCount={activeLessons.length}
          lessonTitle={activeLessons.find((item) => item.lesson_index === activeProgress.current_lesson)?.title || ""}
          lessonSummary={activeLessons.find((item) => item.lesson_index === activeProgress.current_lesson)?.concept_summary || ""}
          struggleTopics={struggleTopics}
          assistLoading={assistLoading}
          creatingStudyGuide={creatingStudyGuide}
          onStartLesson={onStartLesson}
          onRequestSteps={onRequestSteps}
          onRequestAnswer={onRequestAnswer}
          onOpenCheckpoint={onOpenCheckpoint}
          onGenerateStudyGuide={onGenerateStudyGuide}
          onOpenLibrary={onOpenLibrary}
        />
      )}

      {checkpointOpen && (
        <div className={`${shared.surfacePanelCompact} !rounded-none border-x-0 border-t-0 px-5 py-4 text-xs text-slate-200`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-100">{t("checkpointTitle")}</p>
            <button
              type="button"
              onClick={() => setCheckpointOpen(false)}
              className={`${shared.buttonBase} ${shared.buttonSecondary} !px-3 !py-1 !text-[10px] uppercase tracking-[0.2em]`}
            >
              {t("close")}
            </button>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t("explainYourCode")}</p>
              <textarea value={checkpointExplain} onChange={(event) => setCheckpointExplain(event.target.value)} rows={3} className={`mt-1 w-full ${shared.control}`} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t("modifyOnRequest")}</p>
              <textarea
                value={checkpointModify}
                onChange={(event) => setCheckpointModify(event.target.value)}
                rows={3}
                className={`mt-1 w-full ${shared.control}`}
                placeholder={t("modifyPlaceholder")}
              />
            </div>
            {checkpointError && <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{checkpointError}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onSubmitCheckpoint()}
                disabled={checkpointReviewing}
                className={`${shared.buttonBase} ${shared.buttonPrimary} disabled:opacity-60`}
              >
                {checkpointReviewing ? t("reviewing") : t("submitCheckpoint")}
              </button>
              {skipEligible && (
                <button type="button" onClick={() => void onEmergencySkip()} className={`${shared.buttonBase} ${shared.buttonSecondary}`}>
                  {t("emergencySkip")}
                </button>
              )}
              {skipEligible === false && <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t("skipUsed")}</span>}
            </div>
            {checkpointFeedback && (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t("victorFeedback")}</p>
                <p className="mt-2 whitespace-pre-wrap">{checkpointFeedback}</p>
              </div>
            )}
            {checkpointHistory.length > 0 && (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t("pastReviews")}</p>
                <div className="mt-2 space-y-2">
                  {checkpointHistory.map((review) => (
                    <div key={review.id} className="rounded-md border border-white/10 bg-white/5 px-2 py-2">
                      <p className="text-[11px] text-slate-300">{review.pass ? t("passed") : t("notPassed")} · {new Date(review.reviewed_at).toLocaleString()}</p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-200">{review.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {placementActive && placementChallenges.length > 0 && (
        <div className={`${shared.surfacePanelCompact} !rounded-none border-x-0 border-t-0 px-5 py-3 text-xs text-amber-100`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-amber-200/80">
                {t("placementChallenge", { current: placementIndex + 1, total: placementChallenges.length })}
              </p>
              <p className="mt-1 text-sm text-amber-50">{placementChallenges[placementIndex]}</p>
            </div>
            <button
              type="button"
              onClick={() => void onSubmitPlacement()}
              disabled={!hasRunCode}
              title={!hasRunCode ? t("runBeforeSubmitting") : undefined}
              className={`${shared.buttonBase} ${shared.buttonPrimary} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {t("submitAttempt")}
            </button>
          </div>
          {placementError && (
            <AcademicErrorState message={placementError} className="!min-h-0 py-2" />
          )}
          <div className="mt-2">
            <input
              value={placementNote}
              onChange={(event) => setPlacementNote(event.target.value)}
              placeholder={t("placementNotePlaceholder")}
              className={`w-full ${shared.control} placeholder:text-amber-200/60`}
            />
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-amber-100/80">
            {hasRunCode ? t("runCaptured") : t("runBeforeSubmitting")}
          </div>
        </div>
      )}

      {layoutMode === "tablet" && (
        <div className={`${shared.surfacePanelCompact} !rounded-none border-x-0 border-t-0 flex items-center gap-2 px-4 py-2 text-xs text-slate-300`}>
          <button
            type="button"
            onClick={() => setActiveTab("editor")}
            className={`${shared.buttonBase} !px-3 !py-1 ${
              activeTab === "editor" ? "border-amber-400/50 bg-amber-500/20 text-amber-100" : `${shared.buttonSecondary}`
            }`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("output")}
            className={`${shared.buttonBase} !px-3 !py-1 ${
              activeTab === "output" ? "border-sky-400/50 bg-sky-500/20 text-sky-100" : `${shared.buttonSecondary}`
            }`}
          >
            Output
          </button>
        </div>
      )}
    </>
  );
}
