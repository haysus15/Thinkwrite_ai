// src/components/academic-studio/quiz/QuizResults.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionReview from "./QuestionReview";
import type { QuizResultItem } from "@/types/academic-studio";

interface QuizResultsProps {
  attemptId: string;
}

export default function QuizResults({ attemptId }: QuizResultsProps) {
  const router = useRouter();
  const [results, setResults] = useState<QuizResultItem[]>([]);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const response = await fetch(`/api/quiz/attempt/${attemptId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load results.");
        }
        setResults(data.attempt.results || []);
        setScore(data.attempt.score || 0);
        setCorrect(data.attempt.correct_count || 0);
        setTotal(data.attempt.total_questions || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load results.");
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p role="alert" className="text-red-300">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1220] text-white px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
          <h2 className="text-3xl font-semibold text-slate-100">
            Quiz complete
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-slate-300">
            <div>
              <p className="text-4xl font-semibold text-sky-200">{score}%</p>
              <p className="text-xs text-slate-500">Score</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-100">
                {correct}/{total}
              </p>
              <p className="text-xs text-slate-500">Correct</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  const response = await fetch("/api/victor/message", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      mode: "study",
                      message: `Quiz results: ${score}% (${correct}/${total}). Focus review on missed items.`,
                    }),
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    throw new Error(data.error || "Victor review failed.");
                  }
                  router.push(
                    `/academic-studio/dashboard?conversationId=${data.conversationId}`
                  );
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Victor review failed."
                  );
                }
              }}
              className="rounded-full border border-sky-400/50 bg-sky-500/15 px-4 py-2 text-sm text-sky-200"
            >
              Review with Victor
            </button>
            <button
              type="button"
              onClick={() => router.push("/academic-studio/dashboard")}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300"
            >
              Back to studio
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {results.map((result) => (
            <QuestionReview key={result.questionId} result={result} />
          ))}
        </div>
      </div>
    </div>
  );
}
