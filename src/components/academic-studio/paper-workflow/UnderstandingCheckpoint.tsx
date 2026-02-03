// src/components/academic-studio/paper-workflow/UnderstandingCheckpoint.tsx
"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmergencySkipModal from "./EmergencySkipModal";

interface UnderstandingCheckpointProps {
  paperId: string | null;
  onBack: () => void;
}

export default function UnderstandingCheckpoint({
  paperId,
  onBack,
}: UnderstandingCheckpointProps) {
  const prompts = useMemo(
    () => [
      "Explain the thesis in your own words.",
      "What evidence supports section two?",
      "How would you defend your conclusion under pressure?",
    ],
    []
  );
  const [responses, setResponses] = useState<string[]>(
    prompts.map(() => "")
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipEligible, setSkipEligible] = useState(false);
  const [skipUsedCount, setSkipUsedCount] = useState(0);
  const [showSkipModal, setShowSkipModal] = useState(false);

  useEffect(() => {
    const loadSkipStatus = async () => {
      try {
        const response = await fetch("/api/academic/paper/can-skip");
        const data = await response.json();
        if (!response.ok) {
          return;
        }
        setSkipEligible(Boolean(data.eligible));
        setSkipUsedCount(Number(data.usedCount || 0));
      } catch {
        // Silent fail
      }
    };

    loadSkipStatus();
  }, []);

  const handleSubmit = async () => {
    if (!paperId) {
      setError("Paper draft not found. Generate the paper first.");
      return;
    }
    if (responses.some((response) => !response.trim())) {
      setError("Answer every checkpoint question.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const conversation = prompts.flatMap((prompt, index) => [
        { role: "assistant", content: prompt },
        { role: "user", content: responses[index] },
      ]);

      const response = await fetch(
        `/api/academic/paper/checkpoint/${paperId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Checkpoint failed.");
      }
      setResult(
        data.passed
          ? "Checkpoint passed. Export is unlocked."
          : "Checkpoint failed. Keep working through the gaps."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkpoint failed.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-sky-200" />
          <p className="text-sm font-semibold text-slate-100">
            Understanding checkpoint
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Victor needs to hear you explain the argument before export.
        </p>
        <div className="mt-4 space-y-3 text-sm text-slate-300">
          {prompts.map((prompt, index) => (
            <div key={prompt} className="space-y-2">
              <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3">
                Victor: {prompt}
              </div>
              <textarea
                value={responses[index]}
                onChange={(event) => {
                  const next = [...responses];
                  next[index] = event.target.value;
                  setResponses(next);
                }}
                rows={3}
                placeholder="Respond in your own words."
                aria-label={`Checkpoint response ${index + 1}`}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-slate-100">Checkpoint rules</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          <li>Explain the structure and evidence clearly.</li>
          <li>Show you can defend the argument under pressure.</li>
          <li>No export until the checkpoint passes.</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit responses"}
          </button>
          {skipEligible && (
            <button
              type="button"
              onClick={() => setShowSkipModal(true)}
              className="rounded-full border border-red-400/40 bg-red-500/10 px-5 py-2 text-sm text-red-200"
            >
              Emergency skip
            </button>
          )}
        </div>
        {result && (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {result}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-white/30"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to generator
        </button>
      </div>

      <EmergencySkipModal
        isOpen={showSkipModal}
        usedCount={skipUsedCount}
        limit={1}
        onClose={() => setShowSkipModal(false)}
        onConfirm={async () => {
          if (!paperId) {
            setError("Paper draft not found. Generate the paper first.");
            setShowSkipModal(false);
            return;
          }
          try {
            const response = await fetch(
              `/api/academic/paper/emergency-skip/${paperId}`,
              { method: "POST" }
            );
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || "Emergency skip failed.");
            }
            setResult("Emergency skip used. Download is unlocked.");
            setSkipEligible(false);
            setSkipUsedCount((prev) => prev + 1);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Emergency skip failed."
            );
          } finally {
            setShowSkipModal(false);
          }
        }}
      />
    </div>
  );
}
