"use client";

import { useCallback } from "react";
import { JsExecutor, PythonExecutor, SqlExecutor } from "@/lib/academic/codingReviewExecutors";
import { logCodingReviewExecution, updateCodingReviewPathProgress } from "@/lib/academic/codingReviewApi";
import { getTemplateByKey } from "@/lib/academic/templates/codingReviewTemplates";
import type { OutputState, CodingLanguage } from "./useCodingReview";

type ExecutionActionsArgs = {
  canRun: boolean;
  running: boolean;
  language: CodingLanguage;
  code: string;
  codingReviewSessionId: string | null;
  struggleTopics: string[];
  activePathId: string | null;
  activeProgress: { current_lesson: number; lessons_completed: number[] } | null;
  setHasRunCode: (value: boolean) => void;
  setPlacementError: (value: string | null) => void;
  setRunning: (value: boolean) => void;
  setError: (value: string | null) => void;
  setOutput: (value: OutputState) => void;
  setStruggleTopics: (topics: string[]) => void;
  setCode: (value: string) => void;
  setLanguage: (value: CodingLanguage) => void;
  setToast: (value: string | null) => void;
  setTemplateQuery: (value: string) => void;
  setRecentTemplates: (updater: (prev: string[]) => string[]) => void;
};

export function useCodingExecutionActions({
  canRun,
  running,
  language,
  code,
  codingReviewSessionId,
  struggleTopics,
  activePathId,
  activeProgress,
  setHasRunCode,
  setPlacementError,
  setRunning,
  setError,
  setOutput,
  setStruggleTopics,
  setCode,
  setLanguage,
  setToast,
  setTemplateQuery,
  setRecentTemplates,
}: ExecutionActionsArgs) {
  const handleRun = useCallback(async () => {
    if (!canRun || running) return;
    setRunning(true);
    setError(null);
    setPlacementError(null);

    try {
      if (language === "python") {
        const result = await PythonExecutor.execute(code);
        setHasRunCode(true);
        setOutput({ type: "python", stdout: result.stdout, stderr: result.stderr, error: result.error, executionTime: result.executionTime });
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
          const nextTopics = Array.from(new Set([...struggleTopics, result.error.type.toLowerCase()]));
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
        setHasRunCode(true);
        setOutput({ type: "sql", columns: result.columns, rows: result.rows, rowCount: result.rowCount, error: result.error, executionTime: result.executionTime });
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
          const nextTopics = Array.from(new Set([...struggleTopics, "sql_error"]));
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
        setHasRunCode(true);
        const stdout = result.consoleOutput.join("\n");
        setOutput({ type: "javascript", stdout, stderr: "", error: result.error, executionTime: result.executionTime });
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
          const nextTopics = Array.from(new Set([...struggleTopics, result.error.type.toLowerCase()]));
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
    setRunning,
    setError,
    setOutput,
    setStruggleTopics,
    setHasRunCode,
    setPlacementError,
  ]);

  const handleClear = useCallback(() => {
    setCode("");
    setOutput(null);
    setError(null);
  }, [setCode, setError, setOutput]);

  const handleLoadTemplate = useCallback(async (key: string) => {
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
        window.localStorage.setItem("coding-review-recent-templates", JSON.stringify(next));
      }
      return next;
    });
  }, [setCode, setError, setLanguage, setOutput, setRecentTemplates, setTemplateQuery, setToast]);

  return { handleRun, handleClear, handleLoadTemplate };
}
