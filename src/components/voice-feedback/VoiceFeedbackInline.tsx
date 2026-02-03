"use client";

import { useState } from "react";

interface VoiceFeedbackInlineProps {
  contentType: string;
  studioType: "career" | "academic" | "creative";
  originalContent: string;
  confidenceLevel?: number;
  onFeedbackSubmitted?: () => void;
}

export function VoiceFeedbackInline({
  contentType,
  studioType,
  originalContent,
  confidenceLevel,
  onFeedbackSubmitted,
}: VoiceFeedbackInlineProps) {
  const [submitted, setSubmitted] = useState(false);

  const submitFeedback = async (action: "accepted" | "rejected") => {
    try {
      await fetch("/api/voice-feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          studioType,
          originalContent,
          action,
          confidenceLevel,
        }),
      });
      setSubmitted(true);
      onFeedbackSubmitted?.();
    } catch (err) {
      console.error("Feedback failed:", err);
    }
  };

  if (submitted) {
    return <span className="text-xs text-emerald-400">✓ Thanks!</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
      Sound like you?
      <button
        onClick={() => submitFeedback("accepted")}
        className="text-emerald-400 hover:text-emerald-300"
        title="Yes"
      >
        👍
      </button>
      <button
        onClick={() => submitFeedback("rejected")}
        className="text-zinc-400 hover:text-zinc-300"
        title="No"
      >
        👎
      </button>
    </span>
  );
}
