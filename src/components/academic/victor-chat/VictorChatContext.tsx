// src/components/academic/victor-chat/VictorChatContext.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type {
  TeachingSession,
  VictorMode,
} from "@/types/academic";
import type { MisconceptionLevel } from "@/lib/academic/victor/victorTypes";
import type { CoachingProfile } from "@/lib/academic/victor/coachingProfiles";
import { createCodingReviewSession } from "@/lib/academic/codingReviewApi";

export interface VictorMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  responseType?: "step" | "feedback" | "complete" | "conversation";
  misconceptionLevel?: MisconceptionLevel;
}

const EMPTY_VICTOR_MESSAGES: VictorMessage[] = [];
const EMPTY_SAVED_SESSIONS: SavedSession[] = [];
const NOOP_SET_MODE = (_mode: VictorMode) => undefined;
const NOOP_SET_ID = (_id: string | null) => undefined;
const NOOP_SET_MESSAGES: Dispatch<SetStateAction<VictorMessage[]>> = (_value) => undefined;
const NOOP_SET_SESSIONS: Dispatch<SetStateAction<SavedSession[]>> = (_value) => undefined;
const NOOP_REFRESH = () => undefined;
const NOOP_SET_SUGGESTED = (_mode: VictorMode | null) => undefined;
const NOOP_LOAD_SESSION = async (_id: string) => undefined;
const NOOP_SET_TEACHING = (_session: TeachingSession | null) => undefined;
const NOOP_SET_PROFILE = (_profile: CoachingProfile) => undefined;

const FALLBACK_VICTOR_CHAT_STATE: VictorChatState = {
  mode: "default",
  setMode: NOOP_SET_MODE,
  conversationId: null,
  setConversationId: NOOP_SET_ID,
  messages: EMPTY_VICTOR_MESSAGES,
  setMessages: NOOP_SET_MESSAGES,
  savedSessions: EMPTY_SAVED_SESSIONS,
  setSavedSessions: NOOP_SET_SESSIONS,
  refreshSavedSessions: NOOP_REFRESH,
  suggestedMode: null,
  setSuggestedMode: NOOP_SET_SUGGESTED,
  loadSession: NOOP_LOAD_SESSION,
  codingReviewSessionId: null,
  setCodingReviewSessionId: NOOP_SET_ID,
  teachingSession: null,
  setTeachingSession: NOOP_SET_TEACHING,
  coachingProfile: "tutor",
  setCoachingProfile: NOOP_SET_PROFILE,
};

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
  setMessages: Dispatch<SetStateAction<VictorMessage[]>>;
  savedSessions: SavedSession[];
  setSavedSessions: Dispatch<SetStateAction<SavedSession[]>>;
  refreshSavedSessions: () => void;
  suggestedMode: VictorMode | null;
  setSuggestedMode: (mode: VictorMode | null) => void;
  loadSession: (id: string) => Promise<void>;
  codingReviewSessionId: string | null;
  setCodingReviewSessionId: (id: string | null) => void;
  teachingSession: TeachingSession | null;
  setTeachingSession: (session: TeachingSession | null) => void;
  coachingProfile: CoachingProfile;
  setCoachingProfile: (profile: CoachingProfile) => void;
}

const VictorChatContext = createContext<VictorChatState | undefined>(undefined);

export function VictorChatProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("academic.victorUi.context");
  const [mode, setMode] = useState<VictorMode>("default");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VictorMessage[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [suggestedMode, setSuggestedMode] = useState<VictorMode | null>(null);
  const [codingReviewSessionId, setCodingReviewSessionId] = useState<string | null>(
    null
  );
  const [teachingSession, setTeachingSession] = useState<TeachingSession | null>(
    null
  );
  const [coachingProfile, setCoachingProfile] = useState<CoachingProfile>("tutor");
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
      throw new Error(data.error || t("errors.loadSession"));
    }
    setConversationId(id);
    setMode(data.conversation.mode);
    setMessages(data.conversation.messages || []);
    setSuggestedMode(null);
    setTeachingSession(null);
  }, [t]);

  useEffect(() => {
    const sessionId = searchParams.get("conversationId");
    if (sessionId && sessionId !== conversationId) {
      loadSession(sessionId).catch(() => null);
    }
  }, [searchParams, conversationId, loadSession]);

  useEffect(() => {
    if (mode !== "coding_review") return;
    if (codingReviewSessionId) return;
    const assignmentId = searchParams.get("assignmentId");
    if (assignmentId) return;
    createCodingReviewSession({
      language: "python",
      entry_type: "sandbox",
    })
      .then((session) => setCodingReviewSessionId(session.id))
      .catch(() => null);
  }, [mode, codingReviewSessionId, searchParams]);

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
      codingReviewSessionId,
      setCodingReviewSessionId,
      teachingSession,
      setTeachingSession,
      coachingProfile,
      setCoachingProfile,
    }),
    [
      mode,
      conversationId,
      messages,
      savedSessions,
      refreshSavedSessions,
      suggestedMode,
      loadSession,
      codingReviewSessionId,
      setCodingReviewSessionId,
      teachingSession,
      setTeachingSession,
      coachingProfile,
    ]
  );

  return (
    <VictorChatContext.Provider value={value}>
      {children}
    </VictorChatContext.Provider>
  );
}

export function useVictorChat() {
  return useContext(VictorChatContext) ?? FALLBACK_VICTOR_CHAT_STATE;
}

export function useVictorChatOptional() {
  return useContext(VictorChatContext) ?? null;
}
