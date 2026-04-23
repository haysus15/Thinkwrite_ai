"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleSlash, AlertTriangle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  OutlineStructure,
  PaperSource,
  ParsedRequirements,
  SectionGenerationStatus,
} from "@/components/academic/outline/outlineTypes";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";

interface GenerationQualitySummaryProps {
  paperId: string;
  outlineId: string;
  requirements: ParsedRequirements | null;
  voiceApplied: boolean;
  onReview: () => void;
  onProceed: () => void;
}

interface KeyPointGap {
  sectionTitle: string;
  keyPoint: string;
}

interface QualitySummary {
  sectionsGenerated: number;
  totalSections: number;
  wordCount: number;
  requiredWordCount: string | null;
  wordCountMet: boolean;
  keyPointsAddressed: number;
  totalKeyPoints: number;
  sourcesUsed: number;
  requiredSources: number;
  sourcesMet: boolean;
  voiceApplied: boolean;
  incompleteSections: string[];
  undercoveredKeyPoints: KeyPointGap[];
}

function detectKeyPointGaps(
  statuses: SectionGenerationStatus[],
  outline: OutlineStructure
): KeyPointGap[] {
  const gaps: KeyPointGap[] = [];

  outline.sections.forEach((section, index) => {
    const status = statuses[index];
    if (!status || status.status !== "complete") return;

    const contentLower = status.content.toLowerCase();

    section.main_points.forEach((point) => {
      const pointWords = point
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 4);
      const significantWords = pointWords.filter(
        (word) =>
          !["about", "their", "these", "those", "which", "would", "could", "should"].includes(
            word
          )
      );
      const covered =
        significantWords.length === 0 ||
        significantWords.some((word) => contentLower.includes(word));

      if (!covered) {
        gaps.push({ sectionTitle: section.title, keyPoint: point });
      }
    });
  });

  return gaps;
}

function SummaryItem({
  label,
  value,
  met,
  neutral = false,
}: {
  label: string;
  value: string;
  met: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-2 text-sm text-slate-100">{value}</p>
        </div>
        {neutral ? (
          <CircleSlash className="h-4 w-4 text-slate-400" />
        ) : met ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-300" />
        )}
      </div>
    </div>
  );
}

export default function GenerationQualitySummary({
  paperId,
  outlineId,
  requirements,
  voiceApplied,
  onReview,
  onProceed,
}: GenerationQualitySummaryProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      setLoading(true);
      setError(null);

      try {
        const [paperResult, outlineResponse, sourcesResult] = await Promise.all([
          supabase
            .from("academic_papers")
            .select("paper_content, word_count, section_generation_status")
            .eq("id", paperId)
            .single(),
          fetch(`/api/academic/outline/${outlineId}`),
          supabase
            .from("paper_sources")
            .select("*")
            .eq("outline_id", outlineId)
            .eq("victor_approved", true),
        ]);

        const outlinePayload = await outlineResponse.json();
        if (!outlineResponse.ok || !outlinePayload?.outline?.outline_structure) {
          throw new Error(outlinePayload?.error || "Could not load outline summary.");
        }
        if (paperResult.error) {
          throw new Error(paperResult.error.message);
        }

        const outline = outlinePayload.outline.outline_structure as OutlineStructure;
        const statuses = Array.isArray(paperResult.data?.section_generation_status)
          ? (paperResult.data.section_generation_status as SectionGenerationStatus[])
          : [];
        const approvedSources = (sourcesResult.data ?? []) as PaperSource[];
        const incompleteSections = statuses
          .filter((status) => status.status === "failed")
          .map((status) => status.sectionTitle);
        const undercoveredKeyPoints = detectKeyPointGaps(statuses, outline);
        const totalKeyPoints = outline.sections.reduce(
          (sum, section) => sum + section.main_points.length,
          0
        );
        const addressedKeyPoints = Math.max(
          0,
          totalKeyPoints - undercoveredKeyPoints.length
        );
        const computedWordCount =
          typeof paperResult.data?.word_count === "number"
            ? paperResult.data.word_count
            : (paperResult.data?.paper_content || "").split(/\s+/).filter(Boolean).length;
        const requiredWordCount = requirements?.wordCount ?? null;
        const minWords =
          requiredWordCount && /^\d+/.test(requiredWordCount)
            ? Number(requiredWordCount.match(/\d+/)?.[0] || 0)
            : null;

        const nextSummary: QualitySummary = {
          sectionsGenerated: statuses.filter((status) => status.status === "complete").length,
          totalSections: outline.sections.length,
          wordCount: computedWordCount,
          requiredWordCount,
          wordCountMet: minWords == null ? true : computedWordCount >= minWords,
          keyPointsAddressed: addressedKeyPoints,
          totalKeyPoints,
          sourcesUsed: approvedSources.length,
          requiredSources: Number(requirements?.minSources || 0),
          sourcesMet:
            Number(requirements?.minSources || 0) === 0 ||
            approvedSources.length >= Number(requirements?.minSources || 0),
          voiceApplied,
          incompleteSections,
          undercoveredKeyPoints,
        };

        if (!active) return;
        setSummary(nextSummary);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not compute quality summary."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSummary();
    return () => {
      active = false;
    };
  }, [outlineId, paperId, requirements, supabase, voiceApplied]);

  if (loading) {
    return <AcademicLoadingState message="Reviewing your generated paper..." />;
  }

  if (error || !summary) {
    return (
      <AcademicErrorState
        message={error || "Could not load the quality summary."}
        className="!min-h-0 py-3"
      />
    );
  }

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-slate-950/50 p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Your paper is ready for review</h2>
        <p className="mt-2 text-sm text-slate-400">
          This is a factual summary of what generated successfully before you move to the checkpoint.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryItem
          label="Sections generated"
          value={`${summary.sectionsGenerated} of ${summary.totalSections}`}
          met={summary.sectionsGenerated === summary.totalSections}
        />
        {summary.requiredWordCount ? (
          <SummaryItem
            label="Word count"
            value={`${summary.wordCount.toLocaleString()} words (requirement: ${summary.requiredWordCount})`}
            met={summary.wordCountMet}
          />
        ) : null}
        <SummaryItem
          label="Key points addressed"
          value={`${summary.keyPointsAddressed} of ${summary.totalKeyPoints}`}
          met={summary.undercoveredKeyPoints.length === 0}
        />
        {summary.requiredSources > 0 ? (
          <SummaryItem
            label="Sources cited"
            value={`${summary.sourcesUsed} (requirement: ${summary.requiredSources} minimum)`}
            met={summary.sourcesMet}
          />
        ) : null}
        <SummaryItem
          label="Mirror Mode"
          value={
            summary.voiceApplied
              ? "Active — voice applied"
              : "Not active for this paper"
          }
          met={summary.voiceApplied}
          neutral={!summary.voiceApplied}
        />
      </div>

      {summary.incompleteSections.length > 0 ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-100">
            These sections did not generate successfully:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-amber-50/90">
            {summary.incompleteSections.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.undercoveredKeyPoints.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-slate-100">
            These key points may not be fully addressed:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {summary.undercoveredKeyPoints.map((gap, index) => (
              <li key={`${gap.sectionTitle}-${index}`}>
                "{gap.keyPoint}" — {gap.sectionTitle}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onReview}
          className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm text-slate-100"
        >
          Review and revise
        </button>
        <button
          type="button"
          onClick={onProceed}
          className="rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200"
        >
          Continue to checkpoint →
        </button>
      </div>
    </div>
  );
}
