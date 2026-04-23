"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  AssignmentContext,
  ConversationHistoryEntry,
  IntakeConversationEntry,
  OutlineDraft,
  OutlineDraftSection,
  ParsedRequirements,
} from "@/components/academic/outline/outlineTypes";
import {
  draftToOutlineStructure,
  outlineStructureToDraft,
} from "@/components/academic/outline/outlineTypes";

interface VictorOutlineResponse {
  victorMessage: string;
  updatedDraft: OutlineDraft;
  nextGoal: 1 | 2 | 3 | 4 | 5;
  goalComplete: boolean;
  allGoalsComplete: boolean;
}

interface SectionDevelopmentResponse {
  victorMessage: string;
  updatedKeyPoints?: string[];
  sectionIndex: number;
  developmentComplete: boolean;
}

type IntakePhase =
  | { phase: "goal"; goal: 1 | 2 | 3 | 4 | 5 }
  | { phase: "section_development"; sectionIndex: number };

interface UseVictorOutlineSessionReturn {
  messages: IntakeConversationEntry[];
  isLoading: boolean;
  sendMessage: (studentMessage: string) => Promise<void>;
  generateQuickStructure: () => Promise<void>;
  currentDraft: OutlineDraft;
  currentGoal: 1 | 2 | 3 | 4 | 5;
  allGoalsComplete: boolean;
  savedOutlineId: string | null;
  resetSession: () => void;
}

function createEmptyDraft(): OutlineDraft {
  return {
    thesis: null,
    sections: [],
    conclusion: null,
    sourcesAcknowledged: false,
    requirementGaps: [],
    confidence: "building",
  };
}

function normalizeSections(
  sections: OutlineDraftSection[],
  previousSections: OutlineDraftSection[]
) {
  return sections.map((section, index) => ({
    ...section,
    id: section.id || previousSections[index]?.id || uuidv4(),
  }));
}

function normalizeDraft(nextDraft: OutlineDraft, previousDraft: OutlineDraft): OutlineDraft {
  return {
    ...nextDraft,
    sections: normalizeSections(nextDraft.sections, previousDraft.sections),
  };
}

function buildConversationContext(messages: IntakeConversationEntry[]): {
  summary: string | null;
  recentMessages: IntakeConversationEntry[];
} {
  if (messages.length <= 5) {
    return { summary: null, recentMessages: messages };
  }

  const early = messages.slice(0, messages.length - 5);
  const recentMessages = messages.slice(messages.length - 5);
  const goalLabels: Record<number, string> = {
    1: "thesis",
    2: "supporting points",
    3: "counterargument",
    4: "requirements",
    5: "conclusion",
  };

  const summary = [...new Set(early.map((message) => message.goal))]
    .map((goal) => {
      const last = early
        .filter(
          (message) =>
            message.goal === goal &&
            message.student_response &&
            !message.student_response.startsWith("[")
        )
        .pop();

      return last
        ? `Goal ${goal} (${goalLabels[goal]}): "${last.student_response.slice(0, 80)}"`
        : `Goal ${goal} (${goalLabels[goal]}): completed`;
    })
    .join(". ");

  return { summary, recentMessages };
}

function getRestoreGoal(history: IntakeConversationEntry[]): 1 | 2 | 3 | 4 | 5 {
  const substantiveEntries = history.filter(
    (entry) => entry.student_response && !entry.student_response.startsWith("[")
  );
  if (substantiveEntries.length === 0) {
    return 1;
  }

  const lastGoal = Math.max(...substantiveEntries.map((entry) => entry.goal)) as 1 | 2 | 3 | 4 | 5;
  return Math.min(lastGoal + 1, 5) as 1 | 2 | 3 | 4 | 5;
}

function needsDevelopment(section: OutlineDraftSection): boolean {
  return section.fromGoal === 2;
}

function findNextSectionNeedingDevelopment(
  sections: OutlineDraftSection[],
  startIndex = 0
): number {
  return sections.findIndex(
    (section, index) => index >= startIndex && needsDevelopment(section)
  );
}

