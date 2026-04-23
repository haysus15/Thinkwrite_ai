"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  OutlineStructure,
  OutlineStructureSection,
  PaperGenerationContext,
  ParsedRequirements,
  SectionGenerationStatus,
} from "@/components/academic/outline/outlineTypes";
import AcademicErrorState from "../shared/AcademicErrorState";

type RevisionIntent =
  | "more_depth"
  | "different_angle"
  | "adjust_length"
  | "manual_entry";

interface SectionRevisionPanelProps {
  paperId: string;
  outlineId: string;
  section: SectionGenerationStatus;
  sectionIndex: number;
  outlineSection: OutlineStructureSection;
  outlineStructure: OutlineStructure;
  totalSections: number;
  previousSectionsContent: string;
  conversationHistory: PaperGenerationContext["conversationHistory"];
  requirements: ParsedRequirements | null;
  voiceFingerprint: Record<string, unknown> | null;
  onRevisionComplete: (sectionIndex: number, newContent: string) => void;
  onClose: () => void;
}

function detectRevisionIntent(value: string): RevisionIntent {
  const normalized = value.toLowerCase();

  if (
    normalized.includes("write it myself") ||
    normalized.includes("i'll write") ||
    normalized.includes("let me write") ||
    normalized.includes("manual")
  ) {
    return "manual_entry";
  }

  if (
    normalized.includes("different angle") ||
    normalized.includes("different approach") ||
    normalized.includes("rewrite") ||
    normalized.includes("change direction")
  ) {
    return "different_angle";
  }

  if (
    normalized.includes("shorter") ||
    normalized.includes("longer") ||
    /\b\d+\s*words?\b/.test(normalized)
  ) {
    return "adjust_length";
  }

  return "more_depth";
}

export default function SectionRevisionPanel({
  paperId,
  outlineId,
  section,
  sectionIndex,
  outlineSection,
  outlineStructure,
  totalSections,
  previousSectionsContent,
  conversationHistory,
  requirements,
  voiceFingerprint,
  onRevisionComplete,
  onClose,
}: SectionRevisionPanelProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [requestText, setRequestText] = useState("");
  const [manualEntry, setManualEntry] = useState(section.content);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revisionOpeningMessage = `Your "${section.sectionTitle}" section is ${
    section.content.split(/\s+/).filter(Boolean).length
  } words.\n\nWhat would you like to change about this section?`;

  const generationContext: PaperGenerationContext = {
    outlineStructure,
    conversationHistory,
    thesis: outlineStructure.thesis,
    requirements,
    voiceFingerprint,
  };

  const persistManualContent = async (newContent: string) => {
    const { data, error: paperError } = await supabase
      .from("academic_papers")
      .select("section_generation_status")
      .eq("id", paperId)
      .single();

    if (paperError) {
      throw new Error(paperError.message);
    }

    const statuses = Array.isArray(data?.section_generation_status)
      ? (data.section_generation_status as SectionGenerationStatus[])
      : [];
    const updatedStatuses = statuses.map((status, index) =>
      index === sectionIndex
        ? { ...status, status: "complete" as const, content: newContent }
        : status
    );
    const assembledContent = updatedStatuses
      .filter((status) => status.content.trim())
      .map((status) => `## ${status.sectionTitle}\n\n${status.content.trim()}`)
      .join("\n\n");

    const { error: updateError } = await supabase
      .from("academic_papers")
      .update({
        section_generation_status: updatedStatuses,
        paper_content: assembledContent,
        word_count: assembledContent.split(/\s+/).filter(Boolean).length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paperId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    onRevisionComplete(sectionIndex, newContent);
  };

  const handleSubmit = async () => {
    const trimmed = requestText.trim();
    if (!trimmed) {
      setError("Tell Victor what you want changed in this section.");
      return;
    }

    const intent = detectRevisionIntent(trimmed);
    if (intent === "manual_entry") {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/academic/paper/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId,
          outlineId,
          sectionIndex,
          totalSections,
          previousSectionsContent,
          revisionNote: trimmed,
          generationContext,
        }),
      });

      const data = await response.json();
      if (!response.ok || typeof data?.content !== "string") {
        throw new Error(data?.error || "Could not revise this section.");
      }

      onRevisionComplete(sectionIndex, data.content);
    } catch (revisionError) {
      setError(
        revisionError instanceof Error
          ? revisionError.message
          : "Could not revise this section."
      );
    } finally {
      setLoading(false);
    }
  };

  const manualRequested = detectRevisionIntent(requestText) === "manual_entry";

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Section revision</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-100">{section.sectionTitle}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300"
        >
          Close
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100 whitespace-pre-wrap">
        {revisionOpeningMessage}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Current key points</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-200">
          {outlineSection.main_points.map((point) => (
            <li key={point}>• {point}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 space-y-3">
        <textarea
          value={requestText}
          onChange={(event) => setRequestText(event.target.value)}
          rows={4}
          placeholder='Try: "make this section shorter", "go deeper on the evidence", "rewrite this from a different angle", or "I will write it myself".'
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500"
        />
        {!manualRequested ? (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 disabled:opacity-60"
          >
            {loading ? "Revising section..." : "Revise section"}
          </button>
        ) : null}
      </div>

      {manualRequested ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-slate-300">
            Edit the section directly and save it back into the paper.
          </p>
          <textarea
            value={manualEntry}
            onChange={(event) => setManualEntry(event.target.value)}
            rows={10}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-base text-slate-100"
          />
          <button
            type="button"
            onClick={() => void persistManualContent(manualEntry)}
            disabled={loading}
            className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-5 py-2 text-sm text-emerald-100 disabled:opacity-60"
          >
            Save revised section
          </button>
        </div>
      ) : null}

      {error ? <AcademicErrorState message={error} className="mt-4 !min-h-0 py-3" /> : null}
    </div>
  );
}
