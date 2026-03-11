"use client";

import { RefreshCw } from "lucide-react";
import type {
  AttemptItem,
  MaterialItem,
  QuizItem,
} from "../hooks/useStudyLibrary";

type LibraryGridProps = {
  materials: MaterialItem[];
  quizzes: QuizItem[];
  latestAttemptByQuiz: Map<string, AttemptItem>;
  onViewMaterial: (materialId: string) => void;
  onGenerateQuiz: (materialId: string) => void;
  onDeleteMaterial: (materialId: string) => void;
  onRetakeQuiz: (quizId: string) => void;
};

export default function LibraryGrid({
  materials,
  quizzes,
  latestAttemptByQuiz,
  onViewMaterial,
  onGenerateQuiz,
  onDeleteMaterial,
  onRetakeQuiz,
}: LibraryGridProps) {
  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-slate-100">Materials</h2>
        <div className="mt-4 space-y-3">
          {materials.length === 0 && (
            <p className="text-sm text-slate-500">
              Upload materials from Study Hub first.
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
                  {material.class_name || "No class"} · {material.topic || "No topic"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onViewMaterial(material.id)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200"
                >
                  View material
                </button>
                <button
                  type="button"
                  onClick={() => onGenerateQuiz(material.id)}
                  className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-200"
                >
                  Generate quiz
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMaterial(material.id)}
                  className="rounded-full border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-slate-100">Quiz history</h2>
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
                  onClick={() => onRetakeQuiz(quiz.id)}
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
    </>
  );
}
