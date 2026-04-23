// src/components/academic/quiz/QuizInterface.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import QuizProgress from "./QuizProgress";
import QuizNavigator from "./QuizNavigator";
import QuizQuestion from "./QuizQuestion";
import QuizResults from "./QuizResults";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import type { QuizQuestion as QuizQuestionType } from "@/types/academic";

interface QuizInterfaceProps {
  quizId: string;
}

export default function QuizInterface({ quizId }: QuizInterfaceProps) {
  const t = useTranslations("academic.quizUi.interface");
  const [questions, setQuestions] = useState<QuizQuestionType[]>([]);
  const [title, setTitle] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQuiz = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/quiz/${quizId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || t("errors.notFound"));
        }
        setQuestions(data.quiz.questions || []);
        setTitle(data.quiz.title || t("titleFallback"));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.load"));
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [quizId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <AcademicLoadingState message={t("loading")} className="!min-h-0 border-0 bg-transparent py-0" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <AcademicErrorState message={error} className="!min-h-0 border-red-500/40 bg-red-500/10 py-4" />
      </div>
    );
  }

  if (attemptId) {
    return <QuizResults attemptId={attemptId} />;
  }

  const current = questions[currentIndex];

  return (
    <div className="min-h-screen bg-[#0B1220] text-white px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {t("eyebrow")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">
            {title}
          </p>
        </div>

        <QuizProgress
          current={currentIndex + 1}
          total={questions.length}
          answered={Object.keys(answers).length}
        />

        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/40 p-6">
          <QuizQuestion
            question={current}
            answer={answers[current.id]}
            onAnswer={(value) => {
              setAnswers((prev) => ({ ...prev, [current.id]: value }));
            }}
          />
        </div>

        <QuizNavigator
          currentIndex={currentIndex}
          total={questions.length}
          onPrevious={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
          onNext={() =>
            setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1))
          }
          onSubmit={async () => {
            setSubmitting(true);
            setError(null);
            try {
              const response = await fetch(`/api/quiz/submit/${quizId}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ answers }),
              });
              const data = await response.json();
              if (!response.ok) {
                throw new Error(data.error || t("errors.submit"));
              }
              setAttemptId(data.attemptId);
            } catch (err) {
              setError(err instanceof Error ? err.message : t("errors.submit"));
            } finally {
              setSubmitting(false);
            }
          }}
          submitting={submitting}
          canSubmit={Object.keys(answers).length === questions.length}
        />

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