function buildGoalOpeningMessage(
  goal: 3 | 4 | 5,
  requirements: ParsedRequirements | null
): string {
  if (goal === 3) {
    return "Good — your sections are taking shape. Last thing before we lock the structure: what is the strongest objection someone could raise against your central argument?";
  }

  if (goal === 4) {
    return requirements
      ? "Now let's check your assignment requirements against the structure you have so far."
      : "Last thing: how does your conclusion connect back to your opening argument? What should the reader walk away believing that they did not believe before reading?";
  }

  return "Last thing: how does your conclusion connect back to your opening argument? What should the reader walk away believing that they did not believe before reading?";
}

function mergeAssignmentRequirements(
  parsedRequirements: ParsedRequirements | null,
  assignmentContext: AssignmentContext | null | undefined
): ParsedRequirements | null {
  const rawRequirements =
    assignmentContext?.requirements as
      | (Record<string, unknown> & {
          minSources?: number;
          min_sources?: number;
          citationFormat?: string;
          citation_style?: string;
          wordCount?: string | number;
          word_count?: string | number;
        })
      | null
      | undefined;
  const minSourcesRaw =
    rawRequirements?.minSources ??
    rawRequirements?.min_sources ??
    undefined;
  const citationFormatRaw =
    rawRequirements?.citationFormat ??
    rawRequirements?.citation_style ??
    undefined;
  const wordCountRaw =
    typeof rawRequirements?.wordCount === "number"
      ? String(rawRequirements.wordCount)
      : typeof rawRequirements?.wordCount === "string"
        ? rawRequirements.wordCount
        : typeof rawRequirements?.word_count === "number"
          ? String(rawRequirements.word_count)
          : typeof rawRequirements?.word_count === "string"
            ? rawRequirements.word_count
            : undefined;

  if (!parsedRequirements && minSourcesRaw == null && !citationFormatRaw && !wordCountRaw) {
    return null;
  }

  return {
    ...(parsedRequirements ?? {}),
    minSources: parsedRequirements?.minSources ?? minSourcesRaw,
    citationFormat: parsedRequirements?.citationFormat ?? citationFormatRaw,
    wordCount: parsedRequirements?.wordCount ?? wordCountRaw,
  };
}

