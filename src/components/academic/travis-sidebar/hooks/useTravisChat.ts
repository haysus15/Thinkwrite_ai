"use client";

import { useCallback, useMemo, useState } from "react";
import type { AssignmentRow } from "@/types/academic";
import {
  createBridgeSession,
  runBridgeTransfer,
  shouldRunBridgeTransfer,
} from "@/lib/bridge/client";
import { useBridgeMode } from "@/lib/bridge/useBridgeMode";
import type { IntentType } from "@/lib/academic/travis/classifyIntent";
import { MAX_HISTORY_TURNS } from "@/lib/academic/travis/buildTravisPrompt";

export type TravisActionType =
  | "plan_assignment"
  | "build_week"
  | "rebalance"
  | "update_status"
  | "update_priority"
  | "schedule_tasks"
  | "flag_risk"
  | "check_progress"
  | "check_risk"
  | "none";

export type TravisAction = {
  type: TravisActionType;
  assignmentIds: string[];
  taskIds: string[];
  summary: string;
  confirmed: boolean;
  confirmedAt: Date | null;
  context?: Record<string, unknown>;
};

export type TravisMessage = {
  id: string;
  role: "user" | "travis" | "system";
  content: string;
  text: string;
  timestamp: Date;
  actionTaken: TravisAction | null;
  requiresConfirmation: boolean;
};

type PendingClarification = {
  intent: IntentType;
  question: string;
  context: Record<string, unknown>;
} | null;

