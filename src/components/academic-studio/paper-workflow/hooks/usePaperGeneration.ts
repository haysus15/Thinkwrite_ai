"use client";

import { useEffect, useState } from "react";
import type { OutlineStructure } from "./useOutlineContext";

export function usePaperGeneration(options: {
  outlineId: string | null;
  outlineBody: OutlineStructure | null;
  effectiveAssignmentId: string | null;
  targetPaperId?: string | null;
  assignmentSetId?: string | null;
  setOrder?: number | null;
  onGenerated?: () => void;
  onContinue: (paperId: string, generatedContent?: string) => void;
}) {
  const {
    outlineId,
    outlineBody,
    effectiveAssignmentId,
    targetPaperId,
    assignmentSetId,
    setOrder,
    onGenerated,
    onContinue,
  } = options;

  const [loading, setLoading] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [guardrails, setGuardrails] = useState<{
    sufficientData: boolean;
    warnings: string[];
  } | null>(null);
  const [voiceSources, setVoiceSources] = useState<string[]>([]);
  const [voiceSourceError, setVoiceSourceError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!outlineId || !outlineBody) return;
    setLoading(true);
    setGenerationError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/academic/paper/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlineId,
          paperId: targetPaperId || null,
          assignmentSetId: assignmentSetId || null,
          setOrder: setOrder ?? null,
          requirements: {
            assignmentId: effectiveAssignmentId,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setGuardrails(data.guardrails || null);
        throw new Error(data.error || "Generation failed.");
      }
      setStatus("Draft ready. Move to checkpoint.");
      setGuardrails(data.guardrails || null);
      onGenerated?.();
      onContinue(data.paperId, typeof data?.content === "string" ? data.content : "");
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadVoiceSources = async (activeRef?: { current: boolean }) => {
    try {
      setVoiceSourceError(null);
      const response = await fetch("/api/voice-profile/gatekeeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesting_studio: "academic",
          context: "paper_generator",
          requested_chambers: ["academic", "general", "overall"],
        }),
      });
      const data = await response.json();
      if (activeRef && !activeRef.current) return;
      const sources: string[] = [];
      const primaryLabel = data?.voice_profile?.primary_chamber;
      if (primaryLabel) sources.push(primaryLabel);
      if (data?.voice_profile?.general) sources.push("general");
      if (data?.voice_profile?.overall) sources.push("overall");
      setVoiceSources(sources.length ? sources : ["standard"]);
    } catch {
      if (activeRef && !activeRef.current) return;
      setVoiceSources(["standard"]);
      setVoiceSourceError(
        "Voice profile could not be loaded. Generation will continue with standard voice constraints."
      );
    }
  };

  useEffect(() => {
    const activeRef = { current: true };
    void loadVoiceSources(activeRef);
    return () => {
      activeRef.current = false;
    };
  }, []);

  return {
    loading,
    generationError,
    status,
    guardrails,
    voiceSources,
    voiceSourceError,
    reloadVoiceSources: () => loadVoiceSources(),
    handleGenerate,
  };
}
