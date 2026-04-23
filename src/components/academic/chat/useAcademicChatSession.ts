"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AssignmentRow } from "@/types/academic";
import { useAcademicShellState } from "@/components/academic/shell/AcademicShellStateContext";
import { useTravisChat } from "../travis-sidebar/hooks/useTravisChat";
import { useAssignmentCapture } from "./useAssignmentCapture";
import { useFirstTimeAcademicUser } from "./useFirstTimeAcademicUser";
import type {
  AcademicSettings,
  AcademicChatMessage,
  AcademicChatUploadContext,
  AcademicIntentResult,
  AcademicWorkspaceContext,
} from "./chatTypes";
import type { StudioKey } from "@/components/academic/workspace/studioRegistry";

type InProgressPaper = {
  id: string;
  topic: string | null;
  class_name: string | null;
  updated_at: string | null;
  outline_id: string | null;
  assignment_id: string | null;
};

function getDaysUntil(dueDate: string | null | undefined) {
  if (!dueDate) return Number.POSITIVE_INFINITY;
  const due = new Date(`${dueDate}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function buildReturnMessage(assignments: AssignmentRow[]) {
  const inProgressAssignments = assignments
    .filter((assignment) => assignment.status === "in_progress")
    .sort((a, b) => {
      const aTime = new Date(a.updated_at || 0).getTime();
      const bTime = new Date(b.updated_at || 0).getTime();
      return bTime - aTime;
    });

  if (inProgressAssignments.length > 0) {
    return `Welcome back. You were working on ${inProgressAssignments[0].assignment_name}. Want to continue?`;
  }

  const upcomingDue = assignments
    .filter(
      (assignment) =>
        !assignment.completed &&
        assignment.due_date &&
        assignment.status !== "completed"
    )
    .sort((a, b) => {
      const aTime = new Date(`${a.due_date}T00:00:00`).getTime();
      const bTime = new Date(`${b.due_date}T00:00:00`).getTime();
      return aTime - bTime;
    });

  if (upcomingDue.length > 0) {
    const next = upcomingDue[0];
    const days = getDaysUntil(next.due_date);
    if (days === 0) return `${next.assignment_name} is due today. Let's work on it.`;
    if (days === 1) return `${next.assignment_name} is due tomorrow.`;
    return `${next.assignment_name} is coming up in ${days} days.`;
  }

  return "What are you working on today?";
}

function toMessage(
  role: AcademicChatMessage["role"],
  text: string
): AcademicChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    timestamp: new Date().toISOString(),
  };
}

function getCaptureConfirmation(assignmentName: string, dueDate?: string | null) {
  if (dueDate) {
    return `Got it. I've added ${assignmentName} to your assignments. Due ${dueDate}.`;
  }
  return `Got it. I've added ${assignmentName} to your assignments.`;
}

