// src/components/lex/contexts/CareerAssessmentLex.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLexConversation } from "../hooks/useLexConversation";
import { useResumeContext } from "../hooks/useResumeContext";
import LexMessage from "../shared/LexMessage";
import LexInput from "../shared/LexInput";
import LexTypingIndicator from "../shared/LexTypingIndicator";
import QuickActionButtons from "../shared/QuickActionButtons";
import ContextChip from "../shared/ContextChips";
import { QuickAction } from "../types/lex.types";

const CAREER_ASSESSMENT_SESSION_KEY = "lexCareerAssessmentConversation";

const WELCOME_MESSAGE = `Hey! Let's map out where your career actually needs to go next.

This isn't a personality quiz. It's a 20-minute conversation where you're honest about:
- What you're done tolerating in your work
- What actually brings out your best
- What the next chapter needs to look like

I'll ask questions, you answer honestly, and we'll end with:
1. **Your Career Profile** - documented baseline of who you are and what you want
2. **Your Action Plan** - concrete steps with real resources and timelines
3. **Ongoing accountability** - I'll check if you're drifting from your goals

**Important:** This is ONLY about your career direction. I won't tailor resumes or write cover letters here - we have separate tools for that.

Ready to start?`;

const QUICK_ACTIONS: QuickAction[] = [
  {
    text: "What drains my energy?",
    action: "Help me identify what specific aspects of my current work drain my energy.",
  },
  {
    text: "What are my strengths?",
    action: "What do I seem to be naturally good at based on what I've told you?",
  },
  {
    text: "Is my vision realistic?",
    action: "Be honest - is what I want actually achievable given where I am now?",
  },
  {
    text: "What's my timeline?",
    action: "Realistically, how long will this career transition take?",
  },
  {
    text: "What are my gaps?",
    action: "What are the biggest gaps between where I am and where I want to be?",
  },
];

export default function CareerAssessmentLex() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🆕 Load resume context
  const { resumeContext, isLoading: isLoadingResume } = useResumeContext();

  // Pass resume context to conversation
  const { messages, isTyping, sendMessage } = useLexConversation({
    sessionType: "career-assessment",
    welcomeMessage: WELCOME_MESSAGE,
    resumeContext, // 🆕 Pass resume context
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle "Generate Career Plan" button
  const handleGeneratePlan = () => {
    // Save conversation to sessionStorage
    sessionStorage.setItem(
      CAREER_ASSESSMENT_SESSION_KEY,
      JSON.stringify({
        messages: messages.map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
          timestamp: m.timestamp.toISOString(),
        })),
        resumeId: resumeContext.masterResume?.id, // 🆕 Include resume ID
        sessionType: "career-assessment",
      })
    );

    // Route to assessment page with generate-plan mode
    router.push("/career-studio/assessment?mode=generate-plan");
  };

  // Show "Generate Career Plan" button after 5+ messages (excluding welcome)
  const showGenerateButton = messages.length > 5;

  // Truncate helper
  const truncate = (value: string, max = 30) =>
    value.length > max ? value.slice(0, max - 1) + "…" : value;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050509] to-black" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-500/10 rounded-full blur-[140px]" />
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
                <p className="text-[11px] text-white/50">Career Assessment Session</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Generate Career Plan Button */}
              {showGenerateButton && (
                <button
                  onClick={handleGeneratePlan}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors shadow-lg"
                >
                  <span>✨</span>
                  <span className="hidden sm:inline">Generate Career Plan</span>
                  <span className="sm:hidden">Generate</span>
                </button>
              )}

              {/* Message Count */}
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>{messages.length} messages</span>
              </div>
            </div>
          </div>

          {/* Context Chips */}
          <div className="px-6 pb-4">
            <div className="flex flex-wrap gap-2">
              {/* Assessment Mode Chip */}
              <ContextChip
                label="Mode"
                icon={<span>🎯</span>}
                tone="accent"
                value="Career Assessment"
              />

              {/* Resume Context Chip */}
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

              {/* Loading Resume Indicator */}
              {isLoadingResume && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] border-white/15 bg-white/5 text-white/70">
                  <div className="w-2 h-2 bg-[#EAAA00] rounded-full animate-pulse" />
                  <span>Loading resume...</span>
                </div>
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
            variant="assessment"
          />

          <LexInput
            onSend={sendMessage}
            placeholder="Share your career goals and current situation... (Shift+Enter for new line)"
            disabled={isTyping}
          />
        </div>
      </div>
    </div>
  );
}
