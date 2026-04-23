"use client";

import { useMemo, useRef, useState } from "react";
import type { ExecutionResult } from "@/lib/academic/codingReviewExecutors";

export const LANGUAGE_LABELS = {
  python: "Python",
  sql: "SQL",
  javascript: "JavaScript",
} as const;

export type CodingLanguage = keyof typeof LANGUAGE_LABELS;

export type OutputState =
  | {
      type: "python" | "javascript";
      stdout: string;
      stderr: string;
      error?: ExecutionResult["error"];
      executionTime: number;
    }
  | {
      type: "sql";
      columns: string[];
      rows: unknown[][];
      rowCount: number;
      error?: string;
      executionTime: number;
    }
  | null;

export function useCodingReview() {
  const [language, setLanguage] = useState<CodingLanguage>("python");
  const [code, setCode] = useState<string>("# Write your code here\n");
  const [output, setOutput] = useState<OutputState>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  );
  const [activeTab, setActiveTab] = useState<"editor" | "output">("editor");
  const [templates, setTemplates] = useState<Array<{ key: string; label: string }>>(
    []
  );
  const [toast, setToast] = useState<string | null>(null);
  const [templateQuery, setTemplateQuery] = useState("");
  const [recentTemplates, setRecentTemplates] = useState<string[]>([]);
  const [pathPickerOpen, setPathPickerOpen] = useState(false);
  const [pathOptions, setPathOptions] = useState<Array<{ id: string; title: string }>>(
    []
  );
  const [pathsLoading, setPathsLoading] = useState(false);
  const [pathsError, setPathsError] = useState<string | null>(null);
  const [placementActive, setPlacementActive] = useState(false);
  const [placementPath, setPlacementPath] = useState<string | null>(null);
  const [placementChallenges, setPlacementChallenges] = useState<string[]>([]);
  const [placementIndex, setPlacementIndex] = useState(0);
  const [placementNote, setPlacementNote] = useState("");
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [hasRunCode, setHasRunCode] = useState(false);
  const [guidedTrackEnabled, setGuidedTrackEnabled] = useState(false);
  const [pendingPathId, setPendingPathId] = useState<string | null>(null);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [checkpointExplain, setCheckpointExplain] = useState("");
  const [checkpointModify, setCheckpointModify] = useState("");
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [skipEligible, setSkipEligible] = useState<boolean | null>(null);
  const [checkpointFeedback, setCheckpointFeedback] = useState<string | null>(null);
  const [checkpointReviewing, setCheckpointReviewing] = useState(false);
  const [checkpointHistory, setCheckpointHistory] = useState<
    Array<{ id: string; pass: boolean; feedback: string; reviewed_at: string }>
  >([]);
  const [struggleTopics, setStruggleTopics] = useState<string[]>([]);
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [activeLessons, setActiveLessons] = useState<
    Array<{
      lesson_index: number;
      title: string;
      concept_summary: string;
      challenge_prompt: string;
      required_skills: string[];
    }>
  >([]);
  const [activeProgress, setActiveProgress] = useState<{
    current_lesson: number;
    lessons_completed: number[];
  } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [assistResponse, setAssistResponse] = useState<string | null>(null);
  const [creatingStudyGuide, setCreatingStudyGuide] = useState(false);

  const canRun = useMemo(() => code.trim().length > 0, [code]);
  const currentLesson = useMemo(
    () =>
      activeLessons.find(
        (item) => item.lesson_index === (activeProgress?.current_lesson ?? -1)
      ) || null,
    [activeLessons, activeProgress]
  );
  const activePathTitle = useMemo(
    () => pathOptions.find((item) => item.id === activePathId)?.title || null,
    [pathOptions, activePathId]
  );

  return {
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
  };
}
