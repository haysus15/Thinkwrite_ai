// src/components/academic-studio/coding-review/CodingReviewPanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Trash2, Code2, Layers, Lightbulb } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { javascript } from "@codemirror/lang-javascript";
import { useVictorChat } from "../victor-chat/VictorChatContext";
import {
  JsExecutor,
  PythonExecutor,
  SqlExecutor,
  type ExecutionResult,
} from "@/lib/academic/codingReviewExecutors";
import {
  createCodingReviewSession,
  canCodingReviewEmergencySkip,
  listCodingReviewTemplates,
  logCodingReviewExecution,
  getCodingReviewPath,
  listCodingReviewCheckpointReviews,
  reviewCodingCheckpoint,
  startCodingReviewPlacement,
  submitCodingReviewPlacement,
  updateCodingReviewPathProgress,
  updateCodingReviewSession,
  useCodingReviewEmergencySkip as consumeCodingReviewEmergencySkip,
} from "@/lib/academic/codingReviewApi";
import { getTemplateByKey } from "@/lib/academic/templates/codingReviewTemplates";

const LANGUAGE_LABELS = {
  python: "Python",
  sql: "SQL",
  javascript: "JavaScript",
} as const;

type CodingLanguage = keyof typeof LANGUAGE_LABELS;

type OutputState =
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
      rows: any[][];
      rowCount: number;
      error?: string;
      executionTime: number;
    }
  | null;

