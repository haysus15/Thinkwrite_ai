"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AcademicErrorState from "@/components/academic-studio/shared/AcademicErrorState";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import IngestTab from "./IngestTab";
import LibraryTab from "./LibraryTab";
import QuizHistoryTab from "./QuizHistoryTab";
import UploadMaterialForm from "./UploadMaterialForm";
import { parseMaterialMetadata, truncateLabel } from "./metadata";
import type { AttemptItem, MaterialItem, QuizItem } from "./types";

type StudyHubTab = "ingest" | "library" | "quiz-history";

type ToastItem = {
  key: string;
  message: string;
  actionLabel: string;
  onUndo: () => void;
};

type VictorRequest = {
  materialId: string;
  initialPrompt: string;
  quizContext?: {
    questionText: string;
    studentAnswer: string;
    correctAnswer: string;
    questionLabel: string;
  } | null;
};

type UploadResult = {
  materialId: string;
  materialTitle: string;
};

function normalizeTab(value: string | null): StudyHubTab {
  if (value === "ingest" || value === "quiz-history") return value;
  return "library";
}

const ONBOARDING_STORAGE_KEY = "study-hub-onboarding-dismissed";

export default function StudyHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<StudyHubTab>(normalizeTab(searchParams.get("tab")));

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingMaterialDeletes, setPendingMaterialDeletes] = useState<Set<string>>(new Set());
  const [pendingQuizDeletes, setPendingQuizDeletes] = useState<Set<string>>(new Set());
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [quickQuizLoading, setQuickQuizLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [victorRequest, setVictorRequest] = useState<VictorRequest | null>(null);
  const [lastUploaded, setLastUploaded] = useState<UploadResult | null>(null);

  const materialTimersRef = useRef<Map<string, number>>(new Map());
  const quizTimersRef = useRef<Map<string, number>>(new Map());

  const syncTab = (nextTab: StudyHubTab) => {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`/academic/study-hub?${params.toString()}`);
  };

  useEffect(() => {
    setTab(normalizeTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as Window & { __academicHasUnsavedState?: boolean }).__academicHasUnsavedState =
      uploadPanelOpen;

    const onSaveBeforeNav = (event: Event) => {
      const customEvent = event as CustomEvent<{ done?: () => void }>;
      if (uploadPanelOpen) {
        setUploadPanelOpen(false);
      }
      customEvent.detail?.done?.();
    };

    window.addEventListener("academic:save-before-nav", onSaveBeforeNav);
    return () => {
      window.removeEventListener("academic:save-before-nav", onSaveBeforeNav);
      (window as Window & { __academicHasUnsavedState?: boolean }).__academicHasUnsavedState =
        false;
    };
  }, [uploadPanelOpen]);

  const loadMaterials = useCallback(async () => {
    const response = await fetch("/api/study/materials");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load materials.");
    }
    setMaterials(data.materials || []);
  }, []);

  const loadQuizData = useCallback(async () => {
    const response = await fetch("/api/quiz/history");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load quiz history.");
    }
    setQuizzes(data.quizzes || []);
    setAttempts(data.attempts || []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadMaterials(), loadQuizData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load study hub.");
    } finally {
      setLoading(false);
    }
  }, [loadMaterials, loadQuizData]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const materialTimers = materialTimersRef.current;
    const quizTimers = quizTimersRef.current;
    return () => {
      materialTimers.forEach((timer) => window.clearTimeout(timer));
      quizTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (materials.length > 0) {
      setShowOnboarding(false);
      return;
    }
    const dismissed = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
    setShowOnboarding(!dismissed);
  }, [materials.length]);

  const pushUndoToast = (toast: ToastItem) => {
    setToasts((prev) => [...prev, toast]);
  };

  const removeToast = (key: string) => {
    setToasts((prev) => prev.filter((toast) => toast.key !== key));
  };

  const handleDeleteMaterial = (materialId: string) => {
    if (pendingMaterialDeletes.has(materialId)) return;

    const materialName = truncateLabel(
      materials.find((item) => item.id === materialId)?.title || "Material"
    );

    setPendingMaterialDeletes((prev) => new Set(prev).add(materialId));
    const toastKey = `material:${materialId}`;

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/study/materials/${materialId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Delete failed.");
        }
        await Promise.all([loadMaterials(), loadQuizData()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
      } finally {
        setPendingMaterialDeletes((prev) => {
          const next = new Set(prev);
          next.delete(materialId);
          return next;
        });
        materialTimersRef.current.delete(materialId);
        removeToast(toastKey);
      }
    }, 5000);

    materialTimersRef.current.set(materialId, timer);
    pushUndoToast({
      key: toastKey,
      message: `${materialName} deleted`,
      actionLabel: "Undo",
      onUndo: () => {
        const queued = materialTimersRef.current.get(materialId);
        if (queued) window.clearTimeout(queued);
        materialTimersRef.current.delete(materialId);
        setPendingMaterialDeletes((prev) => {
          const next = new Set(prev);
          next.delete(materialId);
          return next;
        });
        removeToast(toastKey);
      },
    });
  };

  const handleDeleteQuiz = (quizId: string) => {
    if (pendingQuizDeletes.has(quizId)) return;

    const quiz = quizzes.find((item) => item.id === quizId);
    const materialName = truncateLabel(
      materials.find((item) => item.id === quiz?.study_material_id)?.title || "material"
    );

    setPendingQuizDeletes((prev) => new Set(prev).add(quizId));
    const toastKey = `quiz:${quizId}`;

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/quiz/${quizId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Delete failed.");
        }
        await loadQuizData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
      } finally {
        setPendingQuizDeletes((prev) => {
          const next = new Set(prev);
          next.delete(quizId);
          return next;
        });
        quizTimersRef.current.delete(quizId);
        removeToast(toastKey);
      }
    }, 5000);

    quizTimersRef.current.set(quizId, timer);
    pushUndoToast({
      key: toastKey,
      message: `Quiz from ${materialName} deleted`,
      actionLabel: "Undo",
      onUndo: () => {
        const queued = quizTimersRef.current.get(quizId);
        if (queued) window.clearTimeout(queued);
        quizTimersRef.current.delete(quizId);
        setPendingQuizDeletes((prev) => {
          const next = new Set(prev);
          next.delete(quizId);
          return next;
        });
        removeToast(toastKey);
      },
    });
  };

  const generateQuiz = useCallback(
    async (materialId: string) => {
      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyMaterialId: materialId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Quiz generation failed.");
      }
      router.push(`/academic/quiz/${data.quizId}`);
    },
    [router]
  );

  const quickQuizMaterial = useMemo(() => {
    if (materials.length === 0) return null;
    if (materials.length === 1) return materials[0];

    const withAccess = materials
      .map((material) => ({
        material,
        accessedAt: parseMaterialMetadata(material.source_id).lastAccessedAt,
      }))
      .filter((item) => Boolean(item.accessedAt))
      .sort(
        (a, b) =>
          new Date(b.accessedAt || 0).getTime() - new Date(a.accessedAt || 0).getTime()
      );

    if (withAccess.length > 0) return withAccess[0].material;

    return [...materials].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )[0];
  }, [materials]);

  const handleQuickQuiz = async () => {
    if (!quickQuizMaterial) return;
    setQuickQuizLoading(true);
    setError(null);
    try {
      await generateQuiz(quickQuizMaterial.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed.");
    } finally {
      setQuickQuizLoading(false);
    }
  };

  const handleUploadComplete = async (result?: UploadResult) => {
    await loadAll();
    if (result) {
      setLastUploaded(result);
    }
    setUploadPanelOpen(false);
    syncTab("library");
  };

  const tabButtonClass = (value: StudyHubTab) =>
    `rounded-full border px-4 py-2 text-xs transition ${
      tab === value
        ? "border-sky-400/50 bg-sky-500/15 text-sky-200"
        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
    }`;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5">
      <div className="academic-nested-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Daily flow</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">
          Upload, review, quiz, and track progress.
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          One place for ingesting material, reviewing your library, and tracking quiz history.
        </p>
      </div>

      <div className="sticky top-4 z-30 rounded-2xl border border-white/10 bg-[#0B1220]/90 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={tabButtonClass("ingest")} onClick={() => syncTab("ingest")}>
              Ingest
            </button>
            <button type="button" className={tabButtonClass("library")} onClick={() => syncTab("library")}>
              Library ({materials.length})
            </button>
            <button
              type="button"
              className={tabButtonClass("quiz-history")}
              onClick={() => syncTab("quiz-history")}
            >
              Quiz history ({attempts.length})
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setUploadPanelOpen(true)}
              className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-200"
            >
              Upload material
            </button>
            <button
              type="button"
              onClick={() => void handleQuickQuiz()}
              disabled={!quickQuizMaterial || quickQuizLoading}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
            >
              {quickQuizLoading ? "Generating..." : "Quick Quiz"}
            </button>
          </div>
        </div>
      </div>

      {showOnboarding && materials.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">How Study Hub works</p>
              <p className="mt-2 text-sm text-slate-300">Upload → Review in Library → Generate quiz → Track your history</p>
              <p className="mt-2 text-sm text-slate-400">Start by uploading your first material.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
                setShowOnboarding(false);
              }}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300"
            >
              ×
            </button>
          </div>
          <button
            type="button"
            onClick={() => setUploadPanelOpen(true)}
            className="mt-4 rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm text-sky-200"
          >
            Upload material
          </button>
        </div>
      )}

      {lastUploaded && !loading && !error && (
        <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4">
          <p className="text-sm font-semibold text-slate-100">
            Your file is ready. Generate a quiz now?
          </p>
          <p className="mt-1 text-xs text-slate-300">{truncateLabel(lastUploaded.materialTitle)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void generateQuiz(lastUploaded.materialId);
                setLastUploaded(null);
              }}
              className="rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm text-sky-200"
            >
              Generate Quiz
            </button>
            <button
              type="button"
              onClick={() => setLastUploaded(null)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-200"
            >
              View in Library
            </button>
          </div>
        </div>
      )}

      {loading && (
        <AcademicLoadingState
          message="Loading study hub..."
          className="academic-nested-card !min-h-0 rounded-2xl border-0 py-6"
        />
      )}
      {error && (
        <AcademicErrorState
          message={error}
          retry={() => {
            void loadAll();
          }}
          className="academic-nested-card !min-h-0 rounded-2xl py-6"
        />
      )}

      {!loading && !error && tab === "ingest" && (
        <IngestTab
          materials={materials}
          quizzes={quizzes}
          attempts={attempts}
          onUploadComplete={async (result) => {
            await handleUploadComplete(result);
          }}
          onOpenLibrary={() => syncTab("library")}
        />
      )}
      {!loading && !error && tab === "library" && (
        <LibraryTab
          materials={materials}
          quizzes={quizzes}
          attempts={attempts}
          pendingMaterialDeletes={pendingMaterialDeletes}
          onDeleteMaterial={handleDeleteMaterial}
          onGenerateQuiz={generateQuiz}
          onUploadMaterial={() => setUploadPanelOpen(true)}
          victorRequest={victorRequest}
          onVictorRequestHandled={() => setVictorRequest(null)}
        />
      )}
      {!loading && !error && tab === "quiz-history" && (
        <QuizHistoryTab
          quizzes={quizzes}
          attempts={attempts}
          pendingQuizDeletes={pendingQuizDeletes}
          onDeleteQuiz={handleDeleteQuiz}
          onAskVictor={(payload) => {
            setVictorRequest({
              materialId: payload.materialId,
              initialPrompt: payload.initialPrompt,
              quizContext: payload.quizContext,
            });
            syncTab("library");
          }}
        />
      )}

      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.key}
              className="min-w-[260px] rounded-xl border border-white/15 bg-[#0B1220] px-4 py-3 text-sm text-slate-100 shadow-lg"
            >
              <p>{toast.message}</p>
              <button
                type="button"
                onClick={toast.onUndo}
                className="mt-2 rounded border border-sky-400/40 bg-sky-500/15 px-2 py-1 text-xs text-sky-200"
              >
                {toast.actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadPanelOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-2xl">
            <UploadMaterialForm
              mode="panel"
              classOptions={Array.from(
                new Set(materials.map((item) => item.class_name || "").filter(Boolean))
              )}
              onCancel={() => setUploadPanelOpen(false)}
              onUploaded={async (result) => {
                await handleUploadComplete(result);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
