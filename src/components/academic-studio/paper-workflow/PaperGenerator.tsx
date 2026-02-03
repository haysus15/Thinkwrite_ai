// src/components/academic-studio/paper-workflow/PaperGenerator.tsx
"use client";

import { ArrowLeft, ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { useState } from "react";

interface PaperGeneratorProps {
  outlineId: string | null;
  assignmentId?: string | null;
  onBack: () => void;
  onContinue: (paperId: string) => void;
}

export default function PaperGenerator({
  outlineId,
  assignmentId,
  onBack,
  onContinue,
}: PaperGeneratorProps) {
  const outlineReady = Boolean(outlineId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!outlineId) return;
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/academic/paper/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlineId,
          requirements: {
            assignmentId,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Generation failed.");
      }
      setStatus("Draft ready. Move to checkpoint.");
      onContinue(data.paperId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-slate-200" />
          <p className="text-sm font-semibold text-slate-100">
            Paper generator
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Mirror Mode voice confidence must be above 50 before generation.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Length
            </p>
            <p className="mt-2 text-sm text-slate-100">
              Assignment requirements
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Citation
            </p>
            <p className="mt-2 text-sm text-slate-100">
              Assignment requirements
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Sources
            </p>
            <p className="mt-2 text-sm text-slate-100">
              Assignment requirements
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-sky-200" />
          <p className="text-sm font-semibold text-slate-100">
            Requirements check
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Travis validates sources, sections, and formatting before you move
          forward.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Thesis locked
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Sections mapped
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Sources queued
          </span>
          {!outlineReady && (
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-amber-200">
              Outline required
            </span>
          )}
          {assignmentId && (
            <span className="rounded-full border border-teal-400/40 bg-teal-500/10 px-3 py-1 text-teal-200">
              Assignment linked
            </span>
          )}
        </div>
        {status && (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {status}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-white/30"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to outline
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 transition hover:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!outlineReady || loading}
        >
          {loading ? "Generating..." : "Generate draft"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
