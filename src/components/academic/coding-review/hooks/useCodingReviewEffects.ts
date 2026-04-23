"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { SqlExecutor } from "@/lib/academic/codingReviewExecutors";
import {
  createCodingReviewSession,
  getCodingReviewPath,
  listCodingReviewTemplates,
  updateCodingReviewSession,
} from "@/lib/academic/codingReviewApi";
import { getTemplateByKey } from "@/lib/academic/templates/codingReviewTemplates";
import { LANGUAGE_LABELS, type OutputState } from "./useCodingReview";

type Lesson = {
  lesson_index: number;
  title: string;
  concept_summary: string;
  challenge_prompt: string;
  required_skills: string[];
};

type UseCodingReviewEffectsArgs = {
  language: "python" | "sql" | "javascript";
  assignmentId: string | null;
  initialSessionId?: string | null;
  codingReviewSessionId: string | null;
  code: string;
  output: OutputState;
  toast: string | null;
  activePathId: string | null;
  saveTimerRef: MutableRefObject<number | null>;
  setCodingReviewSessionId: (id: string) => void;
  setTemplates: (templates: Array<{ key: string; label: string }>) => void;
  setPathsLoading: (value: boolean) => void;
  setPathsError: (value: string | null) => void;
  setPathOptions: (options: Array<{ id: string; title: string }>) => void;
  setActiveLessons: (lessons: Lesson[]) => void;
  setActiveProgress: (progress: { current_lesson: number; lessons_completed: number[] } | null) => void;
  setLayoutMode: (mode: "desktop" | "tablet" | "mobile") => void;
  setRecentTemplates: (templates: string[]) => void;
  setToast: (value: string | null) => void;
};

function normalizeCodingLanguage(value: unknown): "python" | "sql" | "javascript" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (normalized === "python" || normalized === "py") return "python";
  if (normalized === "sql") return "sql";
  if (normalized === "javascript" || normalized === "js") return "javascript";
  return null;
}

function extractAssignmentLanguage(assignment: unknown): "python" | "sql" | "javascript" | null {
  if (!assignment || typeof assignment !== "object") return null;
  const record = assignment as Record<string, unknown>;
  const direct =
    normalizeCodingLanguage(record.language) ||
    normalizeCodingLanguage(record.coding_language) ||
    normalizeCodingLanguage(record.programming_language);
  if (direct) return direct;

  const requirements = record.requirements;
  if (requirements && typeof requirements === "object") {
    const req = requirements as Record<string, unknown>;
    return (
      normalizeCodingLanguage(req.language) ||
      normalizeCodingLanguage(req.coding_language) ||
      normalizeCodingLanguage(req.programming_language)
    );
  }
  return null;
}

export function useCodingReviewEffects({
  language,
  assignmentId,
  initialSessionId,
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
}: UseCodingReviewEffectsArgs) {
  const sandboxBootstrappedRef = useRef(false);
  useEffect(() => {
    if (language === "sql") {
      SqlExecutor.loadDatabase("").catch(() => null);
    }
  }, [language]);

  useEffect(() => {
    if (initialSessionId) return;
    if (!assignmentId) return;
    if (codingReviewSessionId) return;
    let active = true;
    const createSession = async () => {
      let resolvedLanguage: "python" | "sql" | "javascript" | null = null;
      try {
        const response = await fetch(`/api/travis/assignment/${assignmentId}`);
        if (response.ok) {
          const data = await response.json();
          resolvedLanguage = extractAssignmentLanguage(data?.assignment);
        }
      } catch {
        // Ignore assignment fetch failures; fallback rules apply below.
      }

      const editorLanguage = normalizeCodingLanguage(language);
      const sessionLanguage = resolvedLanguage || editorLanguage || "python";

      const session = await createCodingReviewSession({
        language: sessionLanguage,
        entry_type: "assignment",
        assignment_id: assignmentId,
        code_snapshot: code,
      });
      if (!active) return;
      setCodingReviewSessionId(session.id);
    };

    createSession().catch(() => null);

    return () => {
      active = false;
    };
  }, [assignmentId, codingReviewSessionId, code, initialSessionId, language, setCodingReviewSessionId]);

  useEffect(() => {
    if (initialSessionId) return;
    if (assignmentId) return;
    if (codingReviewSessionId) return;
    if (sandboxBootstrappedRef.current) return;
    sandboxBootstrappedRef.current = true;
    createCodingReviewSession({
      language,
      entry_type: "sandbox",
      code_snapshot: code,
    })
      .then((session) => {
        setCodingReviewSessionId(session.id);
      })
      .catch(() => {
        sandboxBootstrappedRef.current = false;
      });
  }, [
    assignmentId,
    code,
    codingReviewSessionId,
    initialSessionId,
    language,
    setCodingReviewSessionId,
  ]);

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
  }, [setTemplates]);

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
  }, [setPathOptions, setPathsError, setPathsLoading]);

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
  }, [activePathId, setActiveLessons, setActiveProgress]);

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
  }, [setLayoutMode]);

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
  }, [setRecentTemplates]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast, setToast]);

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
  }, [code, codingReviewSessionId, saveTimerRef]);

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

  return { loadPaths };
}
