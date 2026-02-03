// src/components/lex/contexts/CoverLetterLex.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLexConversation } from "../hooks/useLexConversation";
import { useResumeContext } from "../hooks/useResumeContext";
import { useJobContext } from "../hooks/useJobContext";
import LexMessage from "../shared/LexMessage";
import LexInput from "../shared/LexInput";
import LexTypingIndicator from "../shared/LexTypingIndicator";
import QuickActionButtons from "../shared/QuickActionButtons";
import ContextChip from "../shared/ContextChips";
import { QuickAction } from "../types/lex.types";

interface CoverLetterLexProps {
  resumeId: string;
  jobId: string;
}

const WELCOME_MESSAGE = `Hey! Let's craft a cover letter that actually sounds like you.

I'm not going to generate generic "I am passionate about..." nonsense. We'll have a conversation about:
- Why you genuinely want this role
- How your story connects to what they need
- What makes you different from the stack of other applications
- The right tone for this company's culture

Then I'll help you write something authentic that positions you well without the corporate BS.

What do you want to know about this cover letter?`;

const QUICK_ACTIONS: QuickAction[] = [
  {
    text: "Why do I want this?",
    action: "Help me articulate why I genuinely want this specific role.",
  },
  {
    text: "What's my story?",
    action: "How should I frame my career story for this application?",
  },
  {
    text: "What tone works?",
    action: "Based on the company, what tone should I use in the letter?",
  },
  {
    text: "What should I highlight?",
    action: "What from my background should I emphasize in the cover letter?",
  },
  {
    text: "How do I stand out?",
    action: "How can I differentiate myself from other candidates?",
  },
];

export default function CoverLetterLex({
  resumeId,
  jobId,
}: CoverLetterLexProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [strategyModeData, setStrategyModeData] = useState<any>(null);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(true);

  // Load contexts
  const { resumeContext, isLoading: isLoadingResume } = useResumeContext();
  const { jobContext, isLoading: isLoadingJob } = useJobContext(jobId);

 // Load strategy mode data
useEffect(() => {
  const loadStrategyData = async () => {
    try {
      const resumeResponse = await fetch(`/api/resumes/${resumeId}`);
      
      // Check if response is OK
      if (!resumeResponse.ok) {
        console.error(`Resume API returned ${resumeResponse.status}`);
        setIsLoadingStrategy(false);
        return;
      }

      const resumeData = await resumeResponse.json();

      const jobResponse = await fetch(`/api/job-analysis/${jobId}`);
      
      // Check if response is OK
      if (!jobResponse.ok) {
        console.error(`Job API returned ${jobResponse.status}`);
        setIsLoadingStrategy(false);
        return;
      }

      const jobData = await jobResponse.json();

      if (resumeData.success && jobData.success) {
        setStrategyModeData({
          resumeId,
          jobId,
          resumeContent: resumeData.resume?.fullText || resumeData.resume?.extractedText || "",
          jobContent: jobData.analysis?.full_description || jobData.analysis?.description || "",
        });
      } else {
        console.error('Resume or job data missing success flag');
      }
    } catch (error) {
      console.error("Failed to load strategy data:", error);
    } finally {
      setIsLoadingStrategy(false);
    }
  };

  loadStrategyData();
}, [resumeId, jobId]);

  const { messages, isTyping, sendMessage } = useLexConversation({
    sessionType: "cover-letter",
    welcomeMessage: WELCOME_MESSAGE,
    resumeContext,
    jobContext: jobContext || undefined,
    strategyModeData,
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle "Generate Cover Letter" button
  const handleGenerateLetter = () => {
    sessionStorage.setItem(
      "lexCoverLetterConversation",
      JSON.stringify({
        messages: messages.map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
          timestamp: m.timestamp.toISOString(),
        })),
        resumeId,
        jobId,
        sessionType: "cover-letter",
      })
    );

    router.push(`/career-studio/cover-letter?resumeId=${resumeId}&jobId=${jobId}&mode=generate`);
  };

  const showGenerateButton = messages.length > 5;

  const truncate = (value: string, max = 30) =>
    value.length > max ? value.slice(0, max - 1) + "…" : value;

  const isLoading = isLoadingResume || isLoadingJob || isLoadingStrategy;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Loading cover letter session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050509] to-black" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/10 rounded-full blur-[140px]" />
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
                <p className="text-[11px] text-white/50">Cover Letter Strategy</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {showGenerateButton && (
                <button
                  onClick={handleGenerateLetter}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors shadow-lg"
                >
                  <span>✍️</span>
                  <span className="hidden sm:inline">Generate Cover Letter</span>
                  <span className="sm:hidden">Generate</span>
                </button>
              )}

              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{messages.length} messages</span>
              </div>
            </div>
          </div>

          {/* Context Chips */}
          <div className="px-6 pb-4">
            <div className="flex flex-wrap gap-2">
              <ContextChip
                label="Mode"
                icon={<span>✍️</span>}
                tone="accent"
                value="Cover Letter"
              />

              {resumeContext.hasResume && resumeContext.masterResume && (
                <ContextChip
                  label="Resume"
                  icon={<span>📄</span>}
                  tone="primary"
                  value={truncate(resumeContext.masterResume.fileName, 28)}
                />
              )}

              {jobContext && (
                <ContextChip
                  label="Target Job"
                  icon={<span>💼</span>}
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
            variant="cover-letter"
          />

          <LexInput
            onSend={sendMessage}
            placeholder="Share your thoughts about this role... (Shift+Enter for new line)"
            disabled={isTyping}
          />
        </div>
      </div>
    </div>
  );
}
