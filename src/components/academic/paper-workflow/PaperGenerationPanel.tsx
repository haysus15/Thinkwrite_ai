"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ConversationHistoryEntry,
  OutlineStructure,
  PaperGenerationContext,
  PaperSource,
  ParsedRequirements,
  SectionGenerationStatus,
} from "@/components/academic/outline/outlineTypes";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import SectionRevisionPanel from "./SectionRevisionPanel";

type OutlineResponse = {
  id: string;
  topic: string | null;
  assignment_id: string | null;
  class_name: string | null;
  assignment_type: string | null;
  conversation_history: ConversationHistoryEntry[] | null;
  outline_structure: OutlineStructure;
};

type AssignmentRecord = {
  requirements?: Record<string, unknown> | null;
};

type MobileGenerationTab = "progress" | "paper";

interface PaperGenerationPanelProps {
  paperId?: string | null;
  outlineId: string;
  userId: string;
  assignmentDueDate: string | null;
  onGenerationComplete: (paperId: string, generatedContent: string) => void;
}

function normalizeRequirements(
  requirements: Record<string, unknown> | null | undefined
): ParsedRequirements | null {
  if (!requirements) return null;

  return {
    assignmentType:
      typeof requirements.assignment_type === "string"
        ? requirements.assignment_type
        : undefined,
    requiredSections: Array.isArray(requirements.required_sections)
      ? requirements.required_sections.map((value) => String(value))
      : undefined,
    requiredTopics: Array.isArray(requirements.required_topics)
      ? requirements.required_topics.map((value) => String(value))
      : Array.isArray(requirements.topics_to_cover)
        ? requirements.topics_to_cover.map((value) => String(value))
        : undefined,
    minSources:
      typeof requirements.min_sources === "number"
        ? requirements.min_sources
        : undefined,
    citationFormat:
      typeof requirements.citation_style === "string"
        ? requirements.citation_style
        : undefined,
    wordCount:
      typeof requirements.word_count === "number"
        ? String(requirements.word_count)
        : typeof requirements.word_count === "string"
          ? requirements.word_count
          : undefined,
    minSections:
      typeof requirements.min_sections === "number"
        ? requirements.min_sections
        : undefined,
  };
}

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function assemblePaperContent(statuses: SectionGenerationStatus[]): string {
  return statuses
    .filter((status) => status.status === "complete" && status.content.trim())
    .map((status) => `## ${status.sectionTitle}\n\n${status.content.trim()}`)
    .join("\n\n");
}

