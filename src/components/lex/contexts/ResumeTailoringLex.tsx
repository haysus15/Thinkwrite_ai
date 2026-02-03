// src/components/lex/contexts/ResumeTailoringLex.tsx
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

interface ResumeTailoringLexProps {
  resumeId: string;
  jobId: string;
}

const WELCOME_MESSAGE = `Hey! Let's talk strategy for tailoring your resume.

I'm not going to auto-generate changes - that's how you end up with BS on your resume. Instead, we'll have a real conversation about:
- Why you want this specific role
- What experience you have that actually maps to it
- How to position your background honestly
- What keywords matter (and which ones are just noise)

Then you'll see suggested changes that you can accept, reject, or modify. Every change will be based on what you REALLY did, not what sounds good.

What do you want to know about tailoring for this role?`;

const QUICK_ACTIONS: QuickAction[] = [
  {
    text: "What should I emphasize?",
    action: "Looking at my resume and this job, what experience should I emphasize most?",
  },
  {
    text: "What are my gaps?",
    action: "Be honest - what gaps do I have for this role?",
  },
  {
    text: "How do I position this?",
    action: "How should I frame my background for this specific opportunity?",
  },
  {
    text: "Which keywords matter?",
    action: "What keywords from the job posting should I include, and where?",
  },
  {
    text: "Is this realistic?",
    action: "Honestly, am I qualified enough for this role?",
  },
];

export default function ResumeTailoringLex({
  resumeId,
  jobId,
}: ResumeTailoringLexProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [strategyModeData, setStrategyModeData] = useState<any>(null);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(true);

  // Load contexts
  const { resumeContext, isLoading: isLoadingResume } = useResumeContext();
  const { jobContext, isLoading: isLoadingJob } = useJobContext(jobId);

  // Load strategy mode data (resume content + job content)
useEffect(() => {
  const loadStrategyData = async () => {
    try {
      // Fetch resume content
      const resumeResponse = await fetch(`/api/resumes/${resumeId}`);
      
      // Check if response is OK
      if (!resumeResponse.ok) {
        console.error(`Resume API returned ${resumeResponse.status}`);
        setIsLoadingStrategy(false);
        return;
      }

      const resumeData = await resumeResponse.json();

      // Fetch job content
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
    sessionType: "resume-tailoring",
    welcomeMessage: WELCOME_MESSAGE,
    resumeContext,
    jobContext: jobContext || undefined,
    strategyModeData,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle "Extract Resume Changes" button
  const handleExtractChanges = () => {
    // Save conversation to sessionStorage for extraction
    sessionStorage.setItem(
      "lexResumeTailoringConversation",
      JSON.stringify({
        messages: messages.map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
          timestamp: m.timestamp.toISOString(),
        })),
        resumeId,
        jobId,
        sessionType: "resume-tailoring",
      })
    );

    // Route to extraction page
    router.push(`/career-studio/tailor-resume?resumeId=${resumeId}&jobId=${jobId}&mode=extract`);
  };

  // Show "Extract Changes" button after 5+ messages
  const showExtractButton = messages.length > 5;

  const truncate = (value: string, max = 30) =>
    value.length > max ? value.slice(0, max - 1) + "…" : value;

  const isLoading = isLoadingResume || isLoadingJob || isLoadingStrategy;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Loading strategy session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050509] to-black" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-purple-500/10 rounded-full blur-[140px]" />
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
                <p className="text-[11px] text-white/50">Resume Tailoring Strategy</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Extract Changes Button */}
              {showExtractButton && (
                <button
                  onClick={handleExtractChanges}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors shadow-lg"
                >
                  <span>✨</span>
                  <span className="hidden sm:inline">Extract Resume Changes</span>
                  <span className="sm:hidden">Extract</span>
                </button>
              )}

              {/* Message Count */}
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>{messages.length} messages</span>
              </div>
            </div>
          </div>

          {/* Context Chips */}
          <div className="px-6 pb-4">
            <div className="flex flex-wrap gap-2">
              {/* Mode Chip */}
              <ContextChip
                label="Mode"
                icon={<span>🎯</span>}
                tone="accent"
                value="Resume Tailoring"
              />

              {/* Resume Chip */}
              {resumeContext.hasResume && resumeContext.masterResume && (
                <ContextChip
                  label="Resume"
                  icon={<span>📄</span>}
                  tone="primary"
                  value={truncate(resumeContext.masterResume.fileName, 28)}
                />
              )}

              {/* Job Chip */}
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
            variant="resume"
          />

          <LexInput
            onSend={sendMessage}
            placeholder="Ask about tailoring strategy... (Shift+Enter for new line)"
            disabled={isTyping}
          />
        </div>
      </div>
    </div>
  );
}
