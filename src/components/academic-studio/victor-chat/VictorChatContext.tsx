// src/components/academic-studio/victor-chat/VictorChatContext.tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { VictorMode } from "@/types/academic-studio";

export interface VictorMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface SavedSession {
  id: string;
  title: string;
  mode: VictorMode;
  lastMessageAt: string;
}

interface VictorChatState {
  mode: VictorMode;
  setMode: (mode: VictorMode) => void;
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  messages: VictorMessage[];
  setMessages: (messages: VictorMessage[]) => void;
  savedSessions: SavedSession[];
  setSavedSessions: (sessions: SavedSession[]) => void;
  refreshSavedSessions: () => void;
  suggestedMode: VictorMode | null;
  setSuggestedMode: (mode: VictorMode | null) => void;
  loadSession: (id: string) => Promise<void>;
}

const VictorChatContext = createContext<VictorChatState | undefined>(undefined);

export function VictorChatProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<VictorMode>("default");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VictorMessage[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [suggestedMode, setSuggestedMode] = useState<VictorMode | null>(null);
  const searchParams = useSearchParams();

  const refreshSavedSessions = useCallback(() => {
    fetch("/api/victor/conversations/saved")
      .then((response) => response.json())
      .then((data) => {
        if (data?.success) {
          setSavedSessions(data.sessions || []);
        }
      })
      .catch(() => null);
  }, []);

  const loadSession = useCallback(async (id: string) => {
    const response = await fetch(`/api/victor/conversation/${id}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load session.");
    }
    setConversationId(id);
    setMode(data.conversation.mode);
    setMessages(data.conversation.messages || []);
    setSuggestedMode(null);
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get("conversationId");
    if (sessionId && sessionId !== conversationId) {
      loadSession(sessionId).catch(() => null);
    }
  }, [searchParams, conversationId, loadSession]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      conversationId,
      setConversationId,
      messages,
      setMessages,
      savedSessions,
      setSavedSessions,
      refreshSavedSessions,
      suggestedMode,
      setSuggestedMode,
      loadSession,
    }),
    [
      mode,
      conversationId,
      messages,
      savedSessions,
      refreshSavedSessions,
      suggestedMode,
      loadSession,
    ]
  );

  return (
    <VictorChatContext.Provider value={value}>
      {children}
    </VictorChatContext.Provider>
  );
}

export function useVictorChat() {
  const context = useContext(VictorChatContext);
  if (!context) {
    throw new Error("useVictorChat must be used within VictorChatProvider");
  }
  return context;
}