export function useTravisChat(options?: { agendaItems?: AssignmentRow[] }) {
  const agendaItems = useMemo(
    () => options?.agendaItems ?? [],
    [options?.agendaItems]
  );
  const bridgeMode = useBridgeMode();

  const [conversationHistory, setConversationHistory] = useState<TravisMessage[]>([]);
  const [travisChatInput, setTravisChatInput] = useState("");
  const [travisChatLoading, setTravisChatLoading] = useState(false);
  const [bridgeTransferring, setBridgeTransferring] = useState(false);
  const [crossLanguageNotice, setCrossLanguageNotice] = useState<string | null>(null);
  const [crossLanguageProfileVersion, setCrossLanguageProfileVersion] = useState<1 | 2 | null>(
    null
  );
  const [pendingClarification, setPendingClarification] =
    useState<PendingClarification>(null);
  const [pendingAction, setPendingAction] = useState<TravisAction | null>(null);

  const trimmedHistory = useMemo(
    () => conversationHistory.slice(-MAX_HISTORY_TURNS),
    [conversationHistory]
  );

  const sendTravisMessage = useCallback(
    async (
      message: string,
      options?: {
        assignmentId?: string;
        confirm?: boolean;
        reject?: boolean;
        systemMessage?: boolean;
      }
    ) => {
      const content = message.trim();
      if (!content) return;

      if (!options?.confirm && !options?.reject && pendingAction) {
        return;
      }

      const nextUserMessage: TravisMessage = {
        id: `user-${Date.now()}`,
        role: options?.systemMessage ? "system" : "user",
        content,
        text: content,
        timestamp: new Date(),
        actionTaken: null,
        requiresConfirmation: false,
      };

      if (!options?.confirm && !options?.reject) {
        setConversationHistory((current) => [...current, nextUserMessage]);
      }

      let workingContent = content;
      if (
        bridgeMode.isActive &&
        !options?.confirm &&
        !options?.reject &&
        !options?.systemMessage
      ) {
        const shouldTransfer = await shouldRunBridgeTransfer(content, bridgeMode.sourceLanguage, 0.7);
        if (shouldTransfer) {
          setBridgeTransferring(true);
          try {
            const transfer = await runBridgeTransfer(content);
            workingContent = transfer.workingText;

            if (transfer.englishOutput && transfer.profileVersion) {
              void createBridgeSession({
                studio: "academic",
                sourceLanguage: bridgeMode.sourceLanguage,
                sourceInput: content,
                englishOutput: transfer.englishOutput,
                profileVersion: transfer.profileVersion,
              }).catch(() => null);
            }
          } finally {
            setBridgeTransferring(false);
          }
        }
      }

      setTravisChatLoading(true);
      try {
        const response = await fetch("/api/travis/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: workingContent,
            assignmentId: options?.assignmentId,
            confirm: Boolean(options?.confirm),
            reject: Boolean(options?.reject),
            conversationHistory: trimmedHistory.map((item) => ({
              role: item.role,
              content: item.content,
              timestamp: item.timestamp.toISOString(),
            })),
      pendingClarification,
      pendingAction,
      agendaItems: agendaItems.map((item) => ({
              id: item.id,
              assignment_name: item.assignment_name,
              class_name: item.class_name,
              due_date: item.due_date,
              status: item.status,
              priority: item.priority,
              is_at_risk: item.is_at_risk,
              tasks: item.tasks || item.assignment_tasks || [],
            })),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Travis could not process that request.");
        }
        setCrossLanguageNotice(
          typeof data?.crossLanguageNotice === "string" ? data.crossLanguageNotice : null
        );
        setCrossLanguageProfileVersion(
          data?.languageContext?.profileVersion === 1 || data?.languageContext?.profileVersion === 2
            ? data.languageContext.profileVersion
            : null
        );

        const nextPendingAction =
          data?.pendingAction && typeof data.pendingAction === "object"
            ? ({
                type: data.pendingAction.type || "none",
                assignmentIds: Array.isArray(data.pendingAction.assignmentIds)
                  ? data.pendingAction.assignmentIds
                  : [],
                taskIds: Array.isArray(data.pendingAction.taskIds)
                  ? data.pendingAction.taskIds
                  : [],
                summary: String(data.pendingAction.summary || ""),
                confirmed: Boolean(data.pendingAction.confirmed),
                confirmedAt: data.pendingAction.confirmedAt
                  ? new Date(data.pendingAction.confirmedAt)
                  : null,
                context:
                  data.pendingAction.context && typeof data.pendingAction.context === "object"
                    ? data.pendingAction.context
                    : undefined,
              } as TravisAction)
            : null;

        setPendingAction(nextPendingAction);

        const nextClarification =
          data?.pendingClarification && typeof data.pendingClarification === "object"
            ? {
                intent: data.pendingClarification.intent as IntentType,
                question: String(data.pendingClarification.question || ""),
                context:
                  data.pendingClarification.context &&
                  typeof data.pendingClarification.context === "object"
                    ? data.pendingClarification.context
                    : {},
              }
            : null;

        setPendingClarification(nextClarification);

        const assistantMessage: TravisMessage = {
          id: `travis-${Date.now()}`,
          role: "travis",
          content: String(data.message || "Plan ready."),
          text: String(data.message || "Plan ready."),
          timestamp: new Date(),
          actionTaken: nextPendingAction,
          requiresConfirmation: Boolean(nextPendingAction),
        };

        setConversationHistory((current) => [...current, assistantMessage]);
      } catch (err) {
        const text = err instanceof Error ? err.message : "Travis request failed.";
        setConversationHistory((current) => [
          ...current,
          {
            id: `travis-error-${Date.now()}`,
            role: "travis",
            content: text,
            text,
            timestamp: new Date(),
            actionTaken: null,
            requiresConfirmation: false,
          },
        ]);
      } finally {
        setTravisChatLoading(false);
        setBridgeTransferring(false);
      }
    },
    [agendaItems, bridgeMode.isActive, bridgeMode.sourceLanguage, pendingAction, pendingClarification, trimmedHistory]
  );

  const confirmPendingTravisAction = useCallback(async () => {
    if (!pendingAction) return;
    await sendTravisMessage("Confirm", {
      confirm: true,
      assignmentId: pendingAction.assignmentIds[0],
    });
  }, [pendingAction, sendTravisMessage]);

  const rejectPendingTravisAction = useCallback(() => {
    setPendingAction(null);
    setPendingClarification(null);
    setConversationHistory((current) => [
      ...current,
      {
        id: `travis-adjust-${Date.now()}`,
        role: "travis",
        content: "Okay. What should I adjust?",
        text: "Okay. What should I adjust?",
        timestamp: new Date(),
        actionTaken: null,
        requiresConfirmation: false,
      },
    ]);
  }, []);

  return {
    travisChatMessages: conversationHistory,
    conversationHistory,
    travisChatInput,
    travisChatLoading,
    bridgeTransferring,
    crossLanguageNotice,
    crossLanguageProfileVersion,
    pendingAction,
    pendingTravisAction: pendingAction,
    pendingClarification,
    setTravisChatInput,
    sendTravisMessage,
    confirmPendingTravisAction,
    rejectPendingTravisAction,
  };
}
