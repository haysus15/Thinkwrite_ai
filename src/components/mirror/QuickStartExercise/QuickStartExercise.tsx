"use client";

import { useMemo, useState } from "react";
import styles from "./QuickStartExercise.module.css";
import type { Chamber } from "@/lib/mirror-mode/writingTypes";
import { translateSystemError } from "@/lib/mirror/voiceProfileStatus";

const quickStartPrompts: Record<Chamber, string[]> = {
  career: [
    "Describe what you do at work in your own words, not your title.",
    "Write about a moment at work where you solved a problem.",
    "Explain why you are good at what you do. Be specific.",
  ],
  academic: [
    "Describe a concept from a recent class as if explaining it to a friend.",
    "Write about a time you disagreed with something you read or were taught.",
    "Summarize what you are studying right now and why it matters to you.",
  ],
  creative: [
    "Describe a place you know well in the way it feels, not how it looks.",
    "Write the opening of a story that starts in the middle of action.",
    "Describe a memory using only sensory details.",
  ],
  general: [
    "Write about what you did yesterday as if telling a close friend.",
    "Explain something you believe strongly but rarely discuss.",
    "Describe a person you know well without name or physical description.",
  ],
};

type QuickStartResult = {
  observations: string[];
  chamberStatus?: {
    displayLabel: string;
  };
};

type Props = {
  chamber: Chamber;
  show: boolean;
  onCompleted: (result: QuickStartResult) => void;
};

export default function QuickStartExercise({ chamber, show, onCompleted }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickStartResult | null>(null);

  const prompt = useMemo(() => {
    const options = quickStartPrompts[chamber];
    const index = Math.floor(Math.random() * options.length);
    return options[index];
  }, [chamber]);

  if (!show) return null;

  const canSubmit = text.trim().length >= 100 && !submitting;

  const runQuickstart = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/mirror/quickstart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          chamber,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Quick-start analysis failed.");
      }
      const payload: QuickStartResult = {
        observations: data.observations || [],
        chamberStatus: data.chamberStatus || undefined,
      };
      setResult(payload);
      setText("");
      onCompleted(payload);
    } catch (err: any) {
      setError(translateSystemError(err?.message || "UNKNOWN"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.card}>
      <h3 className={styles.heading}>Quick start exercise</h3>
      <p className={styles.prompt}>{prompt}</p>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Write 5-7 sentences."
      />
      <div className={styles.footer}>
        <span className={styles.counter}>{text.trim().length} / 100 min</span>
        <button type="button" className={styles.button} onClick={runQuickstart} disabled={!canSubmit}>
          {submitting ? "Analyzing..." : "Analyze sample"}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {result?.observations?.[0] && (
        <p className={styles.result}>
          Mirror Mode noticed: {result.observations[0]} That pattern is now in your profile.
        </p>
      )}
    </section>
  );
}