export default function CodingReviewPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");
  const {
    codingReviewSessionId,
    setCodingReviewSessionId,
    conversationId,
    setConversationId,
  } = useVictorChat();
  const [language, setLanguage] = useState<CodingLanguage>("python");
  const [code, setCode] = useState<string>("# Write your code here\n");
  const [output, setOutput] = useState<OutputState>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  );
  const [activeTab, setActiveTab] = useState<"editor" | "output">("editor");
  const [templates, setTemplates] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [toast, setToast] = useState<string | null>(null);
  const [templateQuery, setTemplateQuery] = useState("");
  const [recentTemplates, setRecentTemplates] = useState<string[]>([]);
  const [pathPickerOpen, setPathPickerOpen] = useState(false);
  const [pathOptions, setPathOptions] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [pathsLoading, setPathsLoading] = useState(false);
  const [pathsError, setPathsError] = useState<string | null>(null);
  const [placementActive, setPlacementActive] = useState(false);
  const [placementPath, setPlacementPath] = useState<string | null>(null);
  const [placementChallenges, setPlacementChallenges] = useState<string[]>([]);
  const [placementIndex, setPlacementIndex] = useState(0);
  const [placementNote, setPlacementNote] = useState("");
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
      if (!guideText) {
        throw new Error("Generated guide was empty.");
      }

      const form = new FormData();
      form.append("content", guideText);
      form.append(
        "title",
        `${LANGUAGE_LABELS[language]} · Lesson ${currentLesson.lesson_index + 1}: ${currentLesson.title}`
      );
      form.append(
        "className",
        `Coding Review · Learning Coach · ${LANGUAGE_LABELS[language]}`
      );
      form.append(
        "topic",
        `${activePathTitle || activePathId || "General path"} · Lesson ${
          currentLesson.lesson_index + 1
        }`
      );
      form.append("sourceType", "coding_review_learning_coach");
      const uploadResponse = await fetch("/api/study/upload", {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || "Failed to save study guide.");
      }
      setToast("Study guide saved. Opening Study Library...");
      router.push("/academic-studio/dashboard?workspace=study-library");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate study guide."
      );
    } finally {
      setCreatingStudyGuide(false);
    }
  }, [
    activePathId,
    activePathTitle,
    code,
    currentLesson,
    language,
    router,
    struggleTopics,
  ]);

  useEffect(() => {
    if (language === "sql") {
      SqlExecutor.loadDatabase("").catch(() => null);
    }
  }, [language]);

  useEffect(() => {
    if (!assignmentId) return;
    if (codingReviewSessionId) return;
    createCodingReviewSession({
      language: "python",
      entry_type: "assignment",
      assignment_id: assignmentId,
      code_snapshot: code,
    })
      .then((session) => setCodingReviewSessionId(session.id))
      .catch(() => null);
  }, [assignmentId, codingReviewSessionId, code, setCodingReviewSessionId]);

  useEffect(() => {
    let active = true;
    listCodingReviewTemplates()
      .then((items) => {
        if (!active) return;
        const mapped = items
          .map((item) => {
            const key = item.frontend_loader_key;
            if (!getTemplateByKey(key)) return null;
            const label = `${LANGUAGE_LABELS[item.language]}: ${item.title}`;
            return { key, label };
          })
          .filter(Boolean) as Array<{ key: string; label: string }>;
        setTemplates(mapped);
      })
      .catch(() => {
        if (!active) return;
        setTemplates([
          { key: "python_blank", label: "Python: Blank" },
          { key: "python_data_analysis", label: "Python: Data analysis" },
          { key: "python_web_scrape", label: "Python: Web scraping" },
          { key: "python_game_loop", label: "Python: Game loop" },
          { key: "python_api_request", label: "Python: API request" },
          { key: "sql_blank", label: "SQL: Blank" },
          { key: "sql_university_db", label: "SQL: University DB" },
          { key: "sql_ecommerce_db", label: "SQL: E-commerce DB" },
          { key: "sql_music_db", label: "SQL: Music DB" },
          { key: "js_blank", label: "JS: Blank" },
          { key: "js_dom_starter", label: "JS: DOM starter" },
          { key: "js_fetch_starter", label: "JS: Fetch starter" },
          { key: "js_array_playground", label: "JS: Array playground" },
        ]);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadPaths = useCallback(() => {
    let active = true;
    setPathsLoading(true);
    setPathsError(null);
    fetch("/api/academic/coding-review/paths")
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!active) return;
        if (!ok) {
          setPathOptions([]);
          setPathsError(data?.error || "Failed to load tracks.");
          return;
        }
        if (Array.isArray(data?.paths)) {
          setPathOptions(
            data.paths.map((path: { id: string; title: string }) => ({
              id: path.id,
              title: path.title,
            }))
          );
        } else {
          setPathOptions([]);
          setPathsError("No tracks available.");
        }
      })
      .catch(() => {
        if (!active) return;
        setPathOptions([]);
        setPathsError("Failed to load tracks.");
      })
      .finally(() => {
        if (!active) return;
        setPathsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadPaths();
    return cleanup;
  }, [loadPaths]);

  useEffect(() => {
    if (!activePathId) return;
    let active = true;
    getCodingReviewPath(activePathId)
      .then((data) => {
        if (!active) return;
        setActiveLessons(
          data.lessons.map((lesson) => ({
            lesson_index: lesson.lesson_index,
            title: lesson.title,
            concept_summary: lesson.concept_summary,
            challenge_prompt: lesson.challenge_prompt,
            required_skills: lesson.required_skills || [],
          }))
        );
        if (data.progress) {
          setActiveProgress({
            current_lesson: data.progress.current_lesson,
            lessons_completed: data.progress.lessons_completed || [],
          });
        } else {
          setActiveProgress({ current_lesson: 0, lessons_completed: [] });
        }
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [activePathId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateLayout = () => {
      const width = window.innerWidth;
      if (width <= 768) {
        setLayoutMode("mobile");
      } else if (width <= 1024) {
        setLayoutMode("tablet");
      } else {
        setLayoutMode("desktop");
      }
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const panel = document.getElementById("coding-review-template-menu");
      if (!panel) return;
      const target = event.target as HTMLElement;
      if (!panel.contains(target) && !target.closest("[data-template-toggle]")) {
        panel.removeAttribute("data-open");
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("coding-review-recent-templates");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentTemplates(parsed.slice(0, 5));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!codingReviewSessionId) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      updateCodingReviewSession(codingReviewSessionId, {
        code_snapshot: code,
      }).catch(() => null);
    }, 800);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [code, codingReviewSessionId]);

  useEffect(() => {
    if (!codingReviewSessionId) return;
    if (!output) return;
    const outputText =
      output.type === "sql"
        ? output.error
          ? output.error
          : `Rows: ${output.rowCount}`
        : output.error
          ? output.error.message
          : [output.stdout, output.stderr].filter(Boolean).join("\\n");
    updateCodingReviewSession(codingReviewSessionId, {
      output_snapshot: outputText,
    }).catch(() => null);
  }, [output, codingReviewSessionId]);

  const handleRun = useCallback(async () => {
    if (!canRun || running) return;
    setRunning(true);
    setError(null);

    try {
      if (language === "python") {
        const result = await PythonExecutor.execute(code);
        setOutput({
          type: "python",
          stdout: result.stdout,
          stderr: result.stderr,
          error: result.error,
          executionTime: result.executionTime,
        });
        if (codingReviewSessionId) {
          await logCodingReviewExecution({
            language: "python",
            session_id: codingReviewSessionId,
            code,
            stdout: result.stdout,
            stderr: result.stderr,
            error: result.error ? result.error.message : null,
            execution_time_ms: result.executionTime,
          });
        }
        if (result.error) {
          const nextTopics = Array.from(
            new Set([...struggleTopics, result.error.type.toLowerCase()])
          );
          setStruggleTopics(nextTopics);
          if (activePathId) {
            updateCodingReviewPathProgress(activePathId, {
              lessons_completed: activeProgress?.lessons_completed || [],
              current_lesson: activeProgress?.current_lesson || 0,
              struggle_topics: nextTopics,
            }).catch(() => null);
          }
        }
      } else if (language === "sql") {
        const result = await SqlExecutor.execute(code);
        setOutput({
          type: "sql",
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
          error: result.error,
          executionTime: result.executionTime,
        });
        if (codingReviewSessionId) {
          await logCodingReviewExecution({
            language: "sql",
            session_id: codingReviewSessionId,
            code,
            stdout: result.error ? "" : "Query executed.",
            stderr: result.error || "",
            error: result.error || null,
            execution_time_ms: result.executionTime,
          });
        }
        if (result.error) {
          const nextTopics = Array.from(
            new Set([...struggleTopics, "sql_error"])
          );
          setStruggleTopics(nextTopics);
          if (activePathId) {
            updateCodingReviewPathProgress(activePathId, {
              lessons_completed: activeProgress?.lessons_completed || [],
              current_lesson: activeProgress?.current_lesson || 0,
              struggle_topics: nextTopics,
            }).catch(() => null);
          }
        }
      } else {
        const result = await JsExecutor.execute(code);
        const stdout = result.consoleOutput.join("\n");
        setOutput({
          type: "javascript",
          stdout,
          stderr: "",
          error: result.error,
          executionTime: result.executionTime,
        });
        if (codingReviewSessionId) {
          await logCodingReviewExecution({
            language: "javascript",
            session_id: codingReviewSessionId,
            code,
            stdout,
            stderr: "",
            error: result.error ? result.error.message : null,
            execution_time_ms: result.executionTime,
          });
        }
        if (result.error) {
          const nextTopics = Array.from(
            new Set([...struggleTopics, result.error.type.toLowerCase()])
          );
          setStruggleTopics(nextTopics);
          if (activePathId) {
            updateCodingReviewPathProgress(activePathId, {
              lessons_completed: activeProgress?.lessons_completed || [],
              current_lesson: activeProgress?.current_lesson || 0,
              struggle_topics: nextTopics,
            }).catch(() => null);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed.");
    } finally {
      setRunning(false);
    }
  }, [
    canRun,
    running,
    language,
    code,
    codingReviewSessionId,
    struggleTopics,
    activePathId,
    activeProgress,
  ]);

  const handleClear = () => {
    setCode("");
    setOutput(null);
    setError(null);
  };

  const handleLoadTemplate = async (key: string) => {
    const template = getTemplateByKey(key);
    if (!template) return;
    setLanguage(template.language);
    setCode(template.code || "");
    if (template.language === "sql") {
      await SqlExecutor.loadDatabase(template.sqlSchema || "");
    }
    if (template.language === "javascript" && template.template_type === "dom") {
      await JsExecutor.executeWithDOM("", template.domHtml || "");
    }
    setOutput(null);
    setError(null);
    setToast(`Loaded ${template.title}`);
    setTemplateQuery("");
    setRecentTemplates((prev) => {
      const next = [key, ...prev.filter((item) => item !== key)].slice(0, 5);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "coding-review-recent-templates",
          JSON.stringify(next)
        );
      }
      return next;
    });
  };

  const handleStartPath = async (pathId: string) => {
    const result = await startCodingReviewPlacement(pathId);
    setPlacementPath(pathId);
    setActivePathId(pathId);
    setGuidedTrackEnabled(true);
    const challenges = result.challenges || [];
    const placementRequired = result.placementRequired;
    const nextChallengeIndex = Math.max(
      0,
      Math.min(result.nextChallengeIndex || 0, Math.max(0, challenges.length - 1))
    );
    setPlacementChallenges(challenges);
    setPlacementIndex(nextChallengeIndex);
    setPlacementActive(placementRequired && challenges.length > 0);
    setPlacementNote("");
    setPathPickerOpen(false);
    if (placementRequired && challenges.length > 0) {
      setToast(
        nextChallengeIndex > 0
          ? `Placement resumed: ${pathId.replace(/_/g, " ")}`
          : `Placement started: ${pathId.replace(/_/g, " ")}`
      );
    } else {
      setToast("Placement already completed. Continuing to lessons.");
    }
  };

  const handleDisableGuidedTrack = () => {
    setGuidedTrackEnabled(false);
    setPlacementActive(false);
    setPlacementPath(null);
    setPlacementChallenges([]);
    setPlacementIndex(0);
    setPlacementNote("");
    setActivePathId(null);
    setActiveLessons([]);
    setActiveProgress(null);
    setToast("Learning Coach paused.");
  };

  const handleSubmitPlacement = async () => {
    if (!placementActive || !placementPath) return;
    const currentChallenge = placementChallenges[placementIndex];
    const passed = output?.type === "sql" ? !output.error : !output?.error;
    await submitCodingReviewPlacement({
      path_id: placementPath,
      response: {
        challenge_index: placementIndex,
        prompt: currentChallenge,
        code,
        output,
        note: placementNote,
        passed,
      },
      assessed_level:
        placementIndex + 1 >= placementChallenges.length
          ? Math.max(1, Math.min(3, placementChallenges.length))
          : null,
      victor_reasoning:
        placementIndex + 1 >= placementChallenges.length
          ? "Auto placement based on completion."
          : null,
    });
    if (placementIndex + 1 < placementChallenges.length) {
      setPlacementIndex((prev) => prev + 1);
      setPlacementNote("");
      setToast("Placement saved. Next challenge ready.");
    } else {
      setPlacementActive(false);
      setToast("Placement complete.");
    }
  };

  const handleStartLesson = async () => {
    if (!activeProgress) return;
    const lesson = activeLessons.find(
      (item) => item.lesson_index === activeProgress.current_lesson
    );
    if (!lesson) return;
    const commentToken = language === "sql" ? "--" : "#";
    const commentMultiline = (label: string, value: string) => {
      const normalized = value
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trimEnd());
      return normalized
        .map((line, index) =>
          index === 0
            ? `${commentToken} ${label}: ${line.trimStart()}`
            : `${commentToken} ${line.trimStart()}`
        )
        .join("\n");
    };
    const header = [
      commentMultiline("Lesson", lesson.title),
      commentMultiline("Goal", lesson.challenge_prompt),
      `${commentToken} Next step: write your solution below, click Run, then use Run checkpoint.`,
      "",
    ].join("\n");

    if (language === "python") {
      setCode(
        `${header}${commentToken} TODO: replace these starter values with your own solution\nname = "Your Name"\nage = 0\n\nprint(f"My name is {name} and I am {age} years old.")\n`
      );
    } else if (language === "javascript") {
      setCode(
        `${header}// TODO: replace these starter values with your own solution\nconst name = "Your Name";\nconst age = 0;\n\nconsole.log(\`My name is \${name} and I am \${age} years old.\`);\n`
      );
    } else {
      setCode(
        `${header}-- TODO: write your SQL solution below\n-- Example:\n-- SELECT 'Your Name' AS name, 0 AS age;\n`
      );
    }
    setToast(`Lesson ${lesson.lesson_index + 1}: ${lesson.title}`);
  };

  const handleMarkLessonComplete = async () => {
    if (!activePathId || !activeProgress) return;
    const current = activeProgress.current_lesson;
    const completed = Array.from(
      new Set([...(activeProgress.lessons_completed || []), current])
    );
    const nextLesson = Math.min(current + 1, activeLessons.length - 1);
    setActiveProgress({
      current_lesson: nextLesson,
      lessons_completed: completed,
    });
    await updateCodingReviewPathProgress(activePathId, {
      current_lesson: nextLesson,
      lessons_completed: completed,
    });
    setToast("Lesson marked complete.");
  };

  const handleOpenCheckpoint = async () => {
    setCheckpointError(null);
    setCheckpointFeedback(null);
    setCheckpointOpen(true);
    try {
      const result = await canCodingReviewEmergencySkip();
      setSkipEligible(result.eligible);
      if (activePathId && activeProgress) {
        const reviews = await listCodingReviewCheckpointReviews({
          path_id: activePathId,
          lesson_index: activeProgress.current_lesson,
        });
        setCheckpointHistory(
          reviews.map((review) => ({
            id: review.id,
            pass: review.pass,
            feedback: review.feedback,
            reviewed_at: review.reviewed_at,
          }))
        );
      }
    } catch {
      setSkipEligible(null);
    }
  };

  const handleSubmitCheckpoint = async () => {
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
        setToast("Checkpoint passed.");
        setCheckpointOpen(false);
        setCheckpointExplain("");
        setCheckpointModify("");
      } else {
        setCheckpointError("Checkpoint not passed. Read Victor's feedback.");
      }
    } catch (err) {
      setCheckpointError(
        err instanceof Error ? err.message : "Checkpoint review failed."
      );
    } finally {
      setCheckpointReviewing(false);
    }
  };

  const handleEmergencySkip = async () => {
    try {
      await consumeCodingReviewEmergencySkip();
      setSkipEligible(false);
      setCheckpointOpen(false);
      setToast("Emergency skip used.");
    } catch (err) {
      setCheckpointError(
        err instanceof Error ? err.message : "Emergency skip failed."
      );
    }
  };

  const requestAssistance = useCallback(
    async (mode: "steps" | "answer") => {
      setAssistLoading(true);
      setAssistError(null);
      try {
        const prompt = [
          mode === "steps"
            ? "Please break this down step-by-step so I can solve it myself."
            : "I still don't understand. Show a reference solution and then similar practice with answers.",
          currentLesson
            ? `Current challenge: ${currentLesson.challenge_prompt}`
            : null,
          `Language: ${language}`,
          code.trim() ? `My current code:\n${code}` : null,
          output
            ? `Current output/error:\n${JSON.stringify(output, null, 2)}`
            : "No run output yet.",
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
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Assistance request failed.");
        }
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
        setAssistResponse(data.reply || "No response generated.");
      } catch (err) {
        setAssistError(
          err instanceof Error ? err.message : "Assistance request failed."
        );
      } finally {
        setAssistLoading(false);
      }
    },
    [code, conversationId, currentLesson, language, output, setConversationId]
  );

  return (
    <div className="flex h-full min-h-0 flex-col coding-review-entrance">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <Code2 className="h-4 w-4 text-amber-200" />
          Coding Review
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as CodingLanguage)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
          >
            {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Editor language
          </span>
          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun || running}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-3.5 w-3.5" />
            {running ? "Running" : "Run"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200 transition hover:bg-white/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>
      {toast && (
        <div className="border-b border-white/10 bg-emerald-500/10 px-5 py-2 text-xs text-emerald-100">
          {toast}
        </div>
      )}
      <div className="border-b border-white/10 bg-slate-900/50 px-5 py-3 text-xs text-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
              Learning Coach
            </p>
            <p className="mt-1 text-sm text-slate-100">
              Structured learning with placement and lessons.
            </p>
            <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  guidedTrackEnabled
                    ? "bg-emerald-500/20 text-emerald-100"
                    : "bg-white/5 text-slate-400"
                }`}
              >
                {guidedTrackEnabled ? "On" : "Off"}
              </span>
              {guidedTrackEnabled && activePathId && (
                <span className="text-slate-300">
                  Track:{" "}
                  {
                    pathOptions.find((path) => path.id === activePathId)?.title
                  }
                </span>
              )}
            </div>
            {!guidedTrackEnabled && (
              <p className="mt-1 text-[11px] text-slate-500">
                Choose a learning path to turn it on.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!guidedTrackEnabled ? (
              <button
                type="button"
                onClick={() => setPathPickerOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-xs text-amber-100 transition hover:bg-amber-500/25"
              >
                Turn on Learning Coach
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDisableGuidedTrack}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200 transition hover:bg-white/10"
              >
                Turn off Learning Coach
              </button>
            )}
          </div>
        </div>
      </div>
      {activePathId && activeLessons.length > 0 && activeProgress && !placementActive && (
        <div className="border-b border-amber-400/25 bg-gradient-to-r from-amber-500/10 to-slate-900/60 px-5 py-3 text-xs text-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
                Current lesson {activeProgress.current_lesson + 1} of{" "}
                {activeLessons.length}
              </p>
              <p className="mt-1 text-sm text-slate-100">
                {
                  activeLessons.find(
                    (item) => item.lesson_index === activeProgress.current_lesson
                  )?.title
                }
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {
                  activeLessons.find(
                    (item) => item.lesson_index === activeProgress.current_lesson
                  )?.concept_summary
                }
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Next: click <span className="font-semibold text-sky-200">Load lesson</span>,
                complete the TODO in the editor, click{" "}
                <span className="font-semibold text-emerald-200">Run</span>, then
                submit <span className="font-semibold text-amber-200">Run checkpoint</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartLesson}
                className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-100 hover:bg-sky-500/25"
              >
                Load lesson
              </button>
              <button
                type="button"
                onClick={() => requestAssistance("steps")}
                disabled={assistLoading}
                className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-100 hover:bg-sky-500/25 disabled:opacity-60"
              >
                Explain steps
              </button>
              <button
                type="button"
                onClick={() => requestAssistance("answer")}
                disabled={assistLoading}
                className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/25 disabled:opacity-60"
              >
                I&apos;m stuck
              </button>
              <button
                type="button"
                onClick={handleOpenCheckpoint}
                className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/25"
              >
                Run checkpoint
              </button>
              <button
                type="button"
                onClick={generateStudyGuide}
                disabled={creatingStudyGuide}
                className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
              >
                {creatingStudyGuide ? "Creating guide..." : "Generate study guide"}
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push("/academic-studio/dashboard?workspace=study-library")
                }
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
              >
                Open Study Library
              </button>
            </div>
          </div>
          {struggleTopics.length > 0 && (
            <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Struggle topics: {struggleTopics.join(", ")}
            </div>
          )}
        </div>
      )}
      {checkpointOpen && (
        <div className="border-b border-white/10 bg-slate-900/70 px-5 py-4 text-xs text-slate-200">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-100">Checkpoint</p>
            <button
              type="button"
              onClick={() => setCheckpointOpen(false)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300"
            >
              Close
            </button>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Explain your code
              </p>
              <textarea
                value={checkpointExplain}
                onChange={(event) => setCheckpointExplain(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Modify on request
              </p>
              <textarea
                value={checkpointModify}
                onChange={(event) => setCheckpointModify(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
                placeholder="Describe how you'd change the code if Victor asked."
              />
            </div>
            {checkpointError && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {checkpointError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSubmitCheckpoint}
                disabled={checkpointReviewing}
                className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs text-emerald-100 disabled:opacity-60"
              >
                {checkpointReviewing ? "Reviewing..." : "Submit checkpoint"}
              </button>
              {skipEligible && (
                <button
                  type="button"
                  onClick={handleEmergencySkip}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200"
                >
                  Emergency skip
                </button>
              )}
              {skipEligible === false && (
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Skip used this month
                </span>
              )}
            </div>
            {checkpointFeedback && (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Victor feedback
                </p>
                <p className="mt-2 whitespace-pre-wrap">{checkpointFeedback}</p>
              </div>
            )}
            {checkpointHistory.length > 0 && (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Past checkpoint reviews
                </p>
                <div className="mt-2 space-y-2">
                  {checkpointHistory.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-2"
                    >
                      <p className="text-[11px] text-slate-300">
                        {review.pass ? "Passed" : "Not passed"} ·{" "}
                        {new Date(review.reviewed_at).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-200">
                        {review.feedback}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {placementActive && placementChallenges.length > 0 && (
        <div className="border-b border-white/10 bg-amber-500/10 px-5 py-3 text-xs text-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-amber-200/80">
                Placement challenge {placementIndex + 1} of{" "}
                {placementChallenges.length}
              </p>
              <p className="mt-1 text-sm text-amber-50">
                {placementChallenges[placementIndex]}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSubmitPlacement}
              className="rounded-full border border-amber-300/40 bg-amber-500/20 px-4 py-2 text-xs text-amber-100 hover:bg-amber-500/30"
            >
              Submit attempt
            </button>
          </div>
          <div className="mt-2">
            <input
              value={placementNote}
              onChange={(event) => setPlacementNote(event.target.value)}
              placeholder="Optional note for Victor (what you tried)"
              className="w-full rounded-md border border-amber-300/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-50 placeholder:text-amber-200/60"
            />
          </div>
        </div>
      )}

      {layoutMode === "tablet" && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab("editor")}
            className={`rounded-full border px-3 py-1 transition ${
              activeTab === "editor"
                ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("output")}
            className={`rounded-full border px-3 py-1 transition ${
              activeTab === "output"
                ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Output
          </button>
        </div>
      )}

      <div className="coding-review-layout">
        {(layoutMode !== "tablet" || activeTab === "editor") && (
          <div className="coding-review-editor border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-slate-400">
            <span>Editor</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Scratchpad</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const panel = document.getElementById(
                      "coding-review-template-menu"
                    );
                    if (panel) panel.toggleAttribute("data-open");
                  }}
                  data-template-toggle
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-slate-200 transition hover:bg-white/10"
                >
                  <Layers className="h-3 w-3" />
                  Templates
                </button>
                <div
                  id="coding-review-template-menu"
                  data-open={false}
                  className="absolute right-0 z-20 mt-2 hidden w-64 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-xs text-slate-200 shadow-xl data-[open=true]:block"
                >
                  <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Templates
                  </p>
                  <div className="px-2 pb-2">
                    <input
                      value={templateQuery}
                      onChange={(event) => setTemplateQuery(event.target.value)}
                      placeholder="Search templates..."
                      className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  {recentTemplates.length > 0 && (
                    <div className="px-2 pb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      Recent
                    </div>
                  )}
                  {recentTemplates
                    .map((key) => {
                      const item = templates.find((tpl) => tpl.key === key);
                      return item ? { key: item.key, label: item.label } : null;
                    })
                    .filter(Boolean)
                    .map((item) => (
                      <button
                        key={`recent-${item!.key}`}
                        type="button"
                        onClick={() => {
                          handleLoadTemplate(item!.key);
                          const panel = document.getElementById(
                            "coding-review-template-menu"
                          );
                          panel?.removeAttribute("data-open");
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs text-amber-100 hover:bg-white/5"
                      >
                        {item!.label}
                      </button>
                    ))}
                  {templates.map((item) =>
                    templateQuery &&
                    !item.label.toLowerCase().includes(templateQuery.toLowerCase())
                      ? null
                      : (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            handleLoadTemplate(item.key);
                            const panel = document.getElementById(
                              "coding-review-template-menu"
                            );
                            panel?.removeAttribute("data-open");
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs text-slate-200 hover:bg-white/5"
                        >
                          {item.label}
                        </button>
                      )
                  )}
                </div>
              </div>
            </div>
          </div>
            <div className="h-full min-h-[240px] flex-1 bg-slate-950/40">
              <CodeMirror
                value={code}
                height="100%"
                theme="dark"
                extensions={[
                  language === "python"
                    ? python()
                    : language === "sql"
                      ? sql()
                      : javascript({ jsx: true }),
                ]}
                onChange={(value) => setCode(value)}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                  bracketMatching: true,
                  foldGutter: false,
                }}
                className="h-full text-xs"
              />
            </div>
          </div>
        )}

        {(layoutMode !== "tablet" || activeTab === "output") && (
          <div className="coding-review-output">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-slate-400">
              Output
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => requestAssistance("steps")}
                  disabled={assistLoading}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-1 text-[10px] normal-case tracking-normal text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Lightbulb className="h-3 w-3" />
                  Show steps
                </button>
                <button
                  type="button"
                  onClick={() => requestAssistance("answer")}
                  disabled={assistLoading}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-[10px] normal-case tracking-normal text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Still stuck: show reference
                </button>
                {output && (
                  <span className="text-[10px] text-slate-500">
                    {output.executionTime} ms
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-950/30 px-4 py-3 text-xs text-slate-100">
              {assistLoading && (
                <p className="mb-3 rounded-md border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-sky-100">
                  Victor is generating a guided breakdown...
                </p>
              )}
              {assistError && (
                <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                  {assistError}
                </p>
              )}
              {assistResponse && !assistLoading && (
                <div className="mb-3 rounded-md border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-slate-100">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-sky-200">
                    Guided assistance
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{assistResponse}</p>
                </div>
              )}
              {error && (
                <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200">
                  {error}
                </p>
              )}

            {!error && !output && (
              <p className="text-slate-400">
                Run your code to see output or errors.
              </p>
            )}

            {output?.type === "sql" && (
              <div className="space-y-3">
                {output.error ? (
                  <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200">
                    {output.error}
                  </p>
                ) : output.columns.length === 0 ? (
                  <p className="text-slate-300">Query executed.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          {output.columns.map((col) => (
                            <th
                              key={col}
                              className="border-b border-white/10 px-2 py-1 text-left text-slate-300"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {output.rows.map((row, idx) => (
                          <tr key={idx}>
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="border-b border-white/5 px-2 py-1 text-slate-100"
                              >
                                {String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[10px] text-slate-400">
                      {output.rowCount} rows
                    </p>
                  </div>
                )}
              </div>
            )}

            {output?.type !== "sql" && output && (
              <div className="space-y-3">
                {output.error && (
                  <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200">
                    {output.error.message}
                  </p>
                )}
                {output.stdout && (
                  <pre className="whitespace-pre-wrap rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    {output.stdout}
                  </pre>
                )}
                {output.stderr && (
                  <pre className="whitespace-pre-wrap rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                    {output.stderr}
                  </pre>
                )}
                {!output.stdout && !output.stderr && !output.error && (
                  <p className="text-slate-300">No output.</p>
                )}
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      <div className="coding-review-sticky-bar">
        <button
          type="button"
          onClick={handleRun}
          disabled={!canRun || running}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Play className="h-3.5 w-3.5" />
          {running ? "Running" : "Run"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200 transition hover:bg-white/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {pathPickerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/95 p-5 text-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Learning Coach</p>
              <button
                type="button"
                onClick={() => setPathPickerOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
              Learning Coach means Victor runs a quick placement, sets your
              starting lesson, then teaches through a structured sequence.
              It is for learning deeply, not just ad-hoc debugging.
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Each option is a language track. This does not use the editor
              language dropdown above.
            </p>
            {pendingPathId && (
              <p className="mt-2 text-xs text-amber-200">
                Selected:{" "}
                {pathOptions.find((path) => path.id === pendingPathId)?.title}
                . Confirm to start placement.
              </p>
            )}
            <div className="mt-4 space-y-2">
              {pathsLoading && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
                  Loading tracks...
                </div>
              )}
              {!pathsLoading && pathsError && (
                <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  {pathsError}
                  <button
                    type="button"
                    onClick={() => loadPaths()}
                    className="mt-2 block rounded-full border border-rose-300/40 bg-rose-500/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-100"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!pathsLoading && !pathsError && pathOptions.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
                  No tracks loaded yet.
                </div>
              )}
              {pathOptions.map((path) => {
                const isPending = pendingPathId === path.id;
                return (
                  <div
                    key={path.id}
                    className={`rounded-xl border px-4 py-3 ${
                      isPending
                        ? "border-amber-400/40 bg-amber-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm text-slate-100">
                      <span>{path.title}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingPathId((prev) =>
                            prev === path.id ? null : path.id
                          )
                        }
                        className={`text-[10px] uppercase tracking-[0.2em] ${
                          isPending
                            ? "text-amber-200"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {isPending ? "Selected" : "Select"}
                      </button>
                    </div>
                    {isPending && (
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-300">
                        <span>Start {path.title} track?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingPathId(null);
                            handleStartPath(path.id);
                          }}
                          className="rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs text-amber-100 hover:bg-amber-500/30"
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
