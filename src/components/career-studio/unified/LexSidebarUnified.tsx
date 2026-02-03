// Lex Sidebar - Unified Career Studio
// src/components/career-studio/unified/LexSidebarUnified.tsx

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Send, Sparkles } from 'lucide-react';
import { WorkspaceState, WorkspaceView, WorkspaceContext } from '@/types/career-studio-workspace';
import { detectWorkspaceIntent } from '@/lib/career-studio/workspaceManager';
import {
  subscribeToLexPrompts,
  dispatchResumeUpdated,
  dispatchRecruiterReview,
  dispatchQuoteReview,
  type LexPromptPayload,
} from '@/lib/career-studio/lexBus';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  kind?: 'mode';
  intent?: LexPromptPayload['intent'];
}

interface LexResumeContext {
  hasResume: boolean;
  masterResume?: {
    id: string;
    fileName: string;
    score?: number;
  };
}

interface ResumeAnalysisContext {
  resumeId: string;
  fileName?: string;
  overallScore?: number;
  resumeQuotes: Array<{
    issue?: string;
    originalText?: string;
    suggestedImprovement?: string;
    category?: string;
    context?: string;
  }>;
  recommendations: Array<{
    priority?: string;
    issue?: string;
    solution?: string;
    impact?: string;
  }>;
}

interface LexSidebarUnifiedProps {
  workspaceState: WorkspaceState;
  onWorkspaceSwitch: (view: WorkspaceView, context?: Partial<WorkspaceContext>) => void;
  onContextUpdate: (context: Partial<WorkspaceContext>) => void;
}

