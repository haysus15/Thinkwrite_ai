// src/components/academic-studio/victor-chat/VictorChatContainer.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, Send } from "lucide-react";
import { useVictorChat } from "./VictorChatContext";
import ModeIndicator from "./ModeIndicator";
import type { VictorMode } from "@/types/academic-studio";
import type { VictorContext } from "@/lib/academic/victor/victorTypes";
import type { CoachingProfile } from "@/lib/academic/victor/coachingProfiles";
import TeachingSessionPanel from "./TeachingSessionPanel/TeachingSessionPanel";
import VictorModeSuggestion from "./VictorModeSuggestion";
import VictorProfileSelector from "./VictorProfileSelector";
import VictorMemoryPanel from "./VictorMemoryPanel";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import type { MisconceptionLevel } from "@/lib/academic/victor/victorTypes";

export default function VictorChatContainer({
  workspaceContext,
  showStudyPanel = true,
  variant = "panel",
  victorContext,
  assignmentId,
  defaultCoachingProfile,
  showProfileSelector = false,
}: {
  workspaceContext?: string;
  showStudyPanel?: boolean;
  variant?: "panel" | "sidebar";
  victorContext?: Partial<VictorContext>;
  assignmentId?: string | null;
  defaultCoachingProfile?: CoachingProfile;
  showProfileSelector?: boolean;
}) {
  const {
    mode,
    setMode,
    conversationId,
    setConversationId,
    messages,
    setMessages,
    suggestedMode,
    setSuggestedMode,
    refreshSavedSessions,
    teachingSession,
    setTeachingSession,
    coachingProfile,
    setCoachingProfile,
  } = useVictorChat();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mirrorNotice, setMirrorNotice] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoPromptRef = useRef<string | null>(null);
  const recentMisconceptionsRef = useRef<MisconceptionLevel[]>([]);
  const sessionLoggedStrugglesRef = useRef<Set<string>>(new Set());

  const isVictorMode = (value: string | null): value is VictorMode => {
    return (
      value === "default" ||
      value === "idea_expansion" ||
      value === "challenge" ||
      value === "study" ||
      value === "math" ||
      value === "coding_review" ||
      value === "teaching"
    );
  };

  const isTeachingResponse = (responseType?: string) =>
    responseType === "step" ||
    responseType === "feedback" ||
    responseType === "complete";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!mirrorNotice) return;
    const timer = window.setTimeout(() => setMirrorNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [mirrorNotice]);

  useEffect(() => {
    if (!defaultCoachingProfile) return;
    setCoachingProfile(defaultCoachingProfile);
  }, [defaultCoachingProfile, setCoachingProfile]);

  const persistCoachingProfile = useCallback(
    async (profile: CoachingProfile) => {
      setCoachingProfile(profile);
      if (!assignmentId) return;
      setProfileSaving(true);
      try {
        await fetch(`/api/travis/assignment/${assignmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ victor_coaching_profile: profile }),
        });
      } finally {
        setProfileSaving(false);
      }
    },
    [assignmentId, setCoachingProfile]
  );

  const sendMessage = useCallback(async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    setError(null);
    setRecoveryMessage(null);
    setLoading(true);

    const nextMessages = [
      ...messages,
      {
        role: "user" as const,
        content: trimmed,
        timestamp: new Date().toISOString(),
      },
    ];
    setMessages(nextMessages);
    setInput("");

    try {
      const response = await fetch("/api/victor/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          mode,
          message: trimmed,
          workspaceContext,
          victorContext,
          coachingProfile,
          assignmentId,
          sessionId: teachingSession?.sessionId,
          teachingSession,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Victor response failed.");
      }
      if (typeof data?.recoveryMessage === "string" && data.recoveryMessage.trim()) {
        setRecoveryMessage(data.recoveryMessage);
        setLoading(false);
        return;
      }

      setConversationId(data.conversationId);
      setSuggestedMode(data.suggestedMode || null);
      if (data?.updatedSession) {
        setTeachingSession(data.updatedSession);
      } else if (data?.responseType === "conversation") {
        setTeachingSession(null);
      }
      if (isTeachingResponse(data?.responseType)) {
        setMode("teaching");
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant" as const,
          content: data.reply,
          timestamp: new Date().toISOString(),
          responseType: data.responseType,
          misconceptionLevel: data.misconceptionLevel,
        },
      ]);
      if (data?.mirrorCapture?.captured === true) {
        setMirrorNotice("Mirror Mode recorded this — academic voice updated.");
      }

      const misconception =
        data?.misconceptionLevel === "partial" ||
        data?.misconceptionLevel === "fundamental"
          ? (data.misconceptionLevel as MisconceptionLevel)
          : "none";

      const recent = recentMisconceptionsRef.current;
      const previousLevel = recent.length > 0 ? recent[recent.length - 1] : "none";
      recentMisconceptionsRef.current = [...recent.slice(-2), misconception];

      const className = victorContext?.className?.trim();
      const lastAssistantMessage = [...messages]
        .reverse()
        .find((item) => item.role === "assistant");
      const hadFollowUpPrompt = Boolean(lastAssistantMessage?.content?.includes("?"));
      const persistentGap =
        className &&
        misconception !== "none" &&
        previousLevel !== "none" &&
        hadFollowUpPrompt;

      if (persistentGap) {
        const studentMessages = nextMessages
          .filter((item) => item.role === "user")
          .slice(-2)
          .map((item) => item.content);
        const struggleType =
          misconception === "fundamental" ? "misconception" : "incomplete_understanding";
        const dedupeKey = `${assignmentId || "none"}:${className}:${struggleType}:${studentMessages.join("|")}`;
        if (!sessionLoggedStrugglesRef.current.has(dedupeKey)) {
          sessionLoggedStrugglesRef.current.add(dedupeKey);
          void fetch("/api/victor/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignmentId,
              className,
              struggleType,
              sessionNotes: `Victor mode: ${mode}`,
              studentMessages,
            }),
          }).catch(() => null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Victor response failed.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId, coachingProfile, conversationId, messages, mode, setConversationId, setMessages, setSuggestedMode, setTeachingSession, setMode, teachingSession, workspaceContext, victorContext]);

  const handleSend = async () => {
    await sendMessage(input);
  };

  const handleStepAttempt = async (attempt: string) => {
    await sendMessage(attempt);
  };

  useEffect(() => {
    const requestedMode = searchParams.get("victorMode");
    if (isVictorMode(requestedMode) && requestedMode !== mode) {
      setMode(requestedMode);
    }
  }, [searchParams, setMode, mode]);

  useEffect(() => {
    const prompt = searchParams.get("victorPrompt");
    if (!prompt) return;
    const promptKey = `${searchParams.get("assignmentId") || "general"}:${prompt}`;
    if (autoPromptRef.current === promptKey) return;

    autoPromptRef.current = promptKey;
    sendMessage(prompt).catch(() => null);

    const url = new URL(window.location.href);
    url.searchParams.delete("victorPrompt");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams, sendMessage]);

  const handleSaveSession = async () => {
    if (!conversationId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/victor/conversation/save/${conversationId}`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Save failed.");
      }
      refreshSavedSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (variant === "sidebar") {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="border-b border-white/8 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-400">Victor chat</span>
            <button
              type="button"
              onClick={handleSaveSession}
              disabled={!conversationId || saving}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save session"}
            </button>
            <button
              type="button"
              onClick={() => setMemoryOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-white/10"
            >
              Memory
            </button>
          </div>
          {workspaceContext && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">
              {workspaceContext}
            </div>
          )}
        </div>

        {suggestedMode && (
          <VictorModeSuggestion
            suggestedMode={suggestedMode}
            conversationId={conversationId}
            setMode={setMode}
            setSuggestedMode={setSuggestedMode}
            compact
          />
        )}
        {showProfileSelector && (
          <div className="mx-4 mt-3">
            <VictorProfileSelector
              activeProfile={coachingProfile}
              onSelect={(profile) => void persistCoachingProfile(profile)}
              loading={profileSaving}
            />
          </div>
        )}
        {mirrorNotice && (
          <div className="mx-4 mt-3 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
            {mirrorNotice}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
          {teachingSession && (
            <div className="mb-3">
              <TeachingSessionPanel
                session={teachingSession}
                loading={loading}
                onSubmitAttempt={handleStepAttempt}
              />
            </div>
          )}
          {recoveryMessage ? (
          <AcademicEmptyState
            title="Victor needs more context"
            description={recoveryMessage}
            action={
              workspaceContext?.toLowerCase().includes("paper")
                ? {
                    label: "Open paper workflow",
                    onClick: () => router.push("/academic/paper-workflow"),
                  }
                : undefined
            }
            className="!min-h-0 border-white/10 bg-black/20"
          />
          ) : null}
          {messages.length === 0 && !recoveryMessage && (
            <p className="text-sm text-slate-400">Start with your question or assignment prompt.</p>
          )}
          <div className="space-y-3">
            {messages.map((message, index) => (
              message.role === "assistant" && isTeachingResponse(message.responseType) ? null : (
              <div
                key={`${message.timestamp}-${index}`}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                    message.role === "assistant"
                      ? "border border-white/10 bg-white/5 text-slate-200"
                      : "border border-sky-400/30 bg-sky-500/20 text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              )
            ))}
            {loading && (
              <div className="flex justify-start">
                <AcademicLoadingState
                  message="Victor is thinking..."
                  className="!min-h-0 px-3 py-2"
                />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {mode === "study" && showStudyPanel && (
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-300">
              Study workflow has moved to Study Hub.
              <div className="mt-2">
                <a
                  href="/academic/study-hub?tab=library"
                  className="inline-flex rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-[11px] text-sky-200"
                >
                  Open Study Hub
                </a>
              </div>
            </div>
          </div>
        )}

        {mode === "math" && (
          <div className="px-4 pb-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              Show your work. Victor will verify every step before moving on.
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 pb-3">
            <AcademicErrorState message={error} className="!min-h-0 py-2" />
          </div>
        )}

        <div className="border-t border-white/8 p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Victor anything..."
              aria-label="Victor chat input"
              rows={1}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
        <VictorMemoryPanel
          open={memoryOpen}
          onClose={() => setMemoryOpen(false)}
          classNameFilter={victorContext?.className || undefined}
        />
      </div>
    );
  }

  return (
    <div className="academic-nested-card rounded-xl p-5">
      {/* Header with mode indicator and save button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ModeIndicator mode={mode} />
          <p className="text-sm text-slate-400">
            Victor asks the hard questions. You answer.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveSession}
          disabled={!conversationId || saving}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save session"}
        </button>
        <button
          type="button"
          onClick={() => setMemoryOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/8"
        >
          Memory
        </button>
      </div>
      {workspaceContext && (
        <p className="mt-3 text-xs text-slate-500">Context: {workspaceContext}</p>
      )}

      {/* Mode suggestion banner */}
      {suggestedMode && (
        <VictorModeSuggestion
          suggestedMode={suggestedMode}
          conversationId={conversationId}
          setMode={setMode}
          setSuggestedMode={setSuggestedMode}
        />
      )}
      {showProfileSelector && (
        <div className="mt-4">
          <VictorProfileSelector
            activeProfile={coachingProfile}
            onSelect={(profile) => void persistCoachingProfile(profile)}
            loading={profileSaving}
          />
        </div>
      )}
      {mirrorNotice && (
        <div className="mt-4 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
          {mirrorNotice}
        </div>
      )}

      {/* Chat messages */}
      <div className="mt-5 space-y-3 text-sm text-slate-200">
        {teachingSession && (
          <TeachingSessionPanel
            session={teachingSession}
            loading={loading}
            onSubmitAttempt={handleStepAttempt}
          />
        )}
        {recoveryMessage ? (
          <AcademicEmptyState
            title="Victor needs more context"
            description={recoveryMessage}
            action={
              workspaceContext?.toLowerCase().includes("paper")
                ? {
                    label: "Open paper workflow",
                    onClick: () => router.push("/academic/paper-workflow"),
                  }
                : undefined
            }
            className="!min-h-0 py-3"
          />
        ) : null}
        {messages.length === 0 && !recoveryMessage && (
          <AcademicEmptyState
            title="No messages yet"
            description="Start with your question or assignment prompt."
            className="!min-h-0 py-3"
          />
        )}
        {messages.map((message, index) =>
          message.role === "assistant" && isTeachingResponse(message.responseType) ? null : (
            <div
              key={`${message.timestamp}-${index}`}
              className={`rounded-xl px-4 py-3 ${
                message.role === "assistant"
                  ? "academic-chat-message-victor"
                  : "academic-chat-message-user"
              }`}
            >
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                {message.role === "assistant" ? "Victor" : "You"}
              </span>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">
                {message.content}
              </p>
            </div>
          )
        )}
      </div>

      {/* Study hub shortcut */}
      {mode === "study" && showStudyPanel && (
        <div className="mt-6">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            Study workflow has moved to Study Hub.
            <div className="mt-2">
              <a
                href="/academic/study-hub?tab=library"
                className="inline-flex rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-200"
              >
                Open Study Hub
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Math mode indicator */}
      {mode === "math" && (
        <div className="mt-6 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-slate-300">
          Show your work. Victor will verify every step before moving on.
        </div>
      )}

      {/* Error display */}
      {error && (
        <AcademicErrorState message={error} className="mt-4 !min-h-0 py-3" />
      )}

      {/* Input area */}
      <div className="mt-5 flex flex-wrap gap-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Send your prompt or response."
          aria-label="Victor chat input"
          rows={3}
          className="flex-1 rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-sky-400/50 focus:bg-white/6 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="inline-flex h-fit items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
      <VictorMemoryPanel
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        classNameFilter={victorContext?.className || undefined}
      />
    </div>
  );
}