export default function PaperGenerationPanel({
  paperId: initialPaperId = null,
  outlineId,
  userId,
  assignmentDueDate: _assignmentDueDate,
  onGenerationComplete,
}: PaperGenerationPanelProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [resolvedPaperId, setResolvedPaperId] = useState<string | null>(initialPaperId);
  const [outlineRecord, setOutlineRecord] = useState<OutlineResponse | null>(null);
  const [requirements, setRequirements] = useState<ParsedRequirements | null>(null);
  const [voiceFingerprint, setVoiceFingerprint] = useState<Record<string, unknown> | null>(null);
  const [approvedSources, setApprovedSources] = useState<PaperSource[]>([]);
  const [sectionStatuses, setSectionStatuses] = useState<SectionGenerationStatus[]>([]);
  const [currentlyGenerating, setCurrentlyGenerating] = useState<number | null>(null);
  const [paperContent, setPaperContent] = useState("");
  const [generationStarted, setGenerationStarted] = useState(false);
  const [allSectionsComplete, setAllSectionsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [manualEntryIndex, setManualEntryIndex] = useState<number | null>(null);
  const [manualEntryValue, setManualEntryValue] = useState("");
  const [editedKeyPoints, setEditedKeyPoints] = useState<Record<string, string[]>>({});
  const [activeMobileTab, setActiveMobileTab] = useState<MobileGenerationTab>("progress");
  const [paperHasUpdate, setPaperHasUpdate] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<number | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const loadGenerationContext = async (): Promise<{
    outline: OutlineResponse;
    requirements: ParsedRequirements | null;
    voiceFingerprint: Record<string, unknown> | null;
    sources: PaperSource[];
  }> => {
    const [outlineResponse, sourcesResult, voiceResult] = await Promise.all([
      fetch(`/api/academic/outline/${outlineId}`),
      supabase
        .from("paper_sources")
        .select("*")
        .eq("outline_id", outlineId)
        .eq("victor_approved", true),
      supabase
        .from("voice_chambers")
        .select("aggregate_fingerprint")
        .eq("user_id", userId)
        .eq("chamber", "academic")
        .maybeSingle(),
    ]);

    const outlineData = await outlineResponse.json();
    if (!outlineResponse.ok || !outlineData?.outline?.outline_structure) {
      throw new Error(outlineData?.error || "Could not load outline. Go back and try again.");
    }

    const outline = outlineData.outline as OutlineResponse;
    let parsedRequirements: ParsedRequirements | null = null;

    if (outline.assignment_id) {
      const assignmentResponse = await fetch(`/api/travis/assignment/${outline.assignment_id}`);
      const assignmentData = await assignmentResponse.json();
      if (assignmentResponse.ok && assignmentData?.assignment) {
        parsedRequirements = normalizeRequirements(
          (assignmentData.assignment as AssignmentRecord).requirements ?? null
        );
      }
    }

    return {
      outline,
      requirements: parsedRequirements,
      voiceFingerprint:
        voiceResult.data?.aggregate_fingerprint &&
        typeof voiceResult.data.aggregate_fingerprint === "object"
          ? (voiceResult.data.aggregate_fingerprint as Record<string, unknown>)
          : null,
      sources: (sourcesResult.data ?? []) as PaperSource[],
    };
  };

  const createPaperStub = async (outline: OutlineResponse): Promise<string> => {
    const { data, error: insertError } = await supabase
      .from("academic_papers")
      .insert({
        user_id: userId,
        outline_id: outlineId,
        assignment_id: outline.assignment_id,
        topic: outline.topic,
        paper_content: "",
        citation_style: requirements?.citationFormat ?? "APA",
        citation_count: 0,
        word_count: 0,
        checkpoint_passed: false,
        emergency_skip_used: false,
        is_complete: false,
        workflow_step: "generate",
        workflow_step_updated_at: new Date().toISOString(),
        section_generation_status: [],
      })
      .select("id")
      .single();

    if (insertError || !data?.id) {
      throw new Error(insertError?.message || "Could not initialize your paper record.");
    }

    return String(data.id);
  };

  const persistStatuses = async (
    paperId: string,
    statuses: SectionGenerationStatus[],
    assembledContent?: string
  ) => {
    const nextContent = assembledContent ?? assemblePaperContent(statuses);
    await supabase
      .from("academic_papers")
      .update({
        section_generation_status: statuses,
        paper_content: nextContent,
        word_count: countWords(nextContent),
        updated_at: new Date().toISOString(),
      })
      .eq("id", paperId);
  };

  const initializeSectionStatuses = async (
    paperId: string,
    outline: OutlineStructure
  ): Promise<SectionGenerationStatus[]> => {
    const existing = await supabase
      .from("academic_papers")
      .select("section_generation_status")
      .eq("id", paperId)
      .single();

    const current = Array.isArray(existing.data?.section_generation_status)
      ? (existing.data.section_generation_status as SectionGenerationStatus[])
      : [];
    const allPending =
      current.length === 0 || current.every((status) => status.status === "pending");

    if (!allPending) {
      return current;
    }

    const initialized: SectionGenerationStatus[] = outline.sections.map((section) => ({
      sectionId: section.id,
      sectionTitle: section.title,
      status: "pending",
      content: "",
      retryCount: 0,
    }));

    await supabase
      .from("academic_papers")
      .update({ section_generation_status: initialized })
      .eq("id", paperId);

    return initialized;
  };

  const setStatusesAndPaperContent = (
    updater: (
      previous: SectionGenerationStatus[]
    ) => { statuses: SectionGenerationStatus[]; content?: string }
  ) => {
    setSectionStatuses((previous) => {
      const next = updater(previous);
      const assembled = next.content ?? assemblePaperContent(next.statuses);
      setPaperContent(assembled);
      if (activeMobileTab !== "paper" && assembled !== paperContent) {
        setPaperHasUpdate(true);
      }
      return next.statuses;
    });
  };

  const buildGenerationContext = (
    outline: OutlineStructure,
    conversationHistory: ConversationHistoryEntry[] | null
  ): PaperGenerationContext => ({
    outlineStructure: outline,
    conversationHistory: conversationHistory ?? [],
    thesis: outline.thesis,
    requirements,
    voiceFingerprint,
  });

  const generateSectionWithRetry = async (
    paperId: string,
    index: number,
    outline: OutlineStructure,
    previousSectionsContent: string,
    conversationHistory: ConversationHistoryEntry[] | null
  ): Promise<{
    success: boolean;
    content: string;
    statuses: SectionGenerationStatus[];
    assembledContent: string;
  }> => {
    const section = outline.sections[index];
    const overridePoints = editedKeyPoints[section.id];
    const effectiveOutline: OutlineStructure = overridePoints
      ? {
          ...outline,
          sections: outline.sections.map((candidate, candidateIndex) =>
            candidateIndex === index
              ? { ...candidate, main_points: overridePoints }
              : candidate
          ),
        }
      : outline;

    for (let attempt = 0; attempt <= 1; attempt += 1) {
      try {
        const response = await fetch("/api/academic/paper/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperId,
            outlineId,
            sectionIndex: index,
            totalSections: outline.sections.length,
            previousSectionsContent,
            platform:
              typeof window !== "undefined" && window.innerWidth < 768
                ? "mobile"
                : "desktop",
            generationContext: buildGenerationContext(
              effectiveOutline,
              conversationHistory
            ),
          }),
        });

        const data = await response.json();
        if (!response.ok || data?.complete !== true) {
          throw new Error(data?.error || `HTTP ${response.status}`);
        }

        return {
          success: true,
          content: typeof data.content === "string" ? data.content : "",
          statuses: Array.isArray(data.section_generation_status)
            ? (data.section_generation_status as SectionGenerationStatus[])
            : [],
          assembledContent:
            typeof data.paper_content === "string" ? data.paper_content : "",
        };
      } catch {
        if (attempt === 0) continue;
        return { success: false, content: "", statuses: [], assembledContent: "" };
      }
    }

    return { success: false, content: "", statuses: [], assembledContent: "" };
  };

  const runGeneration = async () => {
    setGenerationStarted(true);
    setError(null);

    try {
      const loaded = await loadGenerationContext();
      setOutlineRecord(loaded.outline);
      setRequirements(loaded.requirements);
      setVoiceFingerprint(loaded.voiceFingerprint);
      setApprovedSources(loaded.sources);

      const effectivePaperId = resolvedPaperId ?? (await createPaperStub(loaded.outline));
      if (!resolvedPaperId) {
        setResolvedPaperId(effectivePaperId);
      }

      let workingStatuses = await initializeSectionStatuses(
        effectivePaperId,
        loaded.outline.outline_structure
      );
      setSectionStatuses(workingStatuses);
      setPaperContent(assemblePaperContent(workingStatuses));

      let previousContent = assemblePaperContent(
        workingStatuses.filter((status) => status.status === "complete")
      );

      for (let index = 0; index < loaded.outline.outline_structure.sections.length; index += 1) {
        if (workingStatuses[index]?.status === "complete") {
          continue;
        }

        setCurrentlyGenerating(index);
        workingStatuses = workingStatuses.map((status, statusIndex): SectionGenerationStatus =>
          statusIndex === index
            ? {
                ...status,
                status: "generating" as const,
                retryCount: status.retryCount + 1,
              }
            : status
        );
        setSectionStatuses(workingStatuses);
        await persistStatuses(effectivePaperId, workingStatuses);

        const result = await generateSectionWithRetry(
          effectivePaperId,
          index,
          loaded.outline.outline_structure,
          previousContent,
          loaded.outline.conversation_history
        );

        if (result.success) {
          workingStatuses = result.statuses.length
            ? result.statuses
            : workingStatuses.map((status, statusIndex) =>
                statusIndex === index
                  ? { ...status, status: "complete", content: result.content }
                  : status
              );

          previousContent = result.assembledContent || assemblePaperContent(workingStatuses);
          setSectionStatuses(workingStatuses);
          setPaperContent(previousContent);
          if (activeMobileTab !== "paper") {
            setPaperHasUpdate(true);
          }
          continue;
        }

        workingStatuses = workingStatuses.map((status, statusIndex): SectionGenerationStatus =>
          statusIndex === index ? { ...status, status: "failed" } : status
        );
        setSectionStatuses(workingStatuses);
        await persistStatuses(effectivePaperId, workingStatuses);
      }

      setCurrentlyGenerating(null);
      const allTerminal = workingStatuses.every(
        (status) => status.status === "complete" || status.status === "failed"
      );
      setAllSectionsComplete(allTerminal);
      if (allTerminal) {
        const assembled = assemblePaperContent(workingStatuses);
        setIsReviewMode(true);
        onGenerationComplete(effectivePaperId, assembled);
      }
    } catch (generationError) {
      setCurrentlyGenerating(null);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Generation failed."
      );
    }
  };

  const handleRetrySection = async (index: number) => {
    if (!outlineRecord || !resolvedPaperId) return;
    const baselineStatuses = [...sectionStatuses];
    const previousContent = assemblePaperContent(
      baselineStatuses.filter((_, statusIndex) => statusIndex < index)
    );

    const nextStatuses = baselineStatuses.map((status, statusIndex): SectionGenerationStatus =>
      statusIndex === index
        ? {
            ...status,
            status: "generating" as const,
            retryCount: status.retryCount + 1,
          }
        : status
    );
    setSectionStatuses(nextStatuses);
    setCurrentlyGenerating(index);
    await persistStatuses(resolvedPaperId, nextStatuses);

    const result = await generateSectionWithRetry(
      resolvedPaperId,
      index,
      outlineRecord.outline_structure,
      previousContent,
      outlineRecord.conversation_history
    );

    if (!result.success) {
      const failedStatuses = nextStatuses.map((status, statusIndex): SectionGenerationStatus =>
        statusIndex === index ? { ...status, status: "failed" } : status
      );
      setSectionStatuses(failedStatuses);
      setCurrentlyGenerating(null);
      await persistStatuses(resolvedPaperId, failedStatuses);
      return;
    }

    const workingStatuses = result.statuses.length
      ? result.statuses
      : nextStatuses.map((status, statusIndex): SectionGenerationStatus =>
          statusIndex === index
            ? { ...status, status: "complete" as const, content: result.content }
            : status
        );

    setCurrentlyGenerating(null);
    setSectionStatuses(workingStatuses);
    setPaperContent(result.assembledContent || assemblePaperContent(workingStatuses));
    setEditingSectionIndex(null);
    if (activeMobileTab !== "paper") {
      setPaperHasUpdate(true);
    }
  };

  const handleManualEntrySave = async () => {
    if (manualEntryIndex == null || !resolvedPaperId) return;
    const nextStatuses = sectionStatuses.map((status, index): SectionGenerationStatus =>
      index === manualEntryIndex
        ? { ...status, status: "complete" as const, content: manualEntryValue }
        : status
    );
    const assembled = assemblePaperContent(nextStatuses);
    setSectionStatuses(nextStatuses);
    setPaperContent(assembled);
    setManualEntryIndex(null);
    setManualEntryValue("");
    await persistStatuses(resolvedPaperId, nextStatuses, assembled);
    if (activeMobileTab !== "paper") {
      setPaperHasUpdate(true);
    }
  };

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await loadGenerationContext();
        if (!active) return;
        setOutlineRecord(loaded.outline);
        setRequirements(loaded.requirements);
        setVoiceFingerprint(loaded.voiceFingerprint);
        setApprovedSources(loaded.sources);

        if (initialPaperId) {
          const { data: paperData, error: paperError } = await supabase
            .from("academic_papers")
            .select("section_generation_status, paper_content")
            .eq("id", initialPaperId)
            .single();

          if (paperError) {
            throw new Error(paperError.message);
          }

          const statuses = Array.isArray(paperData?.section_generation_status)
            ? (paperData.section_generation_status as SectionGenerationStatus[])
            : [];

          if (!active) return;
          setSectionStatuses(statuses);
          setPaperContent(
            typeof paperData?.paper_content === "string" ? paperData.paper_content : ""
          );

          const shouldResume =
            statuses.length > 0 &&
            statuses.some((status) => status.status === "complete") &&
            statuses.some(
              (status) => status.status === "pending" || status.status === "generating"
            );

          if (shouldResume) {
            void runGeneration();
          }
        }
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load generation context."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadInitial();
    return () => {
      active = false;
    };
  }, [initialPaperId, outlineId]);

  const handleEditPointChange = (sectionId: string, value: string) => {
    setEditedKeyPoints((current) => ({
      ...current,
      [sectionId]: value
        .split("\n")
        .map((point) => point.trim())
        .filter(Boolean),
    }));
  };

  const handleRevisionComplete = async (sectionIndex: number, newContent: string) => {
    const nextStatuses = sectionStatuses.map((status, index): SectionGenerationStatus =>
      index === sectionIndex
        ? { ...status, status: "complete" as const, content: newContent }
        : status
    );
    const assembled = assemblePaperContent(nextStatuses);
    setSectionStatuses(nextStatuses);
    setPaperContent(assembled);
    setRevisionTarget(null);
    setIsReviewMode(true);
    if (activeMobileTab !== "paper") {
      setPaperHasUpdate(true);
    }

    if (resolvedPaperId) {
      await persistStatuses(resolvedPaperId, nextStatuses, assembled);
    }
  };

  if (loading) {
    return <AcademicLoadingState message="Preparing section-by-section generation..." />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-slate-200" />
          <p className="text-sm font-semibold text-slate-100">Generate your paper</p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Your paper will be generated one section at a time from the approved outline.
          Completed sections appear on the right as they finish.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            {outlineRecord?.outline_structure.sections.length ?? 0} sections queued
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            {approvedSources.length} approved sources
          </span>
          {requirements?.citationFormat ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {requirements.citationFormat} citations
            </span>
          ) : null}
        </div>
        {!generationStarted && (
          <button
            type="button"
            onClick={() => void runGeneration()}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 transition hover:border-sky-300/70"
          >
            Generate my paper
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {error ? <AcademicErrorState message={error} className="!min-h-0 py-3" /> : null}

      <div className="flex md:hidden">
        <button
          type="button"
          onClick={() => setActiveMobileTab("progress")}
          className={`flex-1 rounded-l-2xl border px-4 py-3 text-sm ${
            activeMobileTab === "progress"
              ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
              : "border-white/10 bg-white/5 text-slate-300"
          }`}
        >
          Progress
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMobileTab("paper");
            setPaperHasUpdate(false);
          }}
          className={`relative flex-1 rounded-r-2xl border px-4 py-3 text-sm ${
            activeMobileTab === "paper"
              ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
              : "border-white/10 bg-white/5 text-slate-300"
          }`}
        >
          Paper
          {paperHasUpdate ? (
            <span className="absolute right-4 top-3 h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <section
          className={`${activeMobileTab === "progress" ? "block" : "hidden"} rounded-3xl border border-white/10 bg-slate-950/50 p-5 md:block`}
        >
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Generation progress
          </h2>
          <div className="mt-4 space-y-3">
            {sectionStatuses.map((section, index) => (
              <div
                key={section.sectionId}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center gap-3 text-sm text-slate-100">
                  <span className="w-4 text-center">
                    {section.status === "complete"
                      ? "✓"
                      : section.status === "generating"
                        ? "▶"
                        : section.status === "failed"
                          ? "✗"
                          : "○"}
                  </span>
                  <span>{section.sectionTitle}</span>
                </div>

                {section.status === "failed" ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRetrySection(index)}
                        className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100"
                      >
                        Retry this section
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingSectionIndex((current) =>
                            current === index ? null : index
                          )
                        }
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
                      >
                        Edit key points and retry
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setManualEntryIndex(index);
                          setManualEntryValue(section.content);
                        }}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
                      >
                        Write this section myself
                      </button>
                    </div>

                    {editingSectionIndex === index && outlineRecord ? (
                      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                        <textarea
                          defaultValue={
                            editedKeyPoints[section.sectionId]?.join("\n") ||
                            outlineRecord.outline_structure.sections[index]?.main_points.join("\n") ||
                            ""
                          }
                          onChange={(event) =>
                            handleEditPointChange(section.sectionId, event.target.value)
                          }
                          className="min-h-[120px] w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-base text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => void handleRetrySection(index)}
                          className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100"
                        >
                          Retry with edited points
                        </button>
                      </div>
                    ) : null}

                    {manualEntryIndex === index ? (
                      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                        <textarea
                          value={manualEntryValue}
                          onChange={(event) => setManualEntryValue(event.target.value)}
                          className="min-h-[160px] w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-base text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => void handleManualEntrySave()}
                          className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100"
                        >
                          Save section content
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Victor is available for questions while your paper generates.
          </p>
        </section>

        <section
          className={`${activeMobileTab === "paper" ? "block" : "hidden"} rounded-3xl border border-white/10 bg-slate-950/50 p-5 md:block`}
        >
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Paper content
          </h2>
          <div className="mt-4 space-y-6">
            {sectionStatuses
              .filter((section) => section.content.trim())
              .map((section, index) => (
                <article
                  key={section.sectionId}
                  className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-slate-100">
                      {section.sectionTitle}
                    </h3>
                    {isReviewMode && outlineRecord ? (
                      <button
                        type="button"
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-100"
                        onClick={() => setRevisionTarget(index)}
                      >
                        Revise
                      </button>
                    ) : null}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                    {section.content}
                  </div>
                </article>
              ))}

            {currentlyGenerating != null && sectionStatuses[currentlyGenerating] ? (
              <article className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-100">
                  {sectionStatuses[currentlyGenerating].sectionTitle}
                </h3>
                <div className="text-sm text-slate-400">
                  Generating this section<span className="animate-pulse"> |</span>
                </div>
              </article>
            ) : null}

            {!paperContent.trim() && !currentlyGenerating ? (
              <p className="text-sm text-slate-400">
                Your completed sections will appear here as generation progresses.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {allSectionsComplete ? (
        <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Section generation is complete. Review the paper and revise any section before moving on.
        </div>
      ) : null}

      {revisionTarget != null &&
      outlineRecord &&
      sectionStatuses[revisionTarget] &&
      resolvedPaperId ? (
        <SectionRevisionPanel
          paperId={resolvedPaperId}
          outlineId={outlineId}
          section={sectionStatuses[revisionTarget]}
          sectionIndex={revisionTarget}
          outlineSection={outlineRecord.outline_structure.sections[revisionTarget]}
          outlineStructure={outlineRecord.outline_structure}
          totalSections={outlineRecord.outline_structure.sections.length}
          previousSectionsContent={assemblePaperContent(
            sectionStatuses.filter((_, index) => index < revisionTarget)
          )}
          conversationHistory={outlineRecord.conversation_history ?? []}
          requirements={requirements}
          voiceFingerprint={voiceFingerprint}
          onRevisionComplete={(index, newContent) =>
            void handleRevisionComplete(index, newContent)
          }
          onClose={() => setRevisionTarget(null)}
        />
      ) : null}
    </div>
  );
}
