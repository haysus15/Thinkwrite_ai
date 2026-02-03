// src/components/academic-studio/victor-chat/VictorChatContainer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Send } from "lucide-react";
import { useVictorChat } from "./VictorChatContext";
import ModeIndicator from "./ModeIndicator";
import StudyMaterialsPanel from "../study-materials/StudyMaterialsPanel";

export default function VictorChatContainer({
  workspaceContext,
  showStudyPanel = true,
  variant = "panel",
}: {
  workspaceContext?: string;
  showStudyPanel?: boolean;
  variant?: "panel" | "sidebar";
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
  } = useVictorChat();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setError(null);
    setLoading(true);

    const nextMessages = [
      ...messages,
      {
        role: "user" as const,
        content: input.trim(),
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
          message: input.trim(),
          workspaceContext,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Victor response failed.");
      }

      setConversationId(data.conversationId);
      setSuggestedMode(data.suggestedMode || null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant" as const,
          content: data.reply,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Victor response failed.");
    } finally {
      setLoading(false);
    }
  };

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
          </div>
          {workspaceContext && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">
              {workspaceContext}
            </div>
          )}
        </div>

        {suggestedMode && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <p>
              Victor suggests switching to{" "}
              <span className="font-semibold">{suggestedMode}</span> mode.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  setMode(suggestedMode);
                  setSuggestedMode(null);
                  if (conversationId) {
                    await fetch("/api/victor/mode-switch", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        conversationId,
                        toMode: suggestedMode,
                      }),
                    });
                  }
                }}
                className="rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-[11px] transition hover:bg-amber-500/30"
              >
                Switch
              </button>
              <button
                type="button"
                onClick={() => setSuggestedMode(null)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] transition hover:bg-white/8"
              >
                Stay
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
          {messages.length === 0 && (
            <p className="text-sm text-slate-400">
              Start with your question or assignment prompt.
            </p>
          )}
          <div className="space-y-3">
            {messages.map((message, index) => (
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
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                  Victor is thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {mode === "study" && showStudyPanel && (
          <div className="px-4 pb-4">
            <StudyMaterialsPanel />
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
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
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
      </div>
      {workspaceContext && (
        <p className="mt-3 text-xs text-slate-500">Context: {workspaceContext}</p>
      )}

      {/* Mode suggestion banner */}
      {suggestedMode && (
        <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p>
            Victor suggests switching to{" "}
            <span className="font-semibold">{suggestedMode}</span> mode.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                setMode(suggestedMode);
                setSuggestedMode(null);
                if (conversationId) {
                  await fetch("/api/victor/mode-switch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      conversationId,
                      toMode: suggestedMode,
                    }),
                  });
                }
              }}
              className="rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-xs transition hover:bg-amber-500/30"
            >
              Switch
            </button>
            <button
              type="button"
              onClick={() => setSuggestedMode(null)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition hover:bg-white/8"
            >
              Stay
            </button>
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="mt-5 space-y-3 text-sm text-slate-200">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Start with your question or assignment prompt.
          </p>
        )}
        {messages.map((message, index) => (
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
        ))}
      </div>

      {/* Study materials panel */}
      {mode === "study" && showStudyPanel && (
        <div className="mt-6">
          <StudyMaterialsPanel />
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
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
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
    </div>
  );
}
