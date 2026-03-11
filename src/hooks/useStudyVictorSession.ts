"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type MisconceptionLevel = "none" | "partial" | "fundamental";

export type StudyMessage = {
  id: string;
  role: "user" | "victor";
  content: string;
  timestamp: Date;
  materialId: string;
  misconceptionLevel: MisconceptionLevel | null;
};

type QuizContext = {
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  questionLabel: string;
};

type UseStudyVictorSessionOptions = {
  materialId: string | null;
  initialPrompt?: string | null;
  initialQuizContext?: QuizContext | null;
};

export function useStudyVictorSession(options: UseStudyVictorSessionOptions) {
  const { materialId, initialPrompt, initialQuizContext } = options;
  const [messages, setMessages] = useState<StudyMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [materialId]);

  const sendMessage = useCallback(
    async (content: string, quizContext?: QuizContext | null) => {
      if (!materialId || !content.trim()) return;

      const userMessage: StudyMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
        materialId,
        misconceptionLevel: null,
      };

      const priorHistory = messages.slice(-10);
      const nextMessages = [...priorHistory, userMessage].slice(-10);
      setMessages(nextMessages);
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch("/api/academic/victor/study", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materialId,
            message: userMessage.content,
            history: priorHistory.map((item) => ({
              role: item.role,
              content: item.content,
              misconceptionLevel: item.misconceptionLevel,
            })),
            quizContext: quizContext || null,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Victor could not respond.");
        }

        const victorMessage: StudyMessage = {
          id: crypto.randomUUID(),
          role: "victor",
          content: data.reply || "Let's keep working through this together.",
          timestamp: new Date(),
          materialId,
          misconceptionLevel:
            data?.misconceptionLevel === "partial" || data?.misconceptionLevel === "fundamental"
              ? data.misconceptionLevel
              : "none",
        };

        setMessages((prev) => [...prev, victorMessage].slice(-10));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Victor could not respond.");
      } finally {
        setIsLoading(false);
      }
    },
    [materialId, messages]
  );

  const initialKey = useMemo(
    () => `${materialId || "none"}:${initialPrompt || ""}:${initialQuizContext?.questionText || ""}`,
    [materialId, initialPrompt, initialQuizContext?.questionText]
  );

  useEffect(() => {
    if (!materialId) return;
    if (!initialPrompt && !initialQuizContext) return;
    if (messages.length > 0) return;

    const prompt =
      initialPrompt ||
      (initialQuizContext
        ? `Let's look at why ${initialQuizContext.questionLabel} tripped you up. ${initialQuizContext.questionText} You answered ${initialQuizContext.studentAnswer}. Tell me why you chose that.`
        : "");

    if (!prompt) return;
    void sendMessage(prompt, initialQuizContext || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    reset: () => {
      setMessages([]);
      setError(null);
    },
  };
}
