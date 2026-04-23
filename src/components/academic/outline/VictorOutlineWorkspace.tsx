"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AcademicErrorState from "@/components/academic/shared/AcademicErrorState";
import AcademicLoadingState from "@/components/academic/shared/AcademicLoadingState";
import VictorChatContainer from "@/components/academic/victor-chat/VictorChatContainer";
import type { VictorMessage } from "@/components/academic/victor-chat/VictorChatContext";
import { useVictorOutlineSession } from "@/hooks/academic/useVictorOutlineSession";
import { MobileTabBar, type MobileTab } from "./MobileTabBar";
import OutlineEditor from "./OutlineEditor";
import {
  draftToOutlineStructure,
  outlineStructureToDraft,
  type AssignmentContext,
  type ConversationHistoryEntry,
  type IntakeConversationEntry,
  type OutlineDraft,
  type OutlineStructure,
  type ParsedRequirements,
} from "./outlineTypes";

interface VictorOutlineWorkspaceProps {
  outlineId?: string | null;
  assignmentId?: string | null;
  onOutlineSaved?: () => void;
  onContinue: (outlineId: string) => void;
  className?: string | null;
  assignmentType?: string | null;
}

interface VictorOutlineWorkspaceInnerProps extends VictorOutlineWorkspaceProps {
  assignmentContext: AssignmentContext | null;
  requirements: ParsedRequirements | null;
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

function parseRequirements(
  requirements: Record<string, unknown> | null,
  dueDate?: string | null,
  assignmentType?: string | null
): ParsedRequirements | null {
  if (!requirements && !dueDate && !assignmentType) return null;
  return {
    assignmentType:
      assignmentType ||
      (typeof requirements?.assignment_type === "string"
        ? requirements.assignment_type
        : typeof requirements?.assignmentType === "string"
          ? requirements.assignmentType
        : undefined),
    requiredSections: Array.isArray(requirements?.required_sections)
      ? requirements.required_sections.map((item) => String(item))
      : Array.isArray(requirements?.requiredSections)
        ? requirements.requiredSections.map((item) => String(item))
      : undefined,
    requiredTopics: Array.isArray(requirements?.required_topics)
      ? requirements.required_topics.map((item) => String(item))
      : Array.isArray(requirements?.topics_to_cover)
        ? requirements.topics_to_cover.map((item) => String(item))
        : Array.isArray(requirements?.requiredTopics)
          ? requirements.requiredTopics.map((item) => String(item))
        : undefined,
    minSources:
      typeof requirements?.min_sources === "number"
        ? requirements.min_sources
        : typeof requirements?.minSources === "number"
          ? requirements.minSources
        : undefined,
    citationFormat:
      typeof requirements?.citation_style === "string"
        ? requirements.citation_style
        : typeof requirements?.citationFormat === "string"
          ? requirements.citationFormat
        : undefined,
    dueDate: dueDate || undefined,
    wordCount:
      typeof requirements?.word_count === "number"
        ? String(requirements.word_count)
        : typeof requirements?.word_count === "string"
          ? requirements.word_count
          : typeof requirements?.wordCount === "number"
            ? String(requirements.wordCount)
            : typeof requirements?.wordCount === "string"
              ? requirements.wordCount
          : undefined,
    minSections:
      typeof requirements?.min_sections === "number"
        ? requirements.min_sections
        : typeof requirements?.minSections === "number"
          ? requirements.minSections
        : undefined,
  };
}

function intakeEntriesToVictorMessages(entries: IntakeConversationEntry[]): VictorMessage[] {
  const messages: VictorMessage[] = [];
  entries.forEach((entry) => {
    if (entry.student_response.trim()) {
      messages.push({
        role: "user",
        content: entry.student_response,
        timestamp: entry.timestamp,
        responseType: "conversation",
      });
    }
    messages.push({
      role: "assistant",
      content: entry.victor_message,
      timestamp: entry.timestamp,
      responseType: "conversation",
    });
  });
  return messages;
}

function historyToVictorMessages(entries: ConversationHistoryEntry[]): VictorMessage[] {
  const messages: VictorMessage[] = [];
  entries.forEach((entry) => {
    if (entry.type === "intake") {
      if (entry.student_response.trim()) {
        messages.push({
          role: "user",
          content: entry.student_response,
          timestamp: entry.timestamp,
          responseType: "conversation",
        });
      }
      messages.push({
        role: "assistant",
        content: entry.victor_message,
        timestamp: entry.timestamp,
        responseType: "conversation",
      });
      return;
    }

    messages.push({
      role: "user",
      content: entry.student_explanation,
      timestamp: entry.timestamp,
      responseType: "conversation",
    });
    messages.push({
      role: "assistant",
      content: entry.victor_response,
      timestamp: entry.timestamp,
      responseType: "conversation",
    });
  });
  return messages;
}

function VictorOutlineWorkspaceInner({
  outlineId,
  assignmentId,
  onOutlineSaved,
  onContinue,
  className,
  assignmentType,
  assignmentContext,
  requirements,
}: VictorOutlineWorkspaceInnerProps) {
  const { user } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [draft, setDraft] = useState<OutlineDraft>(createEmptyDraft);
  const [resolvedClassName, setResolvedClassName] = useState<string | null>(className ?? null);
  const [resolvedAssignmentType, setResolvedAssignmentType] = useState<string | null>(
    assignmentType ?? null
  );
  const [studentIsEditing, setStudentIsEditing] = useState(false);
  const [restorationMode, setRestorationMode] = useState(Boolean(outlineId));
  const [restoredMessages, setRestoredMessages] = useState<VictorMessage[]>([]);
  const [restoredConversationHistory, setRestoredConversationHistory] = useState<
    ConversationHistoryEntry[]
  >([]);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("victor");
  const [outlineHasUpdate, setOutlineHasUpdate] = useState(false);
  const [paperHasUpdate, setPaperHasUpdate] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(Boolean(outlineId));
  const [error, setError] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const previousDraftRef = useRef<OutlineDraft | null>(null);
  const isDueSoon = (assignmentContext?.requirements ?? requirements)?.dueDate
    ? Math.ceil(
        (new Date((assignmentContext?.requirements ?? requirements)?.dueDate as string).getTime() -
          Date.now()) /
          (1000 * 60 * 60 * 24)
      ) <= 1
    : false;

  const victorSession = useVictorOutlineSession({
    outlineId: outlineId ?? null,
    assignmentId: assignmentId ?? null,
    className: assignmentContext?.class_name ?? resolvedClassName,
    assignmentType: assignmentContext?.assignment_type ?? resolvedAssignmentType,
    requirements: assignmentContext?.requirements ?? requirements,
    assignmentContext,
    contextLoaded: true,
    topic: draft.thesis ?? null,
    platform: isMobile ? "mobile" : "desktop",
    isDueSoon,
    skipInitialPrompt: restorationMode,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    setResolvedClassName((prev) => prev || assignmentContext?.class_name || null);
    setResolvedAssignmentType((prev) => prev || assignmentContext?.assignment_type || null);
  }, [assignmentContext]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void supabase
      .from("voice_chambers")
      .select("confidence_level")
      .eq("user_id", user.id)
      .eq("chamber", "academic")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setVoiceAvailable(Number(data?.confidence_level || 0) >= 30);
      });
    return () => {
      active = false;
    };
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!outlineId) {
      setRestorationMode(false);
      setLoadingRestore(false);
      return;
    }

    let active = true;
    setLoadingRestore(true);
    void fetch(`/api/academic/outline/${outlineId}`)
      .then((response) => response.json())
      .then((data) => {
        if (!active || !data?.outline?.outline_structure) return;
        const structure = data.outline.outline_structure as OutlineStructure;
        setDraft({ ...outlineStructureToDraft(structure), confidence: "complete" });
        setResolvedClassName((prev) => prev || data.outline.class_name || null);
        setResolvedAssignmentType((prev) => prev || data.outline.assignment_type || null);
        if (Array.isArray(data.outline.conversation_history)) {
          setRestoredConversationHistory(
            data.outline.conversation_history as ConversationHistoryEntry[]
          );
          setRestoredMessages(
            historyToVictorMessages(data.outline.conversation_history as ConversationHistoryEntry[])
          );
        }
        setRestorationMode(true);
      })
      .catch(() => {
        if (!active) return;
        setError("Could not load your existing outline. Refresh the page to continue.");
      })
      .finally(() => {
        if (active) {
          setLoadingRestore(false);
        }
      });

    return () => {
      active = false;
    };
  }, [outlineId]);

  useEffect(() => {
    if (restorationMode) return;
    if (studentIsEditing) {
      return;
    }
    setDraft(victorSession.currentDraft);
  }, [restorationMode, studentIsEditing, victorSession.currentDraft]);

  useEffect(() => {
    const previousDraft = previousDraftRef.current;
    const currentVictorDraft = victorSession.currentDraft;

    if (
      previousDraft !== null &&
      previousDraft !== currentVictorDraft &&
      activeMobileTab !== "outline"
    ) {
      setOutlineHasUpdate(true);
    }

    previousDraftRef.current = currentVictorDraft;
  }, [activeMobileTab, victorSession.currentDraft]);

  const approvalMode = restorationMode || victorSession.allGoalsComplete;
  const workspaceClass = approvalMode
    ? "victor-outline-workspace--approval"
    : "victor-outline-workspace--intake";
  const hasPaperContent = false;
  const controlledVictorMessages = useMemo(
    () => intakeEntriesToVictorMessages(victorSession.messages),
    [victorSession.messages]
  );

  function handleTabChange(tab: MobileTab) {
    setActiveMobileTab(tab);
    if (tab === "outline") setOutlineHasUpdate(false);
    if (tab === "paper") setPaperHasUpdate(false);
  }

  const handleApprove = async (approvedStructure: OutlineStructure) => {
    if (!user?.id) {
      setError("Could not save your outline. Please try again.");
      return;
    }

    const { data, error: saveError } = await supabase
      .from("academic_outlines")
      .upsert({
        ...(victorSession.savedOutlineId ? { id: victorSession.savedOutlineId } : {}),
        user_id: user.id,
        assignment_id: assignmentId ?? null,
        topic: draft.thesis,
        class_name: resolvedClassName ?? null,
        assignment_type: resolvedAssignmentType ?? null,
        outline_structure: approvedStructure,
        conversation_history: restorationMode
          ? restoredConversationHistory
          : victorSession.messages,
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (saveError || !data?.id) {
      setError("Could not save your outline. Please try again.");
      return;
    }

    onOutlineSaved?.();
    onContinue(data.id);
  };

  if (loadingRestore) {
    return (
      <div className="flex min-h-[640px] items-center justify-center rounded-3xl border border-white/10 bg-slate-950/50 p-6">
        <AcademicLoadingState message="Loading your outline..." />
      </div>
    );
  }

  return (
    <div className={`victor-outline-workspace grid gap-4 ${workspaceClass}`}>
      <section
        className={`victor-chat-panel min-w-0 ${
          activeMobileTab === "victor" ? "mobile-active" : ""
        }`}
      >
        {restorationMode ? (
          <VictorChatContainer
            variant="sidebar"
            workspaceContext="Paper outline refinement"
            assignmentId={assignmentId}
            showKnowledgeLink={Boolean(user?.id)}
            knowledgePanelUserId={user?.id ?? null}
            victorContext={{
              className: resolvedClassName || "",
              assignmentName: draft.thesis || "Current paper",
              paperType: resolvedAssignmentType,
            }}
          />
        ) : (
          <>
            <VictorChatContainer
              variant="sidebar"
              workspaceContext={
                isDueSoon ? "Paper outline intake · quick structure available" : "Paper outline intake"
              }
              assignmentId={assignmentId}
              minimalChrome
              showKnowledgeLink={Boolean(user?.id)}
              knowledgePanelUserId={user?.id ?? null}
              controlledSession={{
                messages: controlledVictorMessages,
                loading: victorSession.isLoading,
                onSendMessage: victorSession.sendMessage,
              }}
            />
            {!victorSession.allGoalsComplete ? (
              <div className="mt-3 px-2">
                <button
                  type="button"
                  className="text-xs text-sky-200 underline-offset-4 transition hover:text-sky-100 hover:underline"
                  onClick={() => void victorSession.generateQuickStructure()}
                >
                  Switch to quick structure
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section
        className={`outline-editor-panel min-w-0 ${
          activeMobileTab === "outline" ? "mobile-active" : ""
        }`}
      >
        {error ? (
          <AcademicErrorState message={error} className="!min-h-0 py-3" />
        ) : null}
        <OutlineEditor
          draft={draft}
          requirements={requirements}
          voiceAvailable={voiceAvailable}
          onUpdate={setDraft}
          onApprove={handleApprove}
          onEditStart={() => setStudentIsEditing(true)}
          onEditEnd={() => setStudentIsEditing(false)}
        />
      </section>

      <MobileTabBar
        activeTab={activeMobileTab}
        onTabChange={handleTabChange}
        outlineHasUpdate={outlineHasUpdate}
        paperHasUpdate={paperHasUpdate}
        showPaperTab={hasPaperContent}
      />

      <style jsx>{`
        .mobile-tab-bar {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 56px;
          background: rgba(15, 23, 42, 0.98);
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          z-index: 50;
        }

        .victor-outline-workspace {
          grid-template-columns: minmax(0, 1fr);
        }

        @media (min-width: 768px) {
          .mobile-tab-bar {
            display: none;
          }

          .victor-outline-workspace--intake {
            display: flex;
            flex-direction: row;
            height: 100%;
          }

          .victor-outline-workspace--approval {
            display: flex;
            flex-direction: row;
            height: 100%;
          }

          .victor-outline-workspace--intake .victor-chat-panel {
            flex: 0 0 40%;
            width: 40%;
            min-width: 0;
          }

          .victor-outline-workspace--intake .outline-editor-panel {
            flex: 1 1 60%;
            width: 60%;
            min-width: 0;
          }

          .victor-outline-workspace--approval .victor-chat-panel {
            flex: 0 0 40%;
            width: 40%;
            min-width: 0;
          }

          .victor-outline-workspace--approval .outline-editor-panel {
            flex: 1 1 60%;
            width: 60%;
            min-width: 0;
          }

          .victor-chat-panel,
          .outline-editor-panel {
            transition: width 300ms ease-in-out;
            overflow-y: auto;
            min-width: 0;
          }
        }

        @media (max-width: 767px) {
          .victor-outline-workspace {
            display: block;
            height: 100%;
            padding-bottom: 56px;
          }

          .victor-chat-panel,
          .outline-editor-panel {
            display: none;
            height: 100%;
            overflow-y: auto;
          }

          .victor-chat-panel.mobile-active,
          .outline-editor-panel.mobile-active {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}

export default function VictorOutlineWorkspace({
  outlineId,
  assignmentId,
  onOutlineSaved,
  onContinue,
  className,
  assignmentType,
}: VictorOutlineWorkspaceProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [assignmentContext, setAssignmentContext] = useState<AssignmentContext | null>(null);
  const [requirements, setRequirements] = useState<ParsedRequirements | null>(null);
  const [contextLoaded, setContextLoaded] = useState(false);

  useEffect(() => {
    if (!assignmentId) {
      setAssignmentContext(null);
      setRequirements(null);
      setContextLoaded(true);
      return;
    }

    let active = true;
    setContextLoaded(false);
    void supabase
      .from("assignments")
      .select("assignment_name, class_name, assignment_type, due_date, requirements, notes")
      .eq("id", assignmentId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const assignment = data
          ? ({
              assignment_name: data.assignment_name ?? null,
              class_name: data.class_name ?? null,
              assignment_type: data.assignment_type ?? null,
              due_date: data.due_date ?? null,
              requirements: parseRequirements(
                (data.requirements as Record<string, unknown> | null) || null,
                data.due_date ?? null,
                data.assignment_type ?? null
              ),
              notes: data.notes ?? null,
              word_count: null,
            } satisfies AssignmentContext)
          : null;

        setAssignmentContext(assignment);
        setRequirements(assignment?.requirements ?? null);
        setContextLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setAssignmentContext(null);
        setRequirements(null);
        setContextLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [assignmentId, supabase]);

  if (!contextLoaded) {
    return <AcademicLoadingState message="Loading your assignment..." />;
  }

  if (assignmentId && !assignmentContext) {
    return <AcademicLoadingState message="Loading your assignment..." />;
  }

  return (
    <VictorOutlineWorkspaceInner
      outlineId={outlineId}
      assignmentId={assignmentId}
      onOutlineSaved={onOutlineSaved}
      onContinue={onContinue}
      className={className}
      assignmentType={assignmentType}
      assignmentContext={assignmentContext}
      requirements={requirements}
    />
  );
}
