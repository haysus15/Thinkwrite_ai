"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicErrorState from "@/components/academic-studio/shared/AcademicErrorState";
import type { AttemptItem, QuizItem } from "./types";

type IncorrectQuestion = {
  questionLabel: string;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
};

type Props = {
  quizzes: QuizItem[];
  attempts: AttemptItem[];
  pendingQuizDeletes: Set<string>;
  onDeleteQuiz: (quizId: string) => void;
  onAskVictor: (payload: {
    materialId: string;
    initialPrompt: string;
    quizContext: {
      questionText: string;
      studentAnswer: string;
      correctAnswer: string;
      questionLabel: string;
    };
  }) => void;
};

export default function QuizHistoryTab({
  quizzes,
  attempts,
  pendingQuizDeletes,
  onDeleteQuiz,
  onAskVictor,
}: Props) {
  const router = useRouter();
  const [lowScoresOnly, setLowScoresOnly] = useState(false);
  const [loadingQuizId, setLoadingQuizId] = useState<string | null>(null);
  const [incorrectByQuiz, setIncorrectByQuiz] = useState<Record<string, IncorrectQuestion[]>>({});
  const [error, setError] = useState<string | null>(null);

  const latestAttemptByQuiz = useMemo(() => {
    const map = new Map<string, AttemptItem>();
    attempts.forEach((attempt) => {
      if (!map.has(attempt.quiz_id)) {
        map.set(attempt.quiz_id, attempt);
      }
    });
    return map;
  }, [attempts]);

  const lowScoreCount = useMemo(
    () =>
      attempts.filter((attempt) => typeof attempt.score === "number" && attempt.score < 70)
        .length,
    [attempts]
  );

  const visibleQuizzes = useMemo(() => {
    if (!lowScoresOnly) return quizzes;
    return quizzes.filter((quiz) => {
      const attempt = latestAttemptByQuiz.get(quiz.id);
      return typeof attempt?.score === "number" && attempt.score < 70;
    });
  }, [latestAttemptByQuiz, lowScoresOnly, quizzes]);

  const loadIncorrectQuestions = async (quizId: string) => {
    const latestAttempt = latestAttemptByQuiz.get(quizId);
    if (!latestAttempt) return;

    if (incorrectByQuiz[quizId]) {
      setIncorrectByQuiz((prev) => ({ ...prev, [quizId]: [] }));
      return;
    }

    setLoadingQuizId(quizId);
    setError(null);
    try {
      const [attemptRes, quizRes] = await Promise.all([
        fetch(`/api/quiz/attempt/${latestAttempt.id}`),
        fetch(`/api/quiz/${quizId}`),
      ]);
      const attemptData = await attemptRes.json();
      const quizData = await quizRes.json();
      if (!attemptRes.ok || !quizRes.ok) {
        throw new Error(attemptData.error || quizData.error || "Could not load incorrect questions.");
      }

      const results = Array.isArray(attemptData?.attempt?.results)
        ? attemptData.attempt.results
        : [];
      const answers =
        attemptData?.attempt?.answers && typeof attemptData.attempt.answers === "object"
          ? (attemptData.attempt.answers as Record<string, unknown>)
          : {};
      const questions = Array.isArray(quizData?.quiz?.questions)
        ? quizData.quiz.questions
        : [];

      const questionById = new Map<string, { text?: string }>();
      questions.forEach((item: { id?: string; text?: string }) => {
        if (item?.id) questionById.set(item.id, item);
      });

      const incorrect = results
        .filter((result: { correct?: boolean | null }) => result?.correct === false)
        .map(
          (result: {
            questionId?: string;
            correctAnswer?: string;
            studentAnswer?: string;
          }) => ({
            questionLabel: result.questionId || "question",
            questionText: questionById.get(result.questionId || "")?.text || "Question",
            studentAnswer: String(
              answers[result.questionId || ""] || "(no answer recorded)"
            ),
            correctAnswer: String(result.correctAnswer || ""),
          })
        );

      setIncorrectByQuiz((prev) => ({ ...prev, [quizId]: incorrect }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load incorrect questions.");
    } finally {
      setLoadingQuizId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-slate-100">Quiz history</h2>

      {lowScoreCount > 0 && (
        <AcademicEmptyState
          title={`You scored below 70% on ${lowScoreCount} recent quiz(zes)`}
          description="Retaking them helps retention."
          action={{
            label: lowScoresOnly ? "Show all" : "See low scores",
            onClick: () => setLowScoresOnly((prev) => !prev),
          }}
          className="mt-4 !min-h-0 py-4"
        />
      )}

      {error && <AcademicErrorState message={error} className="mt-4 !min-h-0 py-3" />}

      <div className="mt-4 space-y-3">
        {visibleQuizzes.length === 0 && (
          <AcademicEmptyState
            title="No quizzes yet"
            description="Generate one from your materials."
            className="!min-h-0 py-4"
          />
        )}
        {visibleQuizzes.map((quiz) => {
          const attempt = latestAttemptByQuiz.get(quiz.id);
          const hasIncorrect =
            typeof attempt?.correct_count === "number" &&
            typeof attempt?.total_questions === "number" &&
            attempt.correct_count < attempt.total_questions;
          const incorrectQuestions = incorrectByQuiz[quiz.id] || [];
          return (
            <div
              key={quiz.id}
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{quiz.title}</p>
                  <p className="text-xs text-slate-500">
                    {attempt
                      ? `Latest score: ${attempt.score ?? 0}% (${attempt.correct_count ?? 0}/${attempt.total_questions ?? 0})`
                      : "No attempts yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasIncorrect && (
                    <button
                      type="button"
                      onClick={() => void loadIncorrectQuestions(quiz.id)}
                      className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
                    >
                      {loadingQuizId === quiz.id
                        ? "Loading..."
                        : incorrectQuestions.length > 0
                          ? "Hide incorrect"
                          : "Show incorrect"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/academic/quiz/${quiz.id}`)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteQuiz(quiz.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-200"
                  >
                    <Trash2 className="h-3 w-3" />
                    {pendingQuizDeletes.has(quiz.id) ? "Delete pending..." : "Delete"}
                  </button>
                </div>
              </div>

              {incorrectQuestions.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  {incorrectQuestions.map((item) => (
                    <div key={`${quiz.id}-${item.questionLabel}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs font-semibold text-red-200">✗ Incorrect · {item.questionLabel}</p>
                      <p className="mt-1 text-sm text-slate-200">{item.questionText}</p>
                      <p className="mt-1 text-xs text-slate-400">Your answer: {item.studentAnswer}</p>
                      <p className="mt-1 text-xs text-slate-500">Correct answer: {item.correctAnswer}</p>
                      {quiz.study_material_id && (
                        <button
                          type="button"
                          onClick={() =>
                            onAskVictor({
                              materialId: quiz.study_material_id as string,
                              initialPrompt: `Let's look at why ${item.questionLabel} tripped you up. ${item.questionText} You answered ${item.studentAnswer}. Tell me why you chose that.`,
                              quizContext: {
                                questionLabel: item.questionLabel,
                                questionText: item.questionText,
                                studentAnswer: item.studentAnswer,
                                correctAnswer: item.correctAnswer,
                              },
                            })
                          }
                          className="mt-2 rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-200"
                        >
                          Ask Victor
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
