"use client";

import { FormEvent, useMemo, useState } from "react";
import AcademicErrorState from "@/components/academic-studio/shared/AcademicErrorState";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import { useStudyVictorSession } from "@/hooks/useStudyVictorSession";

type QuizContext = {
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  questionLabel: string;
};

type Props = {
  materialId: string;
  materialName: string;
  initialPrompt?: string | null;
  initialQuizContext?: QuizContext | null;
  onBackToDocument?: () => void;
  onClose?: () => void;
  compactHeader?: boolean;
};

function truncateThirty(value: string): string {
  if (value.length <= 30) return value;
  return `${value.slice(0, 29)}…`;
}

export default function StudyVictorDock({
  materialId,
  materialName,
  initialPrompt,
  initialQuizContext,
  onBackToDocument,
  onClose,
  compactHeader,
}: Props) {
  const [input, setInput] = useState("");
  const { messages, isLoading, error, sendMessage } = useStudyVictorSession({
    materialId,
    initialPrompt,
    initialQuizContext,
  });

  const canSend = input.trim().length > 0 && !isLoading;

  const headerName = useMemo(() => truncateThirty(materialName), [materialName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    const next = input.trim();
    setInput("");
    await sendMessage(next);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Victor · Study Coach</p>
          <p className="mt-1 text-xs text-slate-400">Studying: {headerName}</p>
        </div>
        <div className="flex items-center gap-2">
          {onBackToDocument && (
            <button
              type="button"
              onClick={onBackToDocument}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200"
            >
              ← Back to document
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className={`mt-4 ${compactHeader ? "max-h-[55vh]" : "max-h-[62vh]"} space-y-2 overflow-auto rounded-xl border border-white/10 bg-slate-950/40 p-3`}>
        {messages.length === 0 && !isLoading && (
          <p className="text-sm text-slate-400">
            Ask about this document and Victor will help you understand it.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-xl px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-8 border border-sky-400/30 bg-sky-500/10 text-sky-100"
                : "mr-8 border border-white/10 bg-white/5 text-slate-100"
            }`}
          >
            {message.content}
          </div>
        ))}

        {isLoading && (
          <AcademicLoadingState
            message="Victor is thinking..."
            className="!min-h-0 border-0 bg-transparent py-1"
          />
        )}
      </div>

      {error && <AcademicErrorState message={error} className="mt-3 !min-h-0 py-3" />}

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask Victor about this material"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-xl border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-200 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
