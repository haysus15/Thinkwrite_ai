"use client";

import { useRef, useState } from "react";
import type { SystemStep, VictorHandoffContext } from "@/lib/academic/teachingEngine";
import type { MisconceptionLevel } from "@/lib/academic/victor/victorTypes";
import { useVictorChat } from "../../victor-chat/VictorChatContext";
import type { OutlineStructure } from "./useOutlineContext";

type OutlineMeta = {
  topic: string | null;
  className: string | null;
  assignmentType: string | null;
  assignmentId: string | null;
  dueDate?: string | null;
  gradingWeight?: number | null;
  assignmentName?: string | null;
  assignmentRequirements?: Record<string, unknown> | null;
  studentDeclaration?: {
    argument?: string;
    main_points?: string;
    assignment_understanding?: string;
  } | null;
  sectionConfidence?: Record<string, "solid" | "somewhat_clear" | "unsure"> | null;
  sourceRequirements?: Record<string, unknown> | null;
};

export function usePaperTeaching(options: {
  outlineBody: OutlineStructure | null;
  outlineMeta: OutlineMeta | null;
}) {
  const { outlineBody, outlineMeta } = options;
  const {
    setMode,
    conversationId,
    setConversationId,
    setMessages,
    coachingProfile,
  } = useVictorChat();

  const [teachingSessionId, setTeachingSessionId] = useState<string | null>(null);
  const [teachingSteps, setTeachingSteps] = useState<SystemStep[]>([]);
  const [teachingCurrentStepIndex, setTeachingCurrentStepIndex] = useState(0);
  const [teachingLoading, setTeachingLoading] = useState(false);
  const [teachingError, setTeachingError] = useState<string | null>(null);
  const [misconceptionLevel, setMisconceptionLevel] = useState<MisconceptionLevel>("none");
  const recentMisconceptionsRef = useRef<MisconceptionLevel[]>([]);
  const loggedStrugglesRef = useRef<Set<string>>(new Set());

  const sendVictorIntervention = async (
    context: VictorHandoffContext,
    reasonLabel: string
  ) => {
    const prompt = `Help me understand Step ${context.struggleStep.stepNumber}: ${context.struggleStep.title}.`;
    setMode("teaching");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt, timestamp: new Date().toISOString() },
    ]);
    const response = await fetch("/api/victor/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversationId || undefined,
        mode: "teaching",
        message: prompt,
        workspaceContext: `Paper workflow · ${reasonLabel}`,
        victorHandoffContext: context,
        coachingProfile,
        assignmentId: outlineMeta?.assignmentId || null,
        victorContext: {
          sectionTitle: context.struggleStep.title,
          sectionBody: null,
          assignmentRequirements: outlineMeta?.assignmentRequirements ?? null,
          assignmentName:
            outlineMeta?.assignmentName || outlineMeta?.topic || "Current assignment",
          className: outlineMeta?.className || "Current class",
          paperType: outlineMeta?.assignmentType || null,
          studentDeclaration: outlineMeta?.studentDeclaration ?? null,
          unsureSections: Object.entries(outlineMeta?.sectionConfidence || {})
            .filter(([, value]) => value === "unsure")
            .map(([sectionId]) => sectionId),
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Victor intervention failed.");
    }
    if (typeof data?.recoveryMessage === "string" && data.recoveryMessage.trim()) {
      throw new Error(data.recoveryMessage);
    }
    if (data?.conversationId) {
      setConversationId(data.conversationId);
    }
    if (typeof data?.misconceptionLevel === "string") {
      const level = data.misconceptionLevel as MisconceptionLevel;
      setMisconceptionLevel(level);

      const previousLevel =
        recentMisconceptionsRef.current.length > 0
          ? recentMisconceptionsRef.current[recentMisconceptionsRef.current.length - 1]
          : "none";
      recentMisconceptionsRef.current = [
        ...recentMisconceptionsRef.current.slice(-2),
        level,
      ];

      const shouldLog =
        (level === "partial" || level === "fundamental") &&
        (previousLevel === "partial" || previousLevel === "fundamental") &&
        Boolean(outlineMeta?.className?.trim());

      if (shouldLog) {
        const struggleType =
          level === "fundamental" ? "misconception" : "incomplete_understanding";
        const dedupeKey = `${outlineMeta?.assignmentId || "none"}:${outlineMeta?.className}:${struggleType}:${prompt}`;
        if (!loggedStrugglesRef.current.has(dedupeKey)) {
          loggedStrugglesRef.current.add(dedupeKey);
          void fetch("/api/victor/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignmentId: outlineMeta?.assignmentId || null,
              className: outlineMeta?.className,
              struggleType,
              sessionNotes: `Paper intervention: ${reasonLabel}`,
              studentMessages: [prompt],
            }),
          }).catch(() => {
            setTeachingError(
              "Progress could not be synced to your assignment. Your paper is saved."
            );
          });
        }
      }
    }
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.reply || "Victor intervention started.",
        timestamp: new Date().toISOString(),
        responseType: data.responseType,
        misconceptionLevel: data?.misconceptionLevel as MisconceptionLevel | undefined,
      },
    ]);
  };

  const startPaperTeaching = async () => {
    if (!outlineBody) return;
    setTeachingLoading(true);
    setTeachingError(null);
    try {
      const teachingSystemPrompt = `
You are Victor, a Socratic academic coach. The student is working on a paper with the following outline:

${JSON.stringify(outlineBody, null, 2)}

When the student asks about a section, reference the specific section from the outline above by name.
Ask questions that help them think through the content and do not write the section for them.
If they do not understand a concept required by the outline, address that concept directly.
Your goal is understanding, not completion.
`.trim();

      const response = await fetch("/api/academic/teaching/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `${teachingSystemPrompt}

OUTLINE TOPIC: ${outlineMeta?.topic || "Not specified"}
CLASS: ${outlineMeta?.className || "Not specified"}
ASSIGNMENT TYPE: ${outlineMeta?.assignmentType || "Not specified"}
ASSIGNMENT REQUIREMENTS: ${
            outlineMeta?.assignmentRequirements
              ? JSON.stringify(outlineMeta.assignmentRequirements)
              : "Not specified"
          }
STUDENT DECLARATION: ${
            outlineMeta?.studentDeclaration
              ? JSON.stringify(outlineMeta.studentDeclaration)
              : "Not specified"
          }
UNSURE SECTIONS: ${
            outlineMeta?.sectionConfidence
              ? JSON.stringify(
                  Object.entries(outlineMeta.sectionConfidence)
                    .filter(([, value]) => value === "unsure")
                    .map(([sectionId]) => sectionId)
                )
              : "[]"
          }`,
          subject: "writing",
          workspaceContext: "paper",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to start guided paper support.");
      }
      setTeachingSessionId(data.sessionId || null);
      setTeachingSteps(Array.isArray(data.steps) ? data.steps : []);
      setTeachingCurrentStepIndex(0);
    } catch (err) {
      setTeachingError(
        err instanceof Error ? err.message : "Unable to start guided paper support."
      );
    } finally {
      setTeachingLoading(false);
    }
  };

  const handleTeachingAttempt = async (stepNumber: number, attempt: string) => {
    if (!teachingSessionId) return;
    setTeachingLoading(true);
    setTeachingError(null);
    try {
      const response = await fetch("/api/academic/teaching/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: teachingSessionId,
          stepNumber,
          attempt,
          result: "wrong",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to record step attempt.");
      }
      if (Array.isArray(data?.steps)) {
        setTeachingSteps(data.steps);
      }
      if (typeof data?.currentStepIndex === "number") {
        setTeachingCurrentStepIndex(data.currentStepIndex);
      }
      if (data?.struggleDetected && data?.victorHandoffContext) {
        await sendVictorIntervention(data.victorHandoffContext, "Auto intervention");
      }
    } catch (err) {
      setTeachingError(
        err instanceof Error ? err.message : "Unable to record step attempt."
      );
    } finally {
      setTeachingLoading(false);
    }
  };

  const handleTeachingHelp = async (stepNumber: number) => {
    if (!teachingSessionId) return;
    setTeachingLoading(true);
    setTeachingError(null);
    try {
      const response = await fetch("/api/academic/teaching/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: teachingSessionId,
          stepNumber,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to request Victor handoff.");
      }
      if (data?.victorHandoffContext) {
        await sendVictorIntervention(data.victorHandoffContext, "Manual intervention");
      }
    } catch (err) {
      setTeachingError(
        err instanceof Error ? err.message : "Unable to request Victor handoff."
      );
    } finally {
      setTeachingLoading(false);
    }
  };

  return {
    teachingSessionId,
    teachingSteps,
    teachingCurrentStepIndex,
    teachingLoading,
    teachingError,
    setTeachingSteps,
    setTeachingCurrentStepIndex,
    startPaperTeaching,
    handleTeachingAttempt,
    handleTeachingHelp,
    misconceptionLevel,
  };
}