function getTravisConfirmationMessage(intent: AcademicIntentResult): string {
  const studioLabel: Record<string, string> = {
    paper: "research paper",
    math: "math assignment",
    study: "study material",
    agenda: "assignment",
    code_review: "coding assignment",
    unclear: "assignment",
  };

  const { extractedData, studio } = intent;
  const parts = [
    extractedData.assignmentName ?? extractedData.topic,
    extractedData.className ? `for ${extractedData.className}` : null,
    extractedData.dueDate ? `due ${extractedData.dueDate}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `Looks like a ${studioLabel[studio] ?? "assignment"}${parts ? ` — ${parts}` : ""}. Is that right?`;
}

function getTravisPreWorkspaceMessage(intent: AcademicIntentResult): string {
  switch (intent.studio) {
    case "paper":
      return "Got it. Victor is going to help you build your outline.";
    case "math":
      return "Got it. Victor will work through this with you.";
    case "study":
      return "Got it. Upload your notes and we will generate study materials.";
    case "agenda":
      return "Got it. I've added that to your assignments.";
    case "code_review":
      return "Got it. Let's review your code.";
    default:
      return "Got it. Opening your workspace now.";
  }
}

function checkIsAffirmative(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return (
    lower.startsWith("yes") ||
    lower.startsWith("yeah") ||
    lower.startsWith("yep") ||
    lower.startsWith("correct") ||
    lower.startsWith("right") ||
    lower === "y"
  );
}

async function extractDocumentText(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "unknown");

  const response = await fetch("/api/career-studio/document-analysis", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        extractedText?: string;
      }
    | null;

  if (!response.ok || !data?.success || typeof data.extractedText !== "string") {
    return "";
  }

  return data.extractedText.trim();
}

function extractCorrection(
  message: string,
  current: AssignmentRow | null
): Partial<
  Pick<AssignmentRow, "due_date" | "assignment_name" | "class_name" | "assignment_type">
> | null {
  if (!current) return null;
  const lower = message.toLowerCase();
  if (!lower.includes("actually")) return null;

  const updates: Partial<
    Pick<AssignmentRow, "due_date" | "assignment_name" | "class_name" | "assignment_type">
  > = {};

  const dueMatch = message.match(
    /\bdue\s+((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:\d{4}-\d{2}-\d{2}))/i
  );
  if (dueMatch) updates.due_date = dueMatch[1];

  const classMatch = message.match(/\bfor\s+([A-Z]{2,}\s?\d{1,3}[A-Z]?)/);
  if (classMatch) updates.class_name = classMatch[1];

  return Object.keys(updates).length > 0 ? updates : null;
}

async function getMostRecentWorkspace(userId: string): Promise<AcademicWorkspaceContext> {
  const supabase = createSupabaseBrowserClient();
  const [papers, outlines, materials] = await Promise.all([
    supabase
      .from("academic_papers")
      .select("id, assignment_id, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("academic_outlines")
      .select("updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("study_materials")
      .select("updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1),
  ]);

  const latest = [
    {
      studio: "paper" as const,
      paperId: papers.data?.[0]?.id || null,
      assignmentId: papers.data?.[0]?.assignment_id || null,
      updatedAt: papers.data?.[0]?.updated_at || null,
    },
    {
      studio: "paper" as const,
      paperId: null,
      assignmentId: null,
      updatedAt: outlines.data?.[0]?.updated_at || null,
    },
    {
      studio: "study" as const,
      paperId: null,
      assignmentId: null,
      updatedAt: materials.data?.[0]?.updated_at || null,
    },
  ]
    .filter((item) => item.updatedAt)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || 0).getTime() -
        new Date(a.updatedAt || 0).getTime()
    )[0];

  if (!latest) {
    return { type: "dashboard" };
  }

  return {
    type: "studio",
    studio: latest.studio,
    assignmentId: latest.assignmentId,
    paperId: latest.paperId,
  };
}

async function getRestorationWorkspace(userId: string): Promise<AcademicWorkspaceContext | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("academic_papers")
    .select("id, assignment_id, updated_at")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  const inProgressPaper = data?.[0];
  if (!inProgressPaper) return null;

  return {
    type: "studio",
    studio: "paper",
    assignmentId: inProgressPaper.assignment_id ?? null,
    paperId: inProgressPaper.id ?? null,
  };
}

async function getInProgressPapers(userId: string): Promise<InProgressPaper[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("academic_papers")
    .select("id, topic, updated_at, outline_id, assignment_id")
    .eq("user_id", userId)
    .is("completed_at", null)
    .eq("is_complete", false)
    .order("updated_at", { ascending: false })
    .limit(5);

  return Array.isArray(data) ? (data as InProgressPaper[]) : [];
}

function resolvePaperSelection(
  message: string,
  options: InProgressPaper[]
): InProgressPaper | null {
  const trimmed = message.trim().toLowerCase();
  const num = Number.parseInt(trimmed, 10);

  if (!Number.isNaN(num) && num >= 1 && num <= options.length) {
    return options[num - 1];
  }

  return (
    options.find(
      (paper) =>
        paper.topic?.toLowerCase().includes(trimmed) ||
        paper.class_name?.toLowerCase().includes(trimmed)
    ) ?? null
  );
}

export function useAcademicChatSession(
  userId: string | null | undefined,
  settings: AcademicSettings
) {
  const { setShellState } = useAcademicShellState();
  const [workspace, setWorkspace] = useState<AcademicWorkspaceContext>({ type: "idle" });
  const [entryMessages, setEntryMessages] = useState<AcademicChatMessage[]>([]);
  const [entryLoading, setEntryLoading] = useState(false);
  const [clarifyingAsked, setClarifyingAsked] = useState(false);
  const [entryInitialized, setEntryInitialized] = useState(false);
  const [directEntryResolved, setDirectEntryResolved] = useState(false);
  const [restorationResolved, setRestorationResolved] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<AcademicIntentResult | null>(null);
  const [pendingOriginalMessage, setPendingOriginalMessage] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [correctionRound, setCorrectionRound] = useState(0);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [awaitingPaperSelection, setAwaitingPaperSelection] = useState(false);
  const [paperSelectionOptions, setPaperSelectionOptions] = useState<InProgressPaper[]>([]);
  const [lastCapturedAssignment, setLastCapturedAssignment] = useState<AssignmentRow | null>(
    null
  );
  const [activeAssistant, setActiveAssistant] = useState<"travis" | "victor">("travis");
  const [uploadContext, setUploadContext] = useState<AcademicChatUploadContext | null>(null);
  const firstTime = useFirstTimeAcademicUser(userId);
  const assignmentCapture = useAssignmentCapture(userId);
  const travisChat = useTravisChat({ agendaItems: assignments });

  const loadAssignments = useCallback(async () => {
    if (!userId) {
      setAssignments([]);
      return;
    }

    const response = await fetch("/api/travis/assignments/all?status=active", {
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    setAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
  }, [userId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (
      !userId ||
      firstTime.loading ||
      entryInitialized ||
      settings.sessionEntryPreference === "direct" ||
      restorationResolved
    ) {
      return;
    }

    let active = true;
    void getInProgressPapers(userId).then(async (inProgressPapers) => {
      if (!active) return;
      if (inProgressPapers.length > 1) {
        const list = inProgressPapers
          .map(
            (paper, index) =>
              `${index + 1}. ${paper.topic ?? "Untitled paper"}${
                paper.class_name ? ` — ${paper.class_name}` : ""
              }`
          )
          .join("\n");

        setAwaitingPaperSelection(true);
        setPaperSelectionOptions(inProgressPapers);
        setEntryMessages([
          toMessage(
            "travis",
            `Welcome back. You have a few papers in progress:\n\n${list}\n\nWhich one do you want to work on today?`
          ),
        ]);
        setEntryInitialized(true);
        setShellState("entry");
        setRestorationResolved(true);
        return;
      }

      const restoredWorkspace =
        inProgressPapers.length === 1
          ? {
              type: "studio" as const,
              studio: "paper" as const,
              assignmentId: inProgressPapers[0].assignment_id ?? null,
              paperId: inProgressPapers[0].id ?? null,
            }
          : await getRestorationWorkspace(userId);

      if (!active) return;
      if (restoredWorkspace) {
        setWorkspace(restoredWorkspace);
        setEntryMessages([
          toMessage("travis", "Welcome back. You were working on a paper. Want to continue?"),
        ]);
        setEntryInitialized(true);
        setShellState("workspace");
        setActiveAssistant("victor");
      }
      setRestorationResolved(true);
    });

    return () => {
      active = false;
    };
  }, [
    entryInitialized,
    firstTime.loading,
    restorationResolved,
    setShellState,
    settings.sessionEntryPreference,
    userId,
  ]);

  useEffect(() => {
    if (
      !userId ||
      firstTime.loading ||
      settings.sessionEntryPreference !== "direct" ||
      directEntryResolved
    ) {
      return;
    }

    let active = true;
    void getMostRecentWorkspace(userId).then((nextWorkspace) => {
      if (!active) return;
      setWorkspace(nextWorkspace);
      setEntryMessages([]);
      setEntryInitialized(true);
        setDirectEntryResolved(true);
        setShellState("workspace");
        const victorActive =
        settings.victorAvailability === "always" ||
        (nextWorkspace.type === "studio" &&
          (nextWorkspace.studio === "paper" || nextWorkspace.studio === "math"));
      setActiveAssistant(victorActive ? "victor" : "travis");
    });

    return () => {
      active = false;
    };
  }, [
    directEntryResolved,
    firstTime.loading,
    settings.sessionEntryPreference,
    settings.victorAvailability,
    userId,
  ]);

  useEffect(() => {
    if (
      !userId ||
      firstTime.loading ||
      entryInitialized ||
      settings.sessionEntryPreference === "direct" ||
      !restorationResolved
    ) {
      return;
    }

    if (firstTime.isFirstTimeUser) {
      setEntryMessages([
        toMessage(
          "travis",
          "Hey, I'm Travis — your academic assistant. I keep track of your assignments, deadlines, and what you've been working on so nothing falls through the cracks. Tell me what you're working on today and I'll get you set up."
        ),
        toMessage(
          "victor",
          "I'm Victor. When you're ready to work through something — a paper, a concept you don't understand, a problem set — I'm here. I won't do the work for you, but I'll make sure you understand it."
        ),
      ]);
      setShellState("entry");
      setEntryInitialized(true);
      return;
    }

    setEntryMessages([
      toMessage(
        "travis",
        settings.travisSessionMemory
          ? buildReturnMessage(assignments)
          : "What are you working on today?"
      ),
    ]);
    setShellState("entry");
    setEntryInitialized(true);
  }, [
    assignments,
    entryInitialized,
    firstTime.isFirstTimeUser,
    firstTime.loading,
    restorationResolved,
    settings.sessionEntryPreference,
    settings.travisSessionMemory,
    setShellState,
    userId,
  ]);

  const panelMessages = useMemo(() => {
    const mappedEntry = entryMessages.map((message) => ({
      id: message.id,
      role:
        message.role === "victor"
          ? ("system" as const)
          : message.role === "travis"
            ? ("travis" as const)
            : message.role === "user"
              ? ("user" as const)
              : ("system" as const),
      text:
        message.role === "victor" ? `Victor: ${message.text}` : message.text,
    }));

    const mappedTravis = travisChat.travisChatMessages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
    }));

    return [...mappedEntry, ...mappedTravis];
  }, [entryMessages, travisChat.travisChatMessages]);

  const classifyIntent = useCallback(
    async (message: string) => {
      const response = await fetch("/api/academic/classify-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          existingAssignments: assignments.map((assignment) => ({
            id: assignment.id,
            assignment_name: assignment.assignment_name,
            class_name: assignment.class_name,
            status: assignment.status || null,
            due_date: assignment.due_date,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Intent classification failed.");
      }

      return (await response.json()) as AcademicIntentResult;
    },
    [assignments]
  );

  const openStudio = useCallback(
    (
      intent: AcademicIntentResult,
      assignmentId?: string | null,
      paperId?: string | null,
      reviewId?: string | null,
      setId?: string | null
    ) => {
      if (intent.studio === "unclear") return;
      const studioMap: Record<Exclude<AcademicIntentResult["studio"], "unclear">, StudioKey> = {
        paper: "paper",
        math: "math",
        study: "study",
        agenda: "agenda",
        code_review: "code_review",
      };
      const studio = studioMap[intent.studio];
      const nextWorkspace: AcademicWorkspaceContext = {
        type: "studio",
        studio,
        assignmentId: assignmentId || null,
        paperId: paperId || null,
        reviewId: reviewId || null,
        setId: setId || null,
      };
      setWorkspace(nextWorkspace);
      const victorActive =
        settings.victorAvailability === "always" ||
        intent.studio === "paper" ||
        intent.studio === "math";
      setActiveAssistant(victorActive ? "victor" : "travis");
      if (victorActive) {
        setEntryMessages((current) => [
          ...current,
          toMessage(
            "victor",
            "I'm active in this workspace now. Show me your thinking and I'll push your reasoning forward one step at a time."
          ),
        ]);
      }
    },
    [settings.victorAvailability]
  );

  const handleStudentMessage = useCallback(
    async (message: string) => {
      const content = message.trim();
      if (!content) return;

      const correction = extractCorrection(content, lastCapturedAssignment);
      if (correction && lastCapturedAssignment) {
        setEntryLoading(true);
        setEntryMessages((current) => [...current, toMessage("user", content)]);
        try {
          await assignmentCapture.applyAssignmentCorrection({
            assignmentId: lastCapturedAssignment.id,
            current: lastCapturedAssignment,
            updates: correction,
          });
          setLastCapturedAssignment({
            ...lastCapturedAssignment,
            ...correction,
          });
          setEntryMessages((current) => [
            ...current,
            toMessage("travis", "Updated. I recorded the correction."),
          ]);
          await loadAssignments();
        } finally {
          setEntryLoading(false);
        }
        return;
      }

      if (awaitingPaperSelection) {
        setEntryMessages((current) => [...current, toMessage("user", content)]);
        const selected = resolvePaperSelection(content, paperSelectionOptions);

        if (!selected) {
          setEntryMessages((current) => [
            ...current,
            toMessage(
              "travis",
              "I did not catch that — reply with the number of the paper you want to work on."
            ),
          ]);
          return;
        }

        setAwaitingPaperSelection(false);
        setPaperSelectionOptions([]);
        setShellState("workspace");
        openStudio(
          {
            studio: "paper",
            confidence: "high",
            extractedData: {
              topic: selected.topic ?? undefined,
              className: selected.class_name ?? undefined,
            },
          },
          selected.assignment_id ?? null,
          selected.id
        );
        return;
      }

      if (
        workspace.type === "studio" &&
        !clarifyingAsked &&
        !awaitingConfirmation &&
        activeAssistant !== "victor"
      ) {
        await travisChat.sendTravisMessage(content);
        return;
      }

      setEntryLoading(true);
      setEntryMessages((current) => [...current, toMessage("user", content)]);

      try {
        if (awaitingConfirmation && pendingIntent) {
          const isAffirmative = checkIsAffirmative(content);

          if (isAffirmative || correctionRound >= 1) {
            const assignmentId = await assignmentCapture.captureAssignmentFromIntent(
              pendingIntent,
              pendingOriginalMessage ?? content
            );

            if (assignmentId) {
              const supabase = createSupabaseBrowserClient();
              const { data } = await supabase
                .from("assignments")
                .select("*")
                .eq("id", assignmentId)
                .single();

              if (data) {
                setLastCapturedAssignment(data as AssignmentRow);
                setEntryMessages((current) => [
                  ...current,
                  toMessage(
                    "travis",
                    getCaptureConfirmation(data.assignment_name, data.due_date)
                  ),
                ]);
              }
            }

            setEntryMessages((current) => [
              ...current,
              toMessage("travis", getTravisPreWorkspaceMessage(pendingIntent)),
            ]);
            setAwaitingConfirmation(false);
            setPendingIntent(null);
            setPendingOriginalMessage(null);
            setCorrectionRound(0);
            setClarifyingAsked(false);
            setShellState("workspace");
            openStudio(pendingIntent, assignmentId);
            await loadAssignments();
            return;
          }

          const correctedIntent = await classifyIntent(content);
          setPendingIntent(correctedIntent);
          setPendingOriginalMessage(content);
          setCorrectionRound(1);
          setShellState("confirming");
          setEntryMessages((current) => [
            ...current,
            toMessage("travis", getTravisConfirmationMessage(correctedIntent)),
          ]);
          return;
        }

        const intent = await classifyIntent(content);

        if (intent.confidence === "low") {
          if (!clarifyingAsked) {
            setClarifyingAsked(true);
            setEntryMessages((current) => [
              ...current,
              toMessage(
                "travis",
                intent.clarifyingQuestion || "What do you need to work on today?"
              ),
            ]);
            setShellState("confirming");
            return;
          }

          setEntryMessages((current) => [
            ...current,
            toMessage(
              "travis",
              "I'll open your agenda so you can choose the right workspace from there."
            ),
          ]);
          openStudio({
            studio: "agenda",
            confidence: "high",
            extractedData: intent.extractedData,
          });
          setShellState("workspace");
          setClarifyingAsked(false);
          return;
        }

        setPendingIntent(intent);
        setPendingOriginalMessage(content);
        setAwaitingConfirmation(true);
        setCorrectionRound(0);
        setShellState("confirming");
        setEntryMessages((current) => [
          ...current,
          toMessage("travis", getTravisConfirmationMessage(intent)),
        ]);
      } finally {
        setEntryLoading(false);
      }
    },
    [
      assignmentCapture,
      classifyIntent,
      clarifyingAsked,
      correctionRound,
      lastCapturedAssignment,
      loadAssignments,
      openStudio,
      pendingIntent,
      pendingOriginalMessage,
      awaitingConfirmation,
      awaitingPaperSelection,
      setShellState,
      paperSelectionOptions,
      travisChat,
      uploadContext,
      activeAssistant,
      workspace.type,
    ]
  );

  const handleFileUpload = useCallback(
    async (file: File, message: string) => {
      setUploadContext({
        fileName: file.name,
        message,
      });

      setEntryMessages((current) => [
        ...current,
        toMessage("user", message || `Uploaded ${file.name}`),
      ]);
      setEntryLoading(true);
      try {
        const extractedText = await extractDocumentText(file);
        if (!extractedText || extractedText.trim().length < 50) {
          setEntryMessages((current) => [
            ...current,
            toMessage(
              "travis",
              "I received your file but could not read it directly. Can you tell me what the assignment is?"
            ),
          ]);
          setShellState("entry");
          return;
        }

        const classificationInput = [message.trim(), extractedText]
          .filter(Boolean)
          .join("\n\n");
        const intent = await classifyIntent(classificationInput);
        const targetStudio =
          intent.studio === "math" ||
          intent.studio === "paper" ||
          intent.studio === "study"
            ? intent.studio
            : "study";

        const normalizedIntent = {
          ...intent,
          studio: targetStudio,
          confidence: "high" as const,
        };

        setPendingIntent(normalizedIntent);
        setPendingOriginalMessage(classificationInput);
        setAwaitingConfirmation(true);
        setCorrectionRound(0);
        setShellState("confirming");
        setEntryMessages((current) => [
          ...current,
          toMessage("travis", getTravisConfirmationMessage(normalizedIntent)),
        ]);
      } finally {
        setEntryLoading(false);
      }
    },
    [classifyIntent, setShellState]
  );

  const triggerNavigationSave = useCallback(async () => {
    await Promise.resolve();
  }, []);

  const handleChangeAssignmentType = useCallback(async () => {
    await triggerNavigationSave();
    setAwaitingConfirmation(false);
    setAwaitingPaperSelection(false);
    setPendingIntent(null);
    setPendingOriginalMessage(null);
    setPaperSelectionOptions([]);
    setCorrectionRound(0);
    setShellState("confirming");
    setEntryMessages((current) => [
      ...current,
      toMessage(
        "travis",
        "No problem — tell me what you're actually working on and I'll open the right workspace."
      ),
    ]);
  }, [setShellState, triggerNavigationSave]);

  return {
    assignments,
    activeAssistant,
    entryLoading,
    firstTime,
    handleFileUpload,
    handleStudentMessage,
    panelMessages,
    setTravisChatInput: travisChat.setTravisChatInput,
    travisChatInput: travisChat.travisChatInput,
    travisChatLoading: travisChat.travisChatLoading || entryLoading,
    bridgeTransferring: travisChat.bridgeTransferring,
    crossLanguageNotice: travisChat.crossLanguageNotice,
    crossLanguageProfileVersion: travisChat.crossLanguageProfileVersion,
    pendingTravisAction: travisChat.pendingTravisAction,
    awaitingConfirmation,
    confirmPendingTravisAction: travisChat.confirmPendingTravisAction,
    rejectPendingTravisAction: travisChat.rejectPendingTravisAction,
    handleChangeAssignmentType,
    sendTravisMessage: handleStudentMessage,
    uploadContext,
    workspace,
  };
}
