"use client";

import { useCallback } from "react";
import {
  canCodingReviewEmergencySkip,
  listCodingReviewCheckpointReviews,
  reviewCodingCheckpoint,
  startCodingReviewPlacement,
  submitCodingReviewPlacement,
  updateCodingReviewPathProgress,
  useCodingReviewEmergencySkip as consumeCodingReviewEmergencySkip,
} from "@/lib/academic/codingReviewApi";
import type { VictorHandoffContext } from "@/lib/academic/teachingEngine";
import { LANGUAGE_LABELS } from "./useCodingReview";
import type { UseCodingLearningActionsArgs } from "./useCodingLearningActions.types";

function getLessonStarter(
  language: "python" | "sql" | "javascript",
  lessonTitle: string,
  challengePrompt: string
): string {
  const commentToken = language === "python" ? "#" : language === "sql" ? "--" : "//";
  const lessonLines = lessonTitle
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line, index) =>
      index === 0
        ? `${commentToken} Lesson: ${line.trimStart()}`
        : `${commentToken} ${line.trimStart()}`
    )
    .join("\n");
  const goalLines = challengePrompt
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line, index) =>
      index === 0
        ? `${commentToken} Goal: ${line.trimStart()}`
        : `${commentToken} ${line.trimStart()}`
    )
    .join("\n");

  return [
    lessonLines,
    goalLines,
    `${commentToken} Next step: write your solution below, click Run, then use Run checkpoint.`,
    "",
  ].join("\n");
}