export default function LexSidebarUnified({
  workspaceState,
  onWorkspaceSwitch,
  onContextUpdate
}: LexSidebarUnifiedProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hey! I'm Lex, your career coach. What would you like to work on today? I can help you analyze job postings, tailor your resume, write cover letters, or plan your career path.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [lexResumeContext, setLexResumeContext] = useState<LexResumeContext | null>(null);
  const [resumeAnalysisContext, setResumeAnalysisContext] = useState<ResumeAnalysisContext | null>(null);
  const [isCheckingCompleteness, setIsCheckingCompleteness] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [savingRevision, setSavingRevision] = useState(false);
  const [previewRevisionText, setPreviewRevisionText] = useState<string | null>(null);
  const [importingBuilderDraft, setImportingBuilderDraft] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastModeRef = useRef<WorkspaceView | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  const suppressModeMessageRef = useRef(false);
  const currentIntentRef = useRef<LexPromptPayload['intent']>(undefined);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const currentMode = workspaceState.currentView;
    if (!lastModeRef.current) {
      lastModeRef.current = currentMode;
      return;
    }

    if (lastModeRef.current === currentMode) return;
    lastModeRef.current = currentMode;

    if (suppressModeMessageRef.current) {
      suppressModeMessageRef.current = false;
      return;
    }

    const modeLabel = modeLabelMap[currentMode] || 'General';
    const prompt = modePromptMap[currentMode] || 'How do you want to proceed?';

    setMessages((prev) => [
      ...prev,
      {
        id: `mode-${Date.now()}`,
        role: 'assistant',
        content: `Mode: ${modeLabel}`,
        timestamp: new Date(),
        kind: 'mode'
      },
      {
        id: `mode-prompt-${Date.now() + 1}`,
        role: 'assistant',
        content: prompt,
        timestamp: new Date()
      }
    ]);
  }, [workspaceState.currentView]);

  useEffect(() => {
    if (workspaceState.currentView !== 'assessment') return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant?.content) return;

    const phase = detectAssessmentPhase(lastAssistant.content);
    if (phase && phase !== workspaceState.context.assessmentPhase) {
      onContextUpdate({ assessmentPhase: phase });
    }
  }, [messages, workspaceState.currentView, workspaceState.context.assessmentPhase, onContextUpdate]);

  useEffect(() => {
    let isActive = true;

    const checkCompleteness = async () => {
      if (workspaceState.currentView !== 'assessment') return;
      const userMessageCount = messages.filter((m) => m.role === 'user').length;
      if (userMessageCount < 5) {
        if (isActive) setMissingFields([]);
        return;
      }

      setIsCheckingCompleteness(true);
      try {
        const response = await fetch('/api/career-assessment/check-completeness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationMessages: messages.map((m) => ({
              role: m.role,
              content: m.content
            }))
          })
        });

        const data = await response.json();
        if (!isActive) return;
        if (data?.success) {
          setMissingFields(data.missingFields || []);
        }
      } catch (error) {
        if (isActive) {
          setMissingFields(['missing_data_check_failed']);
        }
      } finally {
        if (isActive) setIsCheckingCompleteness(false);
      }
    };

    checkCompleteness();

    return () => {
      isActive = false;
    };
  }, [messages, workspaceState.currentView]);

  useEffect(() => {
    let isActive = true;

    const loadResumeContext = async () => {
      try {
        const resumeId = workspaceState.context.selectedResumeId;
        const query = resumeId ? `?resumeId=${resumeId}` : '';
        const response = await fetch(`/api/lex/resume-context${query}`);
        const data = await response.json();

        if (!isActive) return;

        const resumeContext = data?.resumeContext;
        const resume = resumeContext?.masterResume || resumeContext?.currentResume;

        if (!resume) {
          setLexResumeContext({ hasResume: false });
          return;
        }

        const resumeScore = data?.allResumes?.find((entry: any) => entry.id === resume.id)?.score;

        setLexResumeContext({
          hasResume: true,
          masterResume: {
            id: resume.id,
            fileName: resume.fileName,
            score: resumeScore ?? undefined
          }
        });
      } catch (error) {
        if (isActive) {
          setLexResumeContext({ hasResume: false });
        }
      }
    };

    loadResumeContext();

    return () => {
      isActive = false;
    };
  }, [workspaceState.context.selectedResumeId]);

  // Load detailed resume analysis context (including quote-level feedback) when resumeId changes
  useEffect(() => {
    let isActive = true;

    const loadResumeAnalysisContext = async () => {
      const resumeId = workspaceState.context.selectedResumeId;
      if (!resumeId) {
        setResumeAnalysisContext(null);
        return;
      }

      try {
        const response = await fetch(`/api/resumes/${resumeId}`);
        const data = await response.json();
        if (!isActive || !data?.success || !data?.resume) return;

        const automatedAnalysis = data.resume.automatedAnalysis || {};
        const resumeQuotes = Array.isArray(automatedAnalysis.resumeQuotes)
          ? automatedAnalysis.resumeQuotes
          : [];
        const recommendations = Array.isArray(automatedAnalysis.recommendations)
          ? automatedAnalysis.recommendations
          : [];

        setResumeAnalysisContext({
          resumeId,
          fileName: data.resume.fileName,
          overallScore: automatedAnalysis.overallScore,
          resumeQuotes: resumeQuotes.slice(0, 12),
          recommendations: recommendations.slice(0, 8),
        });
      } catch (error) {
        if (isActive) {
          setResumeAnalysisContext(null);
        }
      }
    };

    loadResumeAnalysisContext();

    return () => {
      isActive = false;
    };
  }, [workspaceState.context.selectedResumeId]);

  const sendLexMessage = useCallback(async (prompt: string, options?: { displayPrompt?: string }) => {
    const trimmed = prompt.trim();
    if (!trimmed || isTyping) return;

    const intentForRequest = currentIntentRef.current;
    const displayPrompt = options?.displayPrompt?.trim() || trimmed;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: displayPrompt,
      timestamp: new Date(),
      intent: intentForRequest
    };

    const nextMessages = [...messagesRef.current, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);

    try {
      const intendedWorkspace =
        intentForRequest === 'recruiter-review' || intentForRequest === 'quote-review'
          ? null
          : detectWorkspaceIntent(trimmed);

      const sessionTypeMap: Record<WorkspaceView, string> = {
        'dashboard': 'general',
        'job-analysis': 'job-discussion',
        'tailor': 'resume-tailoring',
        'cover-letter': 'cover-letter',
        'assessment': 'career-assessment',
        'applications': 'general',
        'resume-manager': 'general',
        'resume-builder': 'resume-tailoring'
      };

      const sessionType = sessionTypeMap[workspaceState.currentView] || 'general';

      const requestMessages = [
        ...messagesRef.current,
        {
          id: userMsg.id,
          role: 'user' as const,
          content: trimmed,
          timestamp: userMsg.timestamp,
          intent: intentForRequest
        }
      ];

      const response = await fetch('/api/lex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestMessages.map((m) => ({
            sender: m.role === 'user' ? 'user' : 'lex',
            text: m.content,
            timestamp: m.timestamp.toISOString()
          })),
          sessionType,
          resumeContext: lexResumeContext?.hasResume ? lexResumeContext : undefined,
          resumeAnalysisContext: resumeAnalysisContext || undefined,
          intent: intentForRequest,
          jobContext: workspaceState.context.selectedJobId
            ? { jobId: workspaceState.context.selectedJobId }
            : undefined
        })
      });

      const data = await response.json();

      if (intendedWorkspace && intendedWorkspace !== workspaceState.currentView) {
        onWorkspaceSwitch(intendedWorkspace);
      }

        const lexMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data?.response?.text || data?.message || data?.content || "I'm here to help with your career work.",
          timestamp: new Date(),
          intent: intentForRequest
        };

        setMessages((prev) => [...prev, lexMsg]);

        if (intentForRequest === 'recruiter-review' && workspaceState.context.selectedResumeId) {
          const suggestions = parseRecruiterReviewSuggestions(lexMsg.content);
          if (suggestions.length > 0) {
            dispatchRecruiterReview({
              resumeId: workspaceState.context.selectedResumeId,
              suggestions
            });
          }
        }
        if (intentForRequest === 'quote-review' && workspaceState.context.selectedResumeId) {
          dispatchQuoteReview({
            resumeId: workspaceState.context.selectedResumeId,
            response: lexMsg.content,
            timestamp: lexMsg.timestamp.toISOString()
          });
        }
      } catch (error) {
        console.error('Lex error:', error);
        setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date()
        }
      ]);
    } finally {
      currentIntentRef.current = undefined;
      setIsTyping(false);
    }
  }, [
    isTyping,
    workspaceState.currentView,
    workspaceState.context.selectedJobId,
    lexResumeContext,
    resumeAnalysisContext,
    onWorkspaceSwitch,
  ]);

  const handleSend = async () => {
    await sendLexMessage(input);
  };

  useEffect(() => {
    const handleExternalPrompt = (payload: LexPromptPayload) => {
      suppressModeMessageRef.current = true;
      currentIntentRef.current = payload.intent;
      if (payload.workspace && payload.workspace !== workspaceState.currentView) {
        onWorkspaceSwitch(payload.workspace, {
          selectedResumeId: payload.resumeId,
          selectedJobId: payload.jobId,
        });
      }

      if (payload.resumeId || payload.jobId) {
        onContextUpdate({
          selectedResumeId: payload.resumeId,
          selectedJobId: payload.jobId,
        });
      }

      const promptToSend = payload.intent === 'recruiter-review'
        ? [
            payload.prompt,
            "",
            "Important instructions:",
            "- This is a general recruiter review to improve the overall resume score, not job tailoring.",
            "- Do not tell the user to use Tailor Resume.",
            "- Provide exactly 3 risks, then 3 before/after rewrites drawn from their resume, then a short next-steps checklist.",
            "- Label the final checklist section as 'NEXT STEPS' (do not mention Resume Builder).",
            "- Do not mention Resume Builder or any other tools in the response.",
            "- Do NOT return a full rewritten resume.",
          ].join("\n")
        : payload.intent === 'quote-review'
        ? [
            payload.prompt,
            "",
            "Important instructions:",
            "- Use the quote-level feedback context provided. If limited, still proceed without mentioning missing data.",
            "- Provide exactly 3 prioritized quote-level fixes.",
            "- Use this exact format:",
            "QUOTE-LEVEL PRIORITIES",
            "1) Issue: ...",
            "   Original: \"...\"",
            "   Rewrite:  \"...\"",
            "2) Issue: ...",
            "   Original: \"...\"",
            "   Rewrite:  \"...\"",
            "3) Issue: ...",
            "   Original: \"...\"",
            "   Rewrite:  \"...\"",
            "",
            "WHY THESE FIRST",
            "- ...",
            "- ...",
            "",
            "NEXT ACTIONS",
            "- ...",
            "- ...",
            "- ...",
            "- Do not ask follow-up questions.",
            "- Do not mention Resume Builder or any other tool.",
          ].join("\n")
        : payload.prompt;

      const displayPrompt = payload.intent === 'recruiter-review'
        ? "Reviewing your resume now…"
        : payload.intent === 'quote-review'
        ? "Reviewing quote-level feedback…"
        : payload.prompt;

      void sendLexMessage(promptToSend, { displayPrompt });
    };

    return subscribeToLexPrompts(handleExternalPrompt);
  }, [workspaceState.currentView, onWorkspaceSwitch, onContextUpdate, sendLexMessage]);

  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const showGeneratePlan = workspaceState.currentView === 'assessment' && userMessageCount >= 5;
  const canGeneratePlan = showGeneratePlan && missingFields.length === 0 && !isCheckingCompleteness;

  const handleGeneratePlan = async () => {
    if (isGeneratingPlan) return;
    setIsGeneratingPlan(true);
    try {
      const response = await fetch('/api/career-assessment/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationMessages: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          resumeId: workspaceState.context.selectedResumeId || null
        })
      });

      const data = await response.json();
      if (data?.success && data?.assessment?.id) {
        router.push(`/career-studio/assessment/results?id=${data.assessment.id}`);
      }
    } catch (error) {
      console.error('Generate plan error:', error);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveRevision = useCallback(async (revisedText: string) => {
    const sourceResumeId = workspaceState.context.selectedResumeId;
    if (!sourceResumeId || savingRevision) return;

    setSavingRevision(true);
    try {
      const response = await fetch('/api/resumes/lex-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceResumeId,
          revisedText,
        }),
      });

      const data = await response.json();
      if (!data?.success || !data?.resume?.id) {
        return;
      }

      const newResumeId = data.resume.id as string;
      onContextUpdate({ selectedResumeId: newResumeId });
      onWorkspaceSwitch('resume-manager', { selectedResumeId: newResumeId });
      dispatchResumeUpdated({ resumeId: newResumeId });

      setMessages((prev) => [
        ...prev,
        {
          id: `lex-save-${Date.now()}`,
          role: 'assistant',
          content: `Saved as a new version: ${data.resume.fileName}`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Save Lex revision error:', error);
    } finally {
      setSavingRevision(false);
    }
  }, [workspaceState.context.selectedResumeId, savingRevision, onContextUpdate, onWorkspaceSwitch]);

  const handleImportToBuilder = useCallback(async () => {
    const resumeId = workspaceState.context.selectedResumeId;
    if (!resumeId || importingBuilderDraft) return;
    setImportingBuilderDraft(true);
    setImportError(null);

    try {
      const response = await fetch('/api/resume-builder/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId })
      });
      const data = await response.json();
      if (!data?.success || !data?.resume?.id) {
        throw new Error(data?.error || 'Import failed');
      }
      onContextUpdate({ selectedResumeId: data.resume.id });
      onWorkspaceSwitch('resume-builder', { selectedResumeId: data.resume.id });
    } catch (error: any) {
      console.error('Import to resume builder failed:', error);
      setImportError(error?.message || 'Failed to create resume builder draft');
    } finally {
      setImportingBuilderDraft(false);
    }
  }, [workspaceState.context.selectedResumeId, importingBuilderDraft, onContextUpdate, onWorkspaceSwitch]);

  return (
    <div className="h-full min-h-0 w-full flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#9333EA]/30 to-[#DB2777]/30 rounded-full flex items-center justify-center border border-[#9333EA]/30">
            <Bot className="w-5 h-5 text-[#C084FC]" />
          </div>
          <div>
            <h3 className="text-white/90 font-semibold text-sm">Lex</h3>
            <p className="text-[#C084FC]/80 text-xs">Your Career Coach</p>
          </div>
        </div>

        {/* Current workspace indicator */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Active:</span>
          <span className="px-2 py-0.5 bg-[#9333EA]/10 border border-[#9333EA]/30 rounded text-[10px] text-[#C084FC]">
            {workspaceState.currentView.replace('-', ' ')}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const revisionText = msg.role === 'assistant' ? extractResumeRevision(msg.content) : null;
          const canSaveRevision =
            Boolean(revisionText && workspaceState.context.selectedResumeId) &&
            msg.intent !== 'recruiter-review';
          const showBuilderButton =
            msg.intent === 'recruiter-review' && Boolean(workspaceState.context.selectedResumeId);

          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
            {msg.kind === 'mode' ? (
              <div className="max-w-[85%] rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                {msg.content}
              </div>
            ) : (
              <div
                className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-[#9333EA]/20 border border-[#9333EA]/30 text-white/90'
                    : 'bg-white/[0.05] border border-white/[0.08] text-white/80'
                }`}
              >
                {msg.role === 'assistant' && msg.content.length > 600 ? (
                  <details className="group">
                    <summary className="cursor-pointer text-[11px] text-white/60 uppercase tracking-[0.2em] mb-2">
                      Show full response
                    </summary>
                    <p className="leading-relaxed whitespace-pre-wrap text-white/80">
                      {msg.content}
                    </p>
                  </details>
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
                <p className="text-[10px] opacity-50 mt-1.5">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {showBuilderButton && importError && (
                  <div className="mt-2 text-[10px] text-red-300">{importError}</div>
                )}
                {canSaveRevision && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewRevisionText(revisionText)}
                      className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition"
                    >
                      Preview Updated Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveRevision(revisionText)}
                      disabled={savingRevision}
                      className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition disabled:opacity-60"
                    >
                      {savingRevision ? 'Saving…' : 'Save As New Resume Version'}
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-[#9333EA] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#DB2777] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#0891B2] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {workspaceState.currentView === 'dashboard' && (
            <>
              <QuickAction onClick={() => onWorkspaceSwitch('job-analysis')}>
                Analyze a job
              </QuickAction>
              <QuickAction onClick={() => onWorkspaceSwitch('assessment')}>
                Career assessment
              </QuickAction>
            </>
          )}
          {workspaceState.currentView === 'job-analysis' && (
            <>
              <QuickAction onClick={() => onWorkspaceSwitch('tailor')}>
                Tailor resume
              </QuickAction>
              <QuickAction onClick={() => onWorkspaceSwitch('cover-letter')}>
                Write cover letter
              </QuickAction>
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/[0.08] flex-shrink-0">
        {showGeneratePlan && (
          <>
            <button
              onClick={handleGeneratePlan}
              disabled={isGeneratingPlan || !canGeneratePlan}
              className="w-full mb-3 px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white/80 text-xs uppercase tracking-[0.2em] hover:bg-white/10 transition disabled:opacity-50"
            >
              {isGeneratingPlan
                ? 'Generating Plan...'
                : isCheckingCompleteness
                ? 'Checking Completeness...'
                : 'Generate Career Plan'}
            </button>
            {!canGeneratePlan && !isCheckingCompleteness && (
              <div className="text-[10px] text-white/50 mb-3 space-y-2">
                <div>Complete all assessment fields before generating a plan.</div>
                {missingFields.length > 0 && missingFields[0] !== 'missing_data_check_failed' && (
                  <div className="text-white/40">
                    Missing: {missingFields.map((field) => missingFieldLabels[field] || field).join(', ')}
                  </div>
                )}
                {missingFields[0] === 'missing_data_check_failed' && (
                  <div className="text-white/40">
                    Could not verify completeness. Send one more message and try again.
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Lex anything..."
            rows={1}
            className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:ring-1 focus:ring-[#9333EA]/50 focus:border-[#9333EA]/50 resize-none"
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="px-3 py-2 bg-[#9333EA] hover:bg-[#7E22CE] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {previewRevisionText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-white/10 bg-[#0b1020] text-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div className="text-sm font-semibold text-white/90">Preview Updated Resume</div>
              <button
                type="button"
                onClick={() => setPreviewRevisionText(null)}
                className="px-2 py-1 rounded border border-white/15 text-xs text-white/70 hover:text-white hover:bg-white/5 transition"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4">
              <pre className="whitespace-pre-wrap text-[12px] leading-5 text-white/90">
                {previewRevisionText}
              </pre>
            </div>

            <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewRevisionText(null)}
                className="px-3 py-1.5 rounded border border-white/15 text-xs text-white/70 hover:text-white hover:bg-white/5 transition"
              >
                Keep Original
              </button>
              <button
                type="button"
                onClick={() => {
                  const textToSave = previewRevisionText;
                  setPreviewRevisionText(null);
                  if (textToSave) {
                    void handleSaveRevision(textToSave);
                  }
                }}
                disabled={savingRevision}
                className="px-3 py-1.5 rounded border border-white/15 bg-white/5 text-xs text-white/90 hover:bg-white/10 transition disabled:opacity-60"
              >
                {savingRevision ? 'Saving…' : 'Save As New Version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function extractResumeRevision(content: string): string | null {
  const markerMatch = content.match(/---BEGIN RESUME---\s*([\s\S]*?)\s*---END RESUME---/i);
  if (markerMatch?.[1]) {
    return markerMatch[1].trim();
  }

  const fencedMatch = content.match(/```(?:resume|text)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1] && fencedMatch[1].trim().length > 400) {
    return fencedMatch[1].trim();
  }

  return null;
}

function parseRecruiterReviewSuggestions(content: string): Array<{ before: string; after: string }> {
  const suggestions: Array<{ before: string; after: string }> = [];
  const normalized = content.replace(/\r/g, '');
  const lines = normalized.split('\n');

  let pendingBefore: string | null = null;

  const cleanValue = (value: string) =>
    value
      .trim()
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^\-+\s*/, '')
      .trim();

  const normalizeLine = (line: string) =>
    line
      .trim()
      .replace(/^\d+\)?\.?\s*/, '')
      .replace(/^\-\s*/, '')
      .replace(/\*\*/g, '')
      .trim();

  const tryExtractInline = (line: string): { before?: string; after?: string } | null => {
    const inlineMatch = line.match(/before\s*:\s*(.+?)\s*after\s*:\s*(.+)$/i);
    if (inlineMatch) {
      return { before: cleanValue(inlineMatch[1]), after: cleanValue(inlineMatch[2]) };
    }
    return null;
  };

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    if (!line) continue;

    const inline = tryExtractInline(line);
    if (inline?.before && inline.after) {
      suggestions.push({ before: inline.before, after: inline.after });
      pendingBefore = null;
      continue;
    }

    const beforeMatch = line.match(/^before\s*:\s*(.+)$/i);
    if (beforeMatch) {
      pendingBefore = cleanValue(beforeMatch[1]);
      continue;
    }

    const afterMatch = line.match(/^after\s*:\s*(.+)$/i);
    if (afterMatch && pendingBefore) {
      const after = cleanValue(afterMatch[1]);
      if (pendingBefore && after) {
        suggestions.push({ before: pendingBefore, after });
      }
      pendingBefore = null;
      continue;
    }
  }

  return suggestions;
}

