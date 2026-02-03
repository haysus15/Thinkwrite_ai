// src/components/lex/contexts/JobAnalysisLex.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { useLexConversation } from "../hooks/useLexConversation";
import { useResumeContext } from "../hooks/useResumeContext";
import { useJobContext } from "../hooks/useJobContext";
import LexMessage from "../shared/LexMessage";
import LexInput from "../shared/LexInput";
import LexTypingIndicator from "../shared/LexTypingIndicator";
import QuickActionButtons from "../shared/QuickActionButtons";
import ContextChip from "../shared/ContextChips";
import { QuickAction } from "../types/lex.types";

interface JobAnalysisLexProps {
  jobId: string;
}

const WELCOME_MESSAGE = `Hey! Let's talk about this job posting.

I've already analyzed it - now I'll give you the straight talk about:
- Red flags I spotted (and there are always some)
- What the requirements really mean
- Company culture signals
- Whether you should actually apply
- How to prep if you do interview

What do you want to know about this role?`;

const QUICK_ACTIONS: QuickAction[] = [
  {
    text: "What are the red flags?",
    action: "What red flags did you spot in this job posting?",
  },
  {
    text: "What's the culture like?",
    action: "Based on the posting, what can you tell about company culture?",
  },
  {
    text: "Am I qualified?",
    action: "Honestly, am I qualified for this role?",
  },
  {
    text: "Should I apply?",
    action: "Given everything, should I actually apply to this job?",
  },
  {
    text: "Interview prep tips?",
    action: "If I get an interview, what should I prepare for?",
  },
];

export default function JobAnalysisLex({ jobId }: JobAnalysisLexProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load contexts
  const { resumeContext, isLoading: isLoadingResume } = useResumeContext();
  const { jobContext, isLoading: isLoadingJob } = useJobContext(jobId);

  const { messages, isTyping, sendMessage } = useLexConversation({
    sessionType: "job-discussion",
    welcomeMessage: WELCOME_MESSAGE,
    resumeContext,
    jobContext: jobContext || undefined,
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const truncate = (value: string, max = 30) =>
    value.length > max ? value.slice(0, max - 1) + "…" : value;

  const isLoading = isLoadingResume || isLoadingJob;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#EAAA00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Loading job discussion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050509] to-black" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#EAAA00]/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[260px] h-[260px] bg-orange-500/10 rounded-full blur-[110px]" />
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
                <p className="text-[11px] text-white/50">Job Discussion</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EAAA00]" />
                <span>{messages.length} messages</span>
              </div>
            </div>
          </div>

          {/* Context Chips */}
          <div className="px-6 pb-4">
            <div className="flex flex-wrap gap-2">
              <ContextChip
                label="Mode"
                icon={<span>💼</span>}
                tone="primary"
                value="Job Discussion"
              />

              {resumeContext.hasResume && resumeContext.masterResume && (
                <ContextChip
                  label="Resume"
                  icon={<span>📄</span>}
                  tone="neutral"
                  value={truncate(resumeContext.masterResume.fileName, 28)}
                />
              )}

              {jobContext && (
                <ContextChip
                  label="Discussing"
                  icon={<span>🎯</span>}
                  tone="primary"
                  value={`${truncate(jobContext.jobTitle, 20)} at ${truncate(jobContext.company, 15)}`}
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
            variant="general"
          />

          <LexInput
            onSend={sendMessage}
            placeholder="Ask about this job opportunity... (Shift+Enter for new line)"
            disabled={isTyping}
          />
        </div>
      </div>
    </div>
  );
}