export function useVictorOutlineSession(params: {
  outlineId?: string | null;
  assignmentId: string | null;
  className: string | null;
  assignmentType: string | null;
  requirements: ParsedRequirements | null;
  assignmentContext?: AssignmentContext | null;
  contextLoaded?: boolean;
  topic?: string | null;
  platform?: "mobile" | "desktop";
  isDueSoon?: boolean;
  skipInitialPrompt?: boolean;
}): UseVictorOutlineSessionReturn {
  const { user } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] = useState<IntakeConversationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<OutlineDraft>(createEmptyDraft);
  const [currentPhase, setCurrentPhase] = useState<IntakePhase>({
    phase: "goal",
    goal: 1,
  });
  const [allGoalsComplete, setAllGoalsComplete] = useState(false);
  const [savedOutlineId, setSavedOutlineId] = useState<string | null>(params.outlineId ?? null);
  const initializedRef = useRef(false);
  const assignmentContextRef = useRef<AssignmentContext | null | undefined>(
    params.assignmentContext
  );
  const currentGoal = currentPhase.phase === "goal" ? currentPhase.goal : 2;

  useEffect(() => {
    assignmentContextRef.current = params.assignmentContext;
  }, [params.assignmentContext]);

  const mergedRequirements = useMemo(
    () => mergeAssignmentRequirements(params.requirements, params.assignmentContext),
    [params.assignmentContext, params.requirements]
  );

  const saveProgressAfterGoal = useCallback(
    async (draft: OutlineDraft, history: IntakeConversationEntry[]) => {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from("academic_outlines")
          .upsert({
            ...(savedOutlineId ? { id: savedOutlineId } : {}),
            user_id: user.id,
            assignment_id: params.assignmentId ?? null,
            topic: draft.thesis ?? "Draft in progress",
            class_name: params.className ?? null,
            assignment_type: params.assignmentType ?? null,
            outline_structure: draftToOutlineStructure(draft),
            conversation_history: history,
            status: "draft",
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (data?.id) {
          setSavedOutlineId(data.id);
        }
      } catch {
        console.warn("Victor outline draft save failed silently");
      }
    },
    [
      params.assignmentId,
      params.assignmentType,
      params.className,
      savedOutlineId,
      supabase,
      user?.id,
    ]
  );

  const callVictorOutline = useCallback(
    async (
      studentMessage: string,
      historyOverride?: IntakeConversationEntry[],
      goalOverride?: 1 | 2 | 3 | 4 | 5
    ) => {
      const activeGoal = goalOverride ?? currentGoal;
      const activeMessages = historyOverride ?? messages;
      const { summary, recentMessages } = buildConversationContext(activeMessages);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const response = await fetch("/api/academic/victor-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          conversationHistory: recentMessages,
          conversationSummary: summary,
          currentDraft,
          currentGoal: activeGoal,
          assignmentRequirements: mergeAssignmentRequirements(
            params.requirements,
            assignmentContextRef.current
          ),
          assignmentContext: assignmentContextRef.current ?? null,
          studentMessage,
          className: params.className || undefined,
          assignmentType: params.assignmentType || undefined,
          platform: params.platform ?? "desktop",
          isDueSoon: params.isDueSoon ?? false,
        }),
      });

      try {
        const data = (await response.json()) as VictorOutlineResponse;
        if (!response.ok) {
          throw new Error("Unable to continue Victor outline intake.");
        }
        return { data, activeGoal };
      } finally {
        window.clearTimeout(timeout);
      }
    },
    [
      currentDraft,
      currentGoal,
      messages,
      params.assignmentType,
      params.className,
      params.isDueSoon,
      params.platform,
      params.requirements,
    ]
  );

  const bootstrapVictorOpening = useCallback(() => {
    let active = true;
    setIsLoading(true);
    void fetch("/api/academic/victor-outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationHistory: [],
        currentDraft: createEmptyDraft(),
        currentGoal: 1,
        assignmentRequirements: mergeAssignmentRequirements(
          params.requirements,
          assignmentContextRef.current
        ),
        assignmentContext: assignmentContextRef.current ?? null,
        studentMessage: "",
        className: params.className || undefined,
        assignmentType: params.assignmentType || undefined,
        platform: params.platform ?? "desktop",
        isDueSoon: params.isDueSoon ?? false,
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as VictorOutlineResponse;
        if (!response.ok) {
          throw new Error("Unable to start Victor outline intake.");
        }
        if (!active) return;
        setCurrentDraft((prev) => normalizeDraft(data.updatedDraft, prev));
        setCurrentPhase({ phase: "goal", goal: data.nextGoal });
        setAllGoalsComplete(data.allGoalsComplete);
        setMessages([
          {
            type: "intake",
            goal: 1,
            timestamp: new Date().toISOString(),
            victor_message: data.victorMessage,
            student_response: "",
          },
        ]);
      })
      .catch(() => {
        if (!active) return;
        setMessages([
          {
            type: "intake",
            goal: 1,
            timestamp: new Date().toISOString(),
            victor_message:
              "Before we start building your outline, I want to understand what you are actually trying to say.\n\nWhat is your central argument for this paper? Don't worry about phrasing it perfectly — just tell me what you believe and why it matters.",
            student_response: "",
          },
        ]);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    params.assignmentType,
    params.className,
    params.isDueSoon,
    params.platform,
    params.requirements,
  ]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (params.skipInitialPrompt) return;
    if (params.contextLoaded === false) return;
    if (params.assignmentId && !assignmentContextRef.current) return;

    if (params.outlineId) {
      return bootstrapVictorOpening();
    }

    if (!params.assignmentId || !user?.id) {
      return bootstrapVictorOpening();
    }

    let active = true;
    setIsLoading(true);
    void supabase
      .from("academic_outlines")
      .select("id, outline_structure, conversation_history, status, topic")
      .eq("user_id", user.id)
      .eq("assignment_id", params.assignmentId)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!data?.outline_structure) {
          setIsLoading(false);
          bootstrapVictorOpening();
          return;
        }

        const restoredDraft = outlineStructureToDraft(data.outline_structure);
        const history = (Array.isArray(data.conversation_history)
          ? data.conversation_history
          : []) as ConversationHistoryEntry[];
        const intakeHistory = history.filter(
          (entry): entry is IntakeConversationEntry => entry.type === "intake"
        );
        const restoredMessages: IntakeConversationEntry[] = [
          ...intakeHistory,
          {
            type: "intake" as const,
            goal: 1,
            timestamp: new Date().toISOString(),
            victor_message: `Welcome back — we were working on your outline for "${data.topic ?? "your paper"}". Here is where we left off. You can continue from here or edit the sections directly in the panel.`,
            student_response: "[session restored]",
          },
        ];

        setCurrentDraft({ ...restoredDraft, confidence: "draft" });
        setSavedOutlineId(data.id);
        setMessages(restoredMessages);
        setCurrentPhase({ phase: "goal", goal: getRestoreGoal(intakeHistory) });
        setAllGoalsComplete(false);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
        bootstrapVictorOpening();
      });

    return () => {
      active = false;
    };
  }, [
    bootstrapVictorOpening,
    params.assignmentId,
    params.contextLoaded,
    params.outlineId,
    params.skipInitialPrompt,
    supabase,
    user?.id,
  ]);

  useEffect(() => {
    if (!initializedRef.current || params.skipInitialPrompt) return;
    if (params.contextLoaded !== true) return;
    if (messages.length > 0) return;
    if (params.assignmentId && !assignmentContextRef.current) return;

    initializedRef.current = true;
    return bootstrapVictorOpening();
  }, [
    bootstrapVictorOpening,
    messages.length,
    params.assignmentContext,
    params.assignmentId,
    params.contextLoaded,
    params.skipInitialPrompt,
  ]);

  const triggerSectionDevelopmentQuestion = useCallback(
    async (
      sectionIndex: number,
      draftOverride: OutlineDraft,
      historyOverride: IntakeConversationEntry[]
    ) => {
      const response = await fetch("/api/academic/victor-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "section_development",
          sectionIndex,
          sections: draftOverride.sections,
          thesis: draftOverride.thesis,
          studentResponse: null,
          assignmentContext: assignmentContextRef.current ?? null,
          conversationSummary: buildConversationContext(historyOverride).summary,
          conversationHistory: [],
          currentDraft: draftOverride,
          currentGoal: 2,
          assignmentRequirements: mergeAssignmentRequirements(
            params.requirements,
            assignmentContextRef.current
          ),
          studentMessage: "",
        }),
      });

      const data = (await response.json()) as SectionDevelopmentResponse;
      if (!response.ok) {
        throw new Error("Unable to start section development.");
      }

      setMessages([
        ...historyOverride,
        {
          type: "intake" as const,
          goal: 2,
          timestamp: new Date().toISOString(),
          victor_message: data.victorMessage,
          student_response: "",
        },
      ]);
    },
    [params.requirements]
  );

  const triggerGoalOpening = useCallback(
    async (
      goal: 3 | 4 | 5,
      draftOverride: OutlineDraft,
      historyOverride: IntakeConversationEntry[]
    ) => {
      setMessages([
        ...historyOverride,
        {
          type: "intake" as const,
          goal,
          timestamp: new Date().toISOString(),
          victor_message: buildGoalOpeningMessage(goal, mergedRequirements),
          student_response: "",
        },
      ]);
      setCurrentPhase({ phase: "goal", goal });
      setCurrentDraft(draftOverride);
    },
    [mergedRequirements]
  );

  const triggerFinalAssessment = useCallback(
    async (draft: OutlineDraft, history: IntakeConversationEntry[]) => {
      try {
        const response = await fetch("/api/academic/victor-outline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "final_assessment",
            draft,
            thesis: draft.thesis,
            assignmentContext: assignmentContextRef.current ?? null,
            conversationHistory: history,
            currentDraft: draft,
            currentGoal: 5,
            assignmentRequirements: mergeAssignmentRequirements(
              params.requirements,
              assignmentContextRef.current
            ),
            studentMessage: "",
            platform: params.platform ?? "desktop",
          }),
        });

        const data = (await response.json()) as { victorMessage?: string };
        if (!response.ok || !data?.victorMessage) {
          throw new Error("Unable to generate final assessment.");
        }

        setMessages((prev) => [
          ...prev,
          {
            type: "intake" as const,
            goal: 5,
            timestamp: new Date().toISOString(),
            victor_message: data.victorMessage,
            student_response: "[final assessment]",
          },
        ]);
      } catch {
        // Assessment should never block approval.
      }
    },
    [params.platform, params.requirements]
  );

  const sendMessage = useCallback(
    async (studentMessage: string) => {
      const trimmed = studentMessage.trim();
      if (!trimmed) return;
      setIsLoading(true);
      try {
        if (currentPhase.phase === "section_development") {
          const activeSectionIndex = currentPhase.sectionIndex;
          const response = await fetch("/api/academic/victor-outline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "section_development",
              sectionIndex: activeSectionIndex,
              sections: currentDraft.sections,
              thesis: currentDraft.thesis,
              studentResponse: trimmed,
              assignmentContext: assignmentContextRef.current ?? null,
              conversationSummary: buildConversationContext(messages).summary,
              conversationHistory: [],
              currentDraft,
              currentGoal: 2,
              assignmentRequirements: mergeAssignmentRequirements(
                params.requirements,
                assignmentContextRef.current
              ),
              studentMessage: "",
            }),
          });

          const data = (await response.json()) as SectionDevelopmentResponse;
          if (!response.ok) {
            throw new Error("Unable to continue section development.");
          }

          const timestamp = new Date().toISOString();
          const nextDraft =
            data.developmentComplete && data.updatedKeyPoints && data.updatedKeyPoints.length > 0
              ? {
                  ...currentDraft,
                  sections: currentDraft.sections.map((section, index) =>
                    index === activeSectionIndex
                      ? { ...section, keyPoints: data.updatedKeyPoints ?? [] }
                      : section
                  ),
                }
              : currentDraft;
          const nextMessages: IntakeConversationEntry[] = [
            ...messages,
            {
              type: "intake" as const,
              goal: 2,
              timestamp,
              victor_message: data.victorMessage,
              student_response: trimmed,
            },
          ];

          setCurrentDraft(nextDraft);
          setMessages(nextMessages);
          void saveProgressAfterGoal(nextDraft, nextMessages);

          const nextIndex = findNextSectionNeedingDevelopment(
            nextDraft.sections,
            activeSectionIndex + 1
          );

          if (nextIndex >= 0) {
            setCurrentPhase({ phase: "section_development", sectionIndex: nextIndex });
            await triggerSectionDevelopmentQuestion(nextIndex, nextDraft, nextMessages);
          } else {
            await triggerGoalOpening(3, nextDraft, nextMessages);
          }

          return;
        }

        const timestamp = new Date().toISOString();
        const { data, activeGoal } = await callVictorOutline(trimmed);
        const nextDraft = normalizeDraft(data.updatedDraft, currentDraft);
        const nextMessages: IntakeConversationEntry[] = [
          ...messages,
          {
            type: "intake" as const,
            goal: activeGoal,
            timestamp,
            victor_message: data.victorMessage,
            student_response: trimmed,
          },
        ];

        setCurrentDraft(nextDraft);
        setAllGoalsComplete(data.allGoalsComplete);

        if (activeGoal === 2 && data.goalComplete && !data.allGoalsComplete) {
          const firstDevelopmentIndex = findNextSectionNeedingDevelopment(nextDraft.sections);
          if (firstDevelopmentIndex >= 0) {
            setCurrentPhase({
              phase: "section_development",
              sectionIndex: firstDevelopmentIndex,
            });
            setMessages(nextMessages);
            void saveProgressAfterGoal(nextDraft, nextMessages);
            await triggerSectionDevelopmentQuestion(
              firstDevelopmentIndex,
              nextDraft,
              nextMessages
            );
            return;
          }
        }

        setCurrentPhase({ phase: "goal", goal: data.nextGoal });
        setMessages(nextMessages);

        if (data.goalComplete) {
          void saveProgressAfterGoal(nextDraft, nextMessages);
        }
        if (data.allGoalsComplete) {
          void saveProgressAfterGoal(nextDraft, nextMessages);
          await triggerFinalAssessment(nextDraft, nextMessages);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            type: "intake",
            goal: currentGoal,
            timestamp: new Date().toISOString(),
            victor_message:
              "I lost the thread for a second. Send that one more time and I will keep building the outline from where we left off.",
            student_response: trimmed,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      callVictorOutline,
      currentDraft,
      currentGoal,
      currentPhase,
      messages,
      params.requirements,
      saveProgressAfterGoal,
      triggerGoalOpening,
      triggerFinalAssessment,
      triggerSectionDevelopmentQuestion,
    ]
  );

  const generateQuickStructure = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/academic/victor-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "quick_structure",
          assignmentContext: assignmentContextRef.current ?? {
            assignment_name: params.topic ?? null,
            class_name: params.className,
            assignment_type: params.assignmentType,
            due_date: null,
            requirements: mergedRequirements,
            notes: null,
            word_count: null,
          },
          conversationHistory: [],
          currentDraft: createEmptyDraft(),
          currentGoal: 1,
          studentMessage: "",
          assignmentRequirements: mergeAssignmentRequirements(
            params.requirements,
            assignmentContextRef.current
          ),
          className: params.className || undefined,
          assignmentType: params.assignmentType || undefined,
        }),
      });

      const data = (await response.json()) as VictorOutlineResponse;
      if (!response.ok) {
        throw new Error("Unable to generate a quick structure.");
      }

      const timestamp = new Date().toISOString();
      const nextDraft = normalizeDraft(data.updatedDraft, currentDraft);
      const nextMessages: IntakeConversationEntry[] = [
        ...messages,
        {
          type: "intake" as const,
          goal: 1,
          timestamp,
          victor_message: data.victorMessage,
          student_response: "[quick structure selected]",
        },
      ];

      setCurrentDraft(nextDraft);
      setMessages(nextMessages);
      setCurrentPhase({ phase: "goal", goal: 5 });
      setAllGoalsComplete(true);
      void saveProgressAfterGoal(nextDraft, nextMessages);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          type: "intake",
          goal: currentGoal,
          timestamp: new Date().toISOString(),
          victor_message:
            "I could not build the quick structure right now. We can keep going through the full outline conversation instead.",
          student_response: "[quick structure selected]",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentDraft,
    currentGoal,
    messages,
    params.assignmentType,
    params.className,
    mergedRequirements,
    params.requirements,
    params.topic,
    saveProgressAfterGoal,
  ]);

  const resetSession = useCallback(() => {
    initializedRef.current = false;
    setMessages([]);
    setCurrentDraft(createEmptyDraft());
    setCurrentPhase({ phase: "goal", goal: 1 });
    setAllGoalsComplete(false);
    setSavedOutlineId(params.outlineId ?? null);
  }, [params.outlineId]);

  return {
    messages,
    isLoading,
    sendMessage,
    generateQuickStructure,
    currentDraft,
    currentGoal,
    allGoalsComplete,
    savedOutlineId,
    resetSession,
  };
}