// Quick action button component
function QuickAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded text-[10px] text-white/60 hover:text-white/80 transition-colors"
    >
      {children}
    </button>
  );
}

function detectAssessmentPhase(text: string): number | null {
  const content = text.toLowerCase();

  const matches = [
    {
      phase: 1,
      keywords: ['current role', 'current job', 'energy', 'drain', 'energize', 'what drains', 'what energizes']
    },
    {
      phase: 2,
      keywords: ['past', 'best', 'worst', 'pattern', 'highlight', 'low point']
    },
    {
      phase: 3,
      keywords: ['non-negotiable', 'compensation', 'salary', 'location', 'company stage', 'boundaries']
    },
    {
      phase: 4,
      keywords: ['vision', '18-month', 'target title', 'impact', 'ideal day', 'daily work']
    },
    {
      phase: 5,
      keywords: ['market', 'roles match', 'target companies', 'admire', 'role model']
    },
    {
      phase: 6,
      keywords: ['gap', 'skill gap', 'experience gap', 'positioning', 'missing']
    }
  ];

  for (const entry of matches) {
    if (entry.keywords.some((keyword) => content.includes(keyword))) {
      return entry.phase;
    }
  }

  return null;
}

const modeLabelMap: Record<WorkspaceView, string> = {
  'dashboard': 'Dashboard',
  'job-analysis': 'Job Analysis',
  'tailor': 'Resume Tailoring',
  'cover-letter': 'Cover Letter',
  'assessment': 'Career Assessment',
  'applications': 'Applications',
  'resume-manager': 'Resume Manager',
  'resume-builder': 'Resume Builder'
};

const modePromptMap: Record<WorkspaceView, string> = {
  'dashboard': 'What do you want to work on right now?',
  'job-analysis': 'Paste a job posting or tell me which one to analyze.',
  'tailor': 'Which role are we tailoring for?',
  'cover-letter': 'What role and company is this cover letter for?',
  'assessment': 'Ready to start the assessment? Begin with your current role and what drains or energizes you.',
  'applications': 'Which application do you want to review or update?',
  'resume-manager': 'Upload a resume or pick one to review.',
  'resume-builder': 'Do you want to build a new resume or edit an existing one?'
};

const missingFieldLabels: Record<string, string> = {
  current_role_title: 'current role/title',
  energy_drains: 'energy drains',
  energy_gains: 'energy gains',
  compensation_minimum: 'compensation minimum',
  compensation_target: 'compensation target',
  location_preference: 'location preference',
  company_stage_preference: 'company stage',
  target_title: 'target title',
  ideal_daily_work: 'ideal daily work',
  impact_goal: 'impact goal',
  skill_gaps: 'skill gaps',
  experience_gaps: 'experience gaps'
};