export function useCodingLearningActions(args: UseCodingLearningActionsArgs) {
  const {
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
    hasRunCode,
    codingReviewSessionId,
    checkpointExplain,
    checkpointModify,
    teachingSessionId,
    teachingStepsLength,
    coachingProfile,
    setMode,
    setMessages,
    setConversationId,
    setCreatingStudyGuide,
    setError,
    setToast,
    onOpenStudyHub,
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
  } = args;

  const sendVictorIntervention = useCallback(
    async (context: VictorHandoffContext, reasonLabel: string) => {
      const prompt = `I need help at Step ${context.struggleStep.stepNumber}: ${context.struggleStep.title}.`;
      setMode("teaching");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: prompt, timestamp: new Date().toISOString() },
      ]);
      const response = await fetch("/api/victor/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          mode: "teaching",
          message: prompt,
          workspaceContext: `Coding Review · ${reasonLabel}`,
          victorHandoffContext: context,
          coachingProfile,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Victor intervention failed.");
      if (data?.conversationId) setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Victor intervention started.",
          timestamp: new Date().toISOString(),
          responseType: data.responseType,
        },
      ]);
    },
    [coachingProfile, conversationId, setConversationId, setMessages, setMode]
  );

  const generateStudyGuide = useCallback(async () => {
    if (!currentLesson) return;
    setCreatingStudyGuide(true);
    setError(null);
    try {
      const guideResponse = await fetch("/api/academic/coding-review/study-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          lessonTitle: currentLesson.title,
          lessonIndex: currentLesson.lesson_index,
          conceptSummary: currentLesson.concept_summary,
          challengePrompt: currentLesson.challenge_prompt,
          requiredSkills: currentLesson.required_skills || [],
          pathId: activePathId,
          pathTitle: activePathTitle,
          struggleTopics,
          learnerCode: code.trim(),
        }),
      });
      const guideData = await guideResponse.json();
      if (!guideResponse.ok) {
        throw new Error(guideData.error || "Failed to generate study guide.");
      }
      const guideText = (guideData.guide || "").trim();
      if (!guideText) throw new Error("Generated guide was empty.");

      const form = new FormData();
      form.append("content", guideText);
      form.append("title", `${LANGUAGE_LABELS[language]} · Lesson ${currentLesson.lesson_index + 1}: ${currentLesson.title}`);
      form.append("className", `Coding Review · Learning Coach · ${LANGUAGE_LABELS[language]}`);
      form.append("topic", `${activePathTitle || activePathId || "General path"} · Lesson ${currentLesson.lesson_index + 1}`);
      form.append("sourceType", "learning_coach_guide");
      const uploadResponse = await fetch("/api/study/upload", { method: "POST", body: form });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || "Failed to save study guide.");
      }
      if (uploadData?.mirror?.captured) {
        setToast("Study guide saved. Mirror Mode updated. Opening Study Hub...");
      } else {
        setToast("Study guide saved. Opening Study Hub...");
      }
      onOpenStudyHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate study guide.");
    } finally {
      setCreatingStudyGuide(false);
    }
  }, [activePathId, activePathTitle, code, currentLesson, language, onOpenStudyHub, setCreatingStudyGuide, setError, setToast, struggleTopics]);

  const handleStartPath = useCallback(async (pathId: string) => {
    const result = await startCodingReviewPlacement(pathId);
    setPlacementPath(pathId);
    setActivePathId(pathId);
    setGuidedTrackEnabled(true);
    const challenges = result.challenges || [];
    const placementRequired = result.placementRequired;
    const nextChallengeIndex = Math.max(0, Math.min(result.nextChallengeIndex || 0, Math.max(0, challenges.length - 1)));
    setPlacementChallenges(challenges);
    setPlacementIndex(nextChallengeIndex);
    setPlacementActive(placementRequired && challenges.length > 0);
    setPlacementNote("");
    setPlacementError(null);
    setHasRunCode(false);
    setPathPickerOpen(false);
    if (placementRequired && challenges.length > 0) {
      setToast(nextChallengeIndex > 0 ? `Placement resumed: ${pathId.replace(/_/g, " ")}` : `Placement started: ${pathId.replace(/_/g, " ")}`);
    } else {
      setToast("Placement already completed. Continuing to lessons.");
    }
  }, [setActivePathId, setGuidedTrackEnabled, setHasRunCode, setPathPickerOpen, setPlacementActive, setPlacementChallenges, setPlacementError, setPlacementIndex, setPlacementNote, setPlacementPath, setToast]);

  const handleDisableGuidedTrack = useCallback(() => {
    setGuidedTrackEnabled(false);
    setPlacementActive(false);
    setPlacementPath(null);
    setPlacementChallenges([]);
    setPlacementIndex(0);
    setPlacementNote("");
    setPlacementError(null);
    setHasRunCode(false);
    setActivePathId(null);
    setActiveLessons([]);
    setActiveProgress(null);
    setToast("Learning Coach paused.");
  }, [setActiveLessons, setActivePathId, setActiveProgress, setGuidedTrackEnabled, setHasRunCode, setPlacementActive, setPlacementChallenges, setPlacementError, setPlacementIndex, setPlacementNote, setPlacementPath, setToast]);

  const handleSubmitPlacement = useCallback(async () => {
    if (!placementActive || !placementPath) return;
    if (!hasRunCode || !output) {
      setPlacementError(
        "Run your code first. Placement cannot be evaluated without execution output."
      );
      return;
    }
    setPlacementError(null);
    const currentChallenge = placementChallenges[placementIndex];
    const passed = output?.type === "sql" ? !output.error : !output?.error;
    await submitCodingReviewPlacement({
      path_id: placementPath,
      response: { challenge_index: placementIndex, prompt: currentChallenge, code, output, note: placementNote, passed },
      assessed_level: placementIndex + 1 >= placementChallenges.length ? Math.max(1, Math.min(3, placementChallenges.length)) : null,
      victor_reasoning: placementIndex + 1 >= placementChallenges.length ? "Auto placement based on completion." : null,
    });
    if (placementIndex + 1 < placementChallenges.length) {
      setPlacementIndex((prev) => prev + 1);
      setPlacementNote("");
      setHasRunCode(false);
      setToast("Placement saved. Next challenge ready.");
    } else {
      setPlacementActive(false);
      setHasRunCode(false);
      setToast("Placement complete.");
    }
  }, [code, hasRunCode, output, placementActive, placementChallenges, placementIndex, placementNote, placementPath, setHasRunCode, setPlacementActive, setPlacementError, setPlacementIndex, setPlacementNote, setToast]);

  const handleStartLesson = useCallback(async () => {
    if (!activeProgress) return;
    const lesson = activeLessons.find((item) => item.lesson_index === activeProgress.current_lesson);
    if (!lesson) return;
    const header = getLessonStarter(language, lesson.title, lesson.challenge_prompt);

    if (language === "python") {
      setCode(`${header}# TODO: replace these starter values with your own solution\nname = \"Your Name\"\nage = 0\n\nprint(f\"My name is {name} and I am {age} years old.\")\n`);
    } else if (language === "javascript") {
      setCode(`${header}// TODO: replace these starter values with your own solution\nconst name = \"Your Name\";\nconst age = 0;\n\nconsole.log(\`My name is \${name} and I am \${age} years old.\`);\n`);
    } else {
      setCode(`${header}-- TODO: write your SQL solution below\n-- Example:\n-- SELECT 'Your Name' AS name, 0 AS age;\n`);
    }
    setToast(`Lesson ${lesson.lesson_index + 1}: ${lesson.title}`);
  }, [activeLessons, activeProgress, language, setCode, setToast]);

  const handleMarkLessonComplete = useCallback(async () => {
    if (!activePathId || !activeProgress) return;
    const current = activeProgress.current_lesson;
    const completed = Array.from(new Set([...(activeProgress.lessons_completed || []), current]));
    const nextLesson = Math.min(current + 1, activeLessons.length - 1);
    setActiveProgress({ current_lesson: nextLesson, lessons_completed: completed });
    await updateCodingReviewPathProgress(activePathId, { current_lesson: nextLesson, lessons_completed: completed });
    setToast("Lesson marked complete.");
  }, [activeLessons.length, activePathId, activeProgress, setActiveProgress, setToast]);

  const handleOpenCheckpoint = useCallback(async () => {
    setCheckpointError(null);
    setCheckpointFeedback(null);
    setCheckpointOpen(true);
    try {
      const result = await canCodingReviewEmergencySkip();
      setSkipEligible(result.eligible);
      if (activePathId && activeProgress) {
        const reviews = await listCodingReviewCheckpointReviews({ path_id: activePathId, lesson_index: activeProgress.current_lesson });
        setCheckpointHistory(reviews.map((review) => ({ id: review.id, pass: review.pass, feedback: review.feedback, reviewed_at: review.reviewed_at })));
      }
    } catch {
      setSkipEligible(null);
    }
  }, [activePathId, activeProgress, setCheckpointError, setCheckpointFeedback, setCheckpointHistory, setCheckpointOpen, setSkipEligible]);

  const handleSubmitCheckpoint = useCallback(async () => {
    if (!activePathId || !activeProgress) return;
    if (!checkpointExplain.trim() || !checkpointModify.trim()) {
      setCheckpointError("Answer both checkpoint prompts to continue.");
      return;
    }
    if (!codingReviewSessionId) {
      setCheckpointError("Session not ready yet. Try again in a moment.");
      return;
    }
    setCheckpointReviewing(true);
    setCheckpointError(null);
    try {
      const review = await reviewCodingCheckpoint({
        language,
        code,
        output: output ? JSON.stringify(output) : "",
        explain: checkpointExplain,
        modify: checkpointModify,
        session_id: codingReviewSessionId || "",
        challenge_id: `${activePathId}:${activeProgress.current_lesson}`,
        path_id: activePathId,
        lesson_index: activeProgress.current_lesson,
      });
      setCheckpointFeedback(review.feedback || "");
      if (review.pass) {
        await handleMarkLessonComplete();
        setToast(review?.mirror?.learned ? "Checkpoint passed. Mirror Mode updated from your explanation." : "Checkpoint passed.");
        setCheckpointOpen(false);
        setCheckpointExplain("");
        setCheckpointModify("");
      } else {
        setCheckpointError("Checkpoint not passed. Read Victor's feedback.");
      }
    } catch (err) {
      setCheckpointError(err instanceof Error ? err.message : "Checkpoint review failed.");
    } finally {
      setCheckpointReviewing(false);
    }
  }, [activePathId, activeProgress, checkpointExplain, checkpointModify, codingReviewSessionId, code, handleMarkLessonComplete, language, output, setCheckpointError, setCheckpointExplain, setCheckpointFeedback, setCheckpointModify, setCheckpointOpen, setCheckpointReviewing, setToast]);

  const handleEmergencySkip = useCallback(async () => {
    try {
      await consumeCodingReviewEmergencySkip();
      setSkipEligible(false);
      setCheckpointOpen(false);
      setToast("Emergency skip used.");
    } catch (err) {
      setCheckpointError(err instanceof Error ? err.message : "Emergency skip failed.");
    }
  }, [setCheckpointError, setCheckpointOpen, setSkipEligible, setToast]);

  const requestAssistance = useCallback(async (mode: "steps" | "answer") => {
    const teachingContent = [
      currentLesson ? `Current challenge: ${currentLesson.challenge_prompt}` : null,
      `Language: ${language}`,
      code.trim() ? `My current code:\n${code}` : null,
      output ? `Current output/error:\n${JSON.stringify(output, null, 2)}` : "No run output yet.",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (mode === "steps") {
      setAssistError(null);
      setAssistResponse("");
      setTeachingLoading(true);
      try {
        const response = await fetch("/api/academic/teaching/decompose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: teachingContent, subject: "computer-science", workspaceContext: "coding" }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to generate teaching steps.");
        setTeachingSessionId(data.sessionId || null);
        setTeachingSteps(Array.isArray(data.steps) ? data.steps : []);
        setTeachingCurrentStepIndex(0);
      } catch (err) {
        setAssistError(err instanceof Error ? err.message : "Unable to generate teaching steps.");
      } finally {
        setTeachingLoading(false);
      }
      return;
    }

    setAssistLoading(true);
    setAssistError(null);
    try {
      const prompt = [
        "I still don't understand. Show a reference solution and then similar practice with answers.",
        teachingContent,
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch("/api/victor/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          mode: "coding_review",
          message: prompt,
          workspaceContext: "Coding Review assistant panel",
          coachingProfile,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Assistance request failed.");
      if (data.conversationId) setConversationId(data.conversationId);
      setAssistResponse(data.reply || "No response generated.");
    } catch (err) {
      setAssistError(err instanceof Error ? err.message : "Assistance request failed.");
    } finally {
      setAssistLoading(false);
    }
  }, [code, coachingProfile, conversationId, currentLesson, language, output, setAssistError, setAssistLoading, setAssistResponse, setConversationId, setTeachingCurrentStepIndex, setTeachingLoading, setTeachingSessionId, setTeachingSteps]);

  const handleTeachingNextStep = useCallback((stepNumber: number) => {
    setTeachingSteps((prev) => prev.map((step, index) => (index <= stepNumber ? { ...step, revealed: true } : step)));
    setTeachingCurrentStepIndex((prev) => Math.min(prev + 1, Math.max(0, teachingStepsLength - 1)));
  }, [setTeachingCurrentStepIndex, setTeachingSteps, teachingStepsLength]);

  const handleTeachingAttempt = useCallback(async (stepNumber: number, attempt: string) => {
    if (!teachingSessionId) return;
    setTeachingLoading(true);
    try {
      const response = await fetch("/api/academic/teaching/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: teachingSessionId, stepNumber, attempt, result: "wrong" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to record step attempt.");
      if (Array.isArray(data?.steps)) setTeachingSteps(data.steps);
      if (typeof data?.currentStepIndex === "number") setTeachingCurrentStepIndex(data.currentStepIndex);
      if (data?.struggleDetected && data?.victorHandoffContext) {
        await sendVictorIntervention(data.victorHandoffContext, "Auto intervention");
      }
    } catch (err) {
      setAssistError(err instanceof Error ? err.message : "Unable to record step attempt.");
    } finally {
      setTeachingLoading(false);
    }
  }, [sendVictorIntervention, setAssistError, setTeachingCurrentStepIndex, setTeachingLoading, setTeachingSteps, teachingSessionId]);

  const handleTeachingVictorHelp = useCallback(async (stepNumber: number) => {
    if (!teachingSessionId) return;
    setTeachingLoading(true);
    try {
      const response = await fetch("/api/academic/teaching/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: teachingSessionId, stepNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to request Victor handoff.");
      if (data?.victorHandoffContext) {
        await sendVictorIntervention(data.victorHandoffContext, "Manual intervention");
      }
    } catch (err) {
      setAssistError(err instanceof Error ? err.message : "Unable to request Victor handoff.");
    } finally {
      setTeachingLoading(false);
    }
  }, [sendVictorIntervention, setAssistError, setTeachingLoading, teachingSessionId]);

  return {
    generateStudyGuide,
    handleStartPath,
    handleDisableGuidedTrack,
    handleSubmitPlacement,
    handleStartLesson,
    handleMarkLessonComplete,
    handleOpenCheckpoint,
    handleSubmitCheckpoint,
    handleEmergencySkip,
    requestAssistance,
    handleTeachingNextStep,
    handleTeachingAttempt,
    handleTeachingVictorHelp,
  };
}
