// src/components/lex/contexts/MatchAnalysisLex.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { useLexConversation } from "../hooks/useLexConversation";
import { useResumeContext } from "../hooks/useResumeContext";
import { useMatchContext } from "../hooks/useMatchContext";
import LexMessage from "../shared/LexMessage";
import LexInput from "../shared/LexInput";
import LexTypingIndicator from "../shared/LexTypingIndicator";
import QuickActionButtons from "../shared/QuickActionButtons";
import ContextChip from "../shared/ContextChips";
import { QuickAction } from "../types/lex.types";

const WELCOME_MESSAGE = `Hey! I've got your resume-job match analysis right here.

Let's talk about:
- What your match score actually means
- The specific gaps you need to address
- Your genuine strengths for this role
- Whether you're ready to apply or need more prep
- How to close the gaps if you're short

What do you want to know about your match?`;

const QUICK_ACTIONS: QuickAction[] = [
  {
    text: "What's my match score mean?",
    action: "What does my match score actually mean for my chances?",
  },
  {
    text: "Explain my gaps",
    action: "Break down the gaps - what am I missing?",
  },
  {
    text: "What are my strengths?",
    action: "What strengths did the analysis find?",
  },
  {
    text: "Should I apply anyway?",
    action: "Given my match score, should I still apply?",
  },
  {
    text: "How do I improve?",
    action: "How can I close these gaps and improve my match?",
  },
];

export default function MatchAnalysisLex() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load contexts
  const { resumeContext, isLoading: isLoadingResume } = useResumeContext();
  const { matchContext, isLoading: isLoadingMatch } = useMatchContext();

  const { messages, isTyping, sendMessage } = useLexConversation({
    sessionType: "match-analysis",
    welcomeMessage: WELCOME_MESSAGE,
    resumeContext,
    matchContext: matchContext || undefined,
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const truncate = (value: string, max = 30) =>
    value.length > max ? value.slice(0, max - 1) + "…" : value;

  const isLoading = isLoadingResume || isLoadingMatch;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Loading match analysis...</p>
        </div>
      </div>
    );
  }

  if (!matchContext) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-xl bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">No Match Data Found</h2>
          <p className="text-white/60 text-sm">
            Match analysis data is missing. Please run a resume-job comparison first.
          </p>
        </div>
      </div>
    );
  }

  const getMatchColor = (score: number) => {
    if (score >= 70) return "text-emerald-400";
    if (score >= 50) return "text-blue-400";
    if (score >= 30) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050509] to-black" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-pink-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[260px] h-[260px] bg-violet-500/10 rounded-full blur-[110px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <div className="border-b border-white/10 bg-black/70 backdrop-blur-xl">
          <div className="px-6 pt-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#EAAA00] to-amber-500 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.7)]">
                  <span className="text-black font-bold text-xl">L</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-[2px] border-black" />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-lg sm:text-xl font-light tracking-tight">
                  Chat with <span className="font-normal text-white">Lex</span>
                </h1>
                <p className="text-[11px] text-white/50">Match Analysis Discussion</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Match Score Display */}
              <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-4 py-1.5">
                <span className="text-xs text-white/60">Match Score:</span>
                <span className={`text-lg font-bold ${getMatchColor(matchContext.matchScore)}`}>
                  {matchContext.matchScore}/100
                </span>
              </div>

              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                <span>{messages.length} messages</span>
              </div>
            </div>
          </div>

          {/* Context Chips */}
          <div className="px-6 pb-4">
            <div className="flex flex-wrap gap-2">
              <ContextChip
                label="Mode"
                icon={<span>📊</span>}
                tone="danger"
                value="Match Analysis"
              />

              {matchContext.resumeName && (
                <ContextChip
                  label="Resume"
                  icon={<span>📄</span>}
                  tone="neutral"
                  value={truncate(matchContext.resumeName, 28)}
                />
              )}

              {matchContext.jobTitle && matchContext.company && (
                <ContextChip
                  label="Job"
                  icon={<span>💼</span>}
                  tone="primary"
                  value={`${truncate(matchContext.jobTitle, 20)} at ${truncate(matchContext.company, 15)}`}
                />
              )}

              {/* Gaps Badge */}
              {matchContext.gaps.length > 0 && (
                <ContextChip
                  label="Gaps"
                  icon={<span>⚠️</span>}
                  tone="danger"
                  value={`${matchContext.gaps.length} identified`}
                />
              )}

              {/* Strengths Badge */}
              {matchContext.strengths.length > 0 && (
                <ContextChip
                  label="Strengths"
                  icon={<span>✓</span>}
                  tone="accent"
                  value={`${matchContext.strengths.length} identified`}
                />
              )}
            </div>
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
            variant="match"
          />

          <LexInput
            onSend={sendMessage}
            placeholder="Ask about your match analysis... (Shift+Enter for new line)"
            disabled={isTyping}
          />
        </div>
      </div>
    </div>
  );
}
