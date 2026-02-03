// src/components/lex/contexts/GeneralLex.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { useLexConversation } from "../hooks/useLexConversation";
import { useLexStorage } from "../hooks/useLexStorage";
import { useResumeContext } from "../hooks/useResumeContext";
import LexMessage from "../shared/LexMessage";
import LexInput from "../shared/LexInput";
import LexHeader from "../shared/LexHeader";
import LexTypingIndicator from "../shared/LexTypingIndicator";
import QuickActionButtons from "../shared/QuickActionButtons";
import ContextChip from "../shared/ContextChips";
import { QuickAction } from "../types/lex.types";

const WELCOME_MESSAGE = `Hey! I'm Lex. I've been in HR for 15 years - hired thousands, rejected more. I help people navigate careers with insider knowledge. What can we work on?`;

const QUICK_ACTIONS: QuickAction[] = [
  {
    text: "Career Assessment",
    action: "I want to do a career assessment to figure out my next steps.",
  },
  {
    text: "Resume Review",
    action: "Can you review my resume and give me honest feedback?",
  },
  {
    text: "Career Change",
    action: "I'm thinking about changing careers. Can we talk about that?",
  },
  {
    text: "Job Search Strategy",
    action: "Help me create a strategy for my job search.",
  },
];

export default function GeneralLex() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  // 🆕 Load resume context
  const { resumeContext, isLoading: isLoadingResume } = useResumeContext();

  const { messages, isTyping, sendMessage, setMessages } = useLexConversation({
    sessionType: "general",
    welcomeMessage: WELCOME_MESSAGE,
    resumeContext, // 🆕 Pass resume context
  });

  const {
    saveToLocalStorage,
    loadFromLocalStorage,
    clearLocalStorage,
    saveConversation,
  } = useLexStorage({ sessionType: "general" });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load from localStorage on mount ONCE
  useEffect(() => {
    if (!hasLoadedRef.current) {
      const savedMessages = loadFromLocalStorage();
      if (savedMessages && savedMessages.length > 0) {
        setMessages(savedMessages);
      }
      hasLoadedRef.current = true;
    }
  }, [loadFromLocalStorage, setMessages]);

  // Debounced auto-save to prevent constant re-renders
  useEffect(() => {
    if (messages.length > 0 && hasLoadedRef.current) {
      const timeoutId = setTimeout(() => {
        saveToLocalStorage(messages);
      }, 500); // Wait 500ms before saving

      return () => clearTimeout(timeoutId);
    }
  }, [messages, saveToLocalStorage]);

  // Handlers
  const handleSave = () => {
    const title = prompt("Name this conversation:");
    if (title) {
      saveConversation(messages, title);
    }
  };

  const handleNew = () => {
    if (
      confirm(
        "Start a new conversation? Current conversation will be saved to history."
      )
    ) {
      setMessages([
        {
          id: "welcome-" + Date.now(),
          text: WELCOME_MESSAGE,
          sender: "lex",
          timestamp: new Date(),
        },
      ]);
      clearLocalStorage();
    }
  };

  const handleClear = () => {
    if (confirm("Clear conversation history? This cannot be undone.")) {
      setMessages([
        {
          id: "welcome-" + Date.now(),
          text: WELCOME_MESSAGE,
          sender: "lex",
          timestamp: new Date(),
        },
      ]);
      clearLocalStorage();
    }
  };

  // Truncate helper
  const truncate = (value: string, max = 30) =>
    value.length > max ? value.slice(0, max - 1) + "…" : value;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050509] to-black" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#EAAA00]/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[260px] h-[260px] bg-violet-500/10 rounded-full blur-[110px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <LexHeader
          title="Career Coach"
          subtitle="AI-powered career strategist"
          messageCount={messages.length}
          onSave={handleSave}
          onNew={handleNew}
          onClear={handleClear}
          showControls={true}
        />

        {/* 🆕 Context Chips */}
        <div className="border-b border-white/10 bg-black/70 backdrop-blur-xl px-6 pb-4">
          <div className="flex flex-wrap gap-2">
            {resumeContext.hasResume && resumeContext.masterResume && (
              <ContextChip
                label="Resume"
                icon={<span>📄</span>}
                tone="primary"
                value={`${truncate(resumeContext.masterResume.fileName, 32)}${
                  resumeContext.masterResume.score
                    ? ` · ${resumeContext.masterResume.score}/100`
                    : ""
                }`}
              />
            )}

            {isLoadingResume && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] border-white/15 bg-white/5 text-white/70">
                <div className="w-2 h-2 bg-[#EAAA00] rounded-full animate-pulse" />
                <span>Loading resume...</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <LexMessage key={message.id} message={message} />
          ))}

          {isTyping && <LexTypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="backdrop-blur-xl bg-black/70 border-t border-white/10 p-6">
          <QuickActionButtons
            actions={QUICK_ACTIONS}
            onActionClick={sendMessage}
            variant="general"
          />

          <LexInput
            onSend={sendMessage}
            placeholder="Type your career question... (Shift+Enter for new line)"
            disabled={isTyping}
          />
        </div>
      </div>
    </div>
  );
}
