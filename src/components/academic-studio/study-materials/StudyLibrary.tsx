// src/components/academic-studio/study-materials/StudyLibrary.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, RefreshCw } from "lucide-react";
import type { QuizQuestionType } from "@/types/academic-studio";

interface MaterialItem {
  id: string;
  title: string;
  class_name: string | null;
  topic: string | null;
  source_type: string | null;
}

interface QuizItem {
  id: string;
  title: string;
  study_material_id: string | null;
  created_at: string;
}

interface AttemptItem {
  id: string;
  quiz_id: string;
  score: number | null;
  correct_count: number | null;
  total_questions: number | null;
  completed_at: string | null;
}

export default function StudyLibrary({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState(3);
  const [questionTypes, setQuestionTypes] = useState<QuizQuestionType[]>([
    "multiple_choice",
    "short_answer",
  ]);

  useEffect(() => {
    const loadLibrary = async () => {
      setLoading(true);
      setError(null);
      try {
        const [materialsRes, historyRes] = await Promise.all([
          fetch("/api/study/materials"),
          fetch("/api/quiz/history"),
        ]);
        const materialsData = await materialsRes.json();
        const historyData = await historyRes.json();

        if (!materialsRes.ok) {
          throw new Error(materialsData.error || "Failed to load materials.");
        }
        if (!historyRes.ok) {
          throw new Error(historyData.error || "Failed to load quiz history.");
        }

        setMaterials(materialsData.materials || []);
        setQuizzes(historyData.quizzes || []);
        setAttempts(historyData.attempts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load library.");
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, []);

  const latestAttemptByQuiz = useMemo(() => {
    const map = new Map<string, AttemptItem>();
    attempts.forEach((attempt) => {
      if (!map.has(attempt.quiz_id)) {
        map.set(attempt.quiz_id, attempt);
      }
    });
    return map;
  }, [attempts]);

  const toggleType = (type: QuizQuestionType) => {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div
      className={
        embedded
          ? "w-full space-y-8"
          : "min-h-screen bg-[#0B1220] text-white px-6 py-10"
      }
    >
      <div className={embedded ? "w-full space-y-8" : "mx-auto w-full max-w-5xl space-y-8"}>
        {!embedded && (
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Academic Studio
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-100">
                Study materials library
              </h1>
            </div>
            <button
              type="button"
              onClick={() => router.push("/academic-studio/dashboard")}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300"
            >
              Back to studio
            </button>
          </header>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-sky-300" />
            <p className="text-sm font-semibold text-slate-100">
              Quiz configuration
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-400">
              Questions
              <input
                type="number"
                min={5}
                max={50}
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="text-xs text-slate-400">
              Difficulty (1-5)
              <input
                type="number"
                min={1}
                max={5}
                value={difficulty}
                onChange={(event) => setDifficulty(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <div className="text-xs text-slate-400">
              Types
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { id: "multiple_choice", label: "MC" },
                  { id: "true_false", label: "T/F" },
                  { id: "short_answer", label: "Short" },
                  { id: "essay", label: "Essay" },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleType(type.id as QuizQuestionType)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      questionTypes.includes(type.id as QuizQuestionType)
                        ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                        : "border-white/10 bg-white/5 text-slate-300"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <p className="text-sm text-slate-500">Loading library...</p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}

        {!loading && !error && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-slate-100">
              Materials
            </h2>
            <div className="mt-4 space-y-3">
              {materials.length === 0 && (
                <p className="text-sm text-slate-500">
                  Upload study materials in Study Mode first.
                </p>
              )}
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
                >
                  <div>
                    <p className="font-semibold">{material.title}</p>
                    <p className="text-xs text-slate-500">
                      {material.class_name || "No class"} ·{" "}
                      {material.topic || "No topic"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const response = await fetch("/api/quiz/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            studyMaterialId: material.id,
                            questionCount,
                            difficulty,
                            questionTypes,
                          }),
                        });
                        const data = await response.json();
                        if (!response.ok) {
                          throw new Error(
                            data.error || "Quiz generation failed."
                          );
                        }
                        router.push(`/academic-studio/quiz/${data.quizId}`);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Quiz generation failed."
                        );
                      }
                    }}
                    className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-200"
                  >
                    Generate quiz
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && !error && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-slate-100">
              Quiz history
            </h2>
            <div className="mt-4 space-y-3">
              {quizzes.length === 0 && (
                <p className="text-sm text-slate-500">
                  No quizzes yet. Generate one from your materials.
                </p>
              )}
              {quizzes.map((quiz) => {
                const attempt = latestAttemptByQuiz.get(quiz.id);
                return (
                  <div
                    key={quiz.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
                  >
                    <div>
                      <p className="font-semibold">{quiz.title}</p>
                      <p className="text-xs text-slate-500">
                        {attempt
                          ? `Latest score: ${attempt.score ?? 0}%`
                          : "No attempts yet"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/academic-studio/quiz/${quiz.id}`)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retake
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
