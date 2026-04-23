"use client";

import StudyGuideGenerator from "./StudyGuideGenerator";

type LessonViewerProps = {
  currentLessonIndex: number;
  lessonCount: number;
  lessonTitle: string;
  lessonSummary: string;
  struggleTopics: string[];
  assistLoading: boolean;
  creatingStudyGuide: boolean;
  onStartLesson: () => void;
  onRequestSteps: () => void;
  onRequestAnswer: () => void;
  onOpenCheckpoint: () => void;
  onGenerateStudyGuide: () => void;
  onOpenLibrary: () => void;
};

export default function LessonViewer({
  currentLessonIndex,
  lessonCount,
  lessonTitle,
  lessonSummary,
  struggleTopics,
  assistLoading,
  creatingStudyGuide,
  onStartLesson,
  onRequestSteps,
  onRequestAnswer,
  onOpenCheckpoint,
  onGenerateStudyGuide,
  onOpenLibrary,
}: LessonViewerProps) {
  return (
    <div className="border-b border-amber-400/25 bg-gradient-to-r from-amber-500/10 to-slate-900/60 px-5 py-3 text-xs text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
            Current lesson {currentLessonIndex + 1} of {lessonCount}
          </p>
          <p className="mt-1 text-sm text-slate-100">{lessonTitle}</p>
          <p className="mt-1 text-xs text-slate-400">{lessonSummary}</p>
          <p className="mt-2 text-xs text-slate-300">
            Next: click <span className="font-semibold text-sky-200">Load lesson</span>,
            complete the TODO in the editor, click{" "}
            <span className="font-semibold text-emerald-200">Run</span>, then submit{" "}
            <span className="font-semibold text-amber-200">Run checkpoint</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onStartLesson}
            className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-100 hover:bg-sky-500/25"
          >
            Load lesson
          </button>
          <button
            type="button"
            onClick={onRequestSteps}
            disabled={assistLoading}
            className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-100 hover:bg-sky-500/25 disabled:opacity-60"
          >
            Explain steps
          </button>
          <button
            type="button"
            onClick={onRequestAnswer}
            disabled={assistLoading}
            className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/25 disabled:opacity-60"
          >
            I&apos;m stuck
          </button>
          <button
            type="button"
            onClick={onOpenCheckpoint}
            className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/25"
          >
            Run checkpoint
          </button>
          <StudyGuideGenerator
            creatingStudyGuide={creatingStudyGuide}
            onGenerate={onGenerateStudyGuide}
            onOpenLibrary={onOpenLibrary}
          />
        </div>
      </div>
      {struggleTopics.length > 0 && (
        <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Struggle topics: {struggleTopics.join(", ")}
        </div>
      )}
    </div>
  );
}

