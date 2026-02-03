"use client";

import { useState } from "react";

interface VoiceFeedbackPromptProps {
  contentType: string;
  studioType: "career" | "academic" | "creative";
  originalContent: string;
  confidenceLevel?: number;
  generationId?: string;
  onFeedbackSubmitted?: () => void;
  className?: string;
}

export function VoiceFeedbackPrompt({
  contentType,
  studioType,
  originalContent,
  confidenceLevel,
  generationId,
  onFeedbackSubmitted,
  className = "",
}: VoiceFeedbackPromptProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");

  const submitFeedback = async (
    action: "accepted" | "edited" | "rejected",
    editedContent?: string
  ) => {
    setIsSubmitting(true);

    try {
      await fetch("/api/voice-feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          studioType,
          originalContent,
          action,
          editedContent,
          confidenceLevel,
          feedbackNote: note || null,
          generationId,
        }),
      });

      setSubmitted(true);
      onFeedbackSubmitted?.();
    } catch (err) {
      console.error("Feedback submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className={`p-3 bg-emerald-900/20 border border-emerald-800/50 rounded-lg ${className}`}
      >
        <p className="text-sm text-emerald-400">
          Thanks for your feedback! This helps improve your voice profile.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg ${className}`}>
      <p className="text-sm text-zinc-300 mb-3">Does this sound like you?</p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => submitFeedback("accepted")}
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-800/50 rounded-lg hover:bg-emerald-900/50 disabled:opacity-50"
        >
          Yes, this is my voice
        </button>
        <button
          onClick={() => setShowNoteInput(true)}
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm font-medium text-amber-400 bg-amber-900/30 border border-amber-800/50 rounded-lg hover:bg-amber-900/50 disabled:opacity-50"
        >
          Mostly, with edits
        </button>
        <button
          onClick={() => submitFeedback("rejected")}
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm font-medium text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
        >
          Doesn't sound like me
        </button>
      </div>

      {showNoteInput && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What would you change? (optional)"
            className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => submitFeedback("edited", note)}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-sm font-medium text-violet-400 bg-violet-900/30 border border-violet-800/50 rounded-lg hover:bg-violet-900/50 disabled:opacity-50"
            >
              Submit Feedback
            </button>
            <button
              onClick={() => setShowNoteInput(false)}
              className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
