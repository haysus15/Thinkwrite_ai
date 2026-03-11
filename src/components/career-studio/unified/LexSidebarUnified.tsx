// Lex Sidebar - Unified Career Studio
// src/components/career-studio/unified/LexSidebarUnified.tsx

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Send, Sparkles } from 'lucide-react';
import LexConversationModal, { type LexSaveMessage } from '@/components/lex/shared/LexConversationModal';
import { WorkspaceState, WorkspaceView, WorkspaceContext } from '@/types/career-studio-workspace';
import { detectWorkspaceIntent } from '@/lib/career-studio/workspaceManager';
import {
  subscribeToLexPrompts,
  dispatchResumeUpdated,
  dispatchRecruiterReview,
  dispatchQuoteReview,
  dispatchStrategySummary,
  type LexPromptPayload,
} from '@/lib/career-studio/lexBus';
import BlendConsentModal from '@/components/mirror-mode/BlendConsentModal';

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
  const [guardrails, setGuardrails] = useState<{
    sufficientData: boolean;
    warnings: string[];
    blendRequired?: boolean;
    blendDenied?: string[];
    primaryChamber?: string;
  } | null>(null);
  const [showBlendConsent, setShowBlendConsent] = useState(false);
  const [voiceSources, setVoiceSources] = useState<string[]>([]);
  const [voiceUpdateNotice, setVoiceUpdateNotice] = useState<string | null>(null);
  const [sessionTypeOverride, setSessionTypeOverride] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastModeRef = useRef<WorkspaceView | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  const suppressModeMessageRef = useRef(false);
  const currentIntentRef = useRef<LexPromptPayload['intent']>(undefined);
  const pendingSummaryRef = useRef<LexPromptPayload['contextTag'] | null>(null);
  const pendingSummaryMetaRef = useRef<{ resumeId?: string; jobId?: string } | null>(null);
  const assessmentPromptedRef = useRef(false);
  const coverLetterStrategyRef = useRef(false);
  const coverLetterStrategyMetaRef = useRef<{ resumeId?: string; jobId?: string } | null>(null);

  const saveMessages: LexSaveMessage[] = messages.map((m) => ({
    id: m.id,
    sender: m.role === 'assistant' ? 'lex' : 'user',
    text: m.content,
    timestamp: m.timestamp,
    context: m.kind === 'mode' ? 'mode' : 'text',
  }));

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

  const currentSessionType = sessionTypeMap[workspaceState.currentView] || 'general';

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!voiceUpdateNotice) return;
    const timer = window.setTimeout(() => setVoiceUpdateNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [voiceUpdateNotice]);

  useEffect(() => {
    if (!coverLetterStrategyRef.current) return;
    if (messages.length === 0) return;
    const payload = {
      resumeId: coverLetterStrategyMetaRef.current?.resumeId,
      jobId: coverLetterStrategyMetaRef.current?.jobId,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp?.toISOString?.() || undefined,
      })),
    };
    try {
      sessionStorage.setItem('lexCoverLetterStrategy', JSON.stringify(payload));
    } catch (err) {
      console.warn('Unable to store cover letter strategy conversation', err);
    }
  }, [messages]);

  const fetchGuardrails = useCallback(async () => {
    try {
      const response = await fetch('/api/voice-profile/gatekeeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesting_studio: 'career',
          context: workspaceState.currentView,
          requested_chambers: ['career', 'general', 'overall'],
        }),
      });
      const data = await response.json();
      if (data?.mirror?.captured) {
        setVoiceUpdateNotice("Mirror Mode updated from your latest message.");
      }
      if (data?.warnings && data?.sufficient_data !== undefined) {
        setGuardrails({
          sufficientData: Boolean(data.sufficient_data),
          warnings: data.warnings || [],
          blendRequired: Boolean(data?.blend?.required),
          blendDenied: data?.blend?.denied || [],
          primaryChamber: data?.voice_profile?.primary_chamber || null,
        });
        const sources: string[] = [];
        const primaryLabel = data?.voice_profile?.primary_chamber;
        if (primaryLabel) sources.push(primaryLabel);
        if (data?.voice_profile?.general) sources.push('general');
        if (data?.voice_profile?.overall) sources.push('overall');
        setVoiceSources(sources);
      }
    } catch {
      setGuardrails(null);
      setVoiceSources([]);
    }
  }, [workspaceState.currentView]);

  useEffect(() => {
    fetchGuardrails();
  }, [fetchGuardrails]);

  const handleApproveBlend = async () => {
    if (!guardrails?.blendDenied?.length || !guardrails.primaryChamber) return;
    try {
      await Promise.all(
        guardrails.blendDenied.map((from) =>
          fetch("/api/mirror-mode/consent/blending", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from_chamber: from,
              to_chamber: guardrails.primaryChamber,
              scope: "session",
              expires_in_days: 1,
            }),
          })
        )
      );
      setGuardrails((prev) =>
        prev
          ? {
              ...prev,
              blendRequired: false,
              blendDenied: [],
            }
          : prev
      );
      fetchGuardrails();
    } catch {
      // Silent fail
    }
  };

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

        const analysisSummary = data.resume.analysisSummary || {};
        const keyPoints = data.resume.keyPoints || {};
        const analysisResults = data.resume.analysisResults || null;
        const automatedAnalysis = data.resume.automatedAnalysis || analysisSummary || {};
        const resumeQuotes = Array.isArray(analysisResults?.resumeQuotes)
          ? analysisResults.resumeQuotes
          : Array.isArray(automatedAnalysis.resumeQuotes)
          ? automatedAnalysis.resumeQuotes
          : Array.isArray(keyPoints.resumeQuotes)
          ? keyPoints.resumeQuotes
          : [];
        const recommendations = Array.isArray(analysisResults?.recommendations)
          ? analysisResults.recommendations
          : Array.isArray(automatedAnalysis.recommendations)
          ? automatedAnalysis.recommendations
          : Array.isArray(analysisSummary.recommendations)
          ? analysisSummary.recommendations
          : [];

        const nextContext = {
          resumeId,
          fileName: data.resume.fileName,
          overallScore:
            analysisResults?.overallScore ||
            automatedAnalysis.overallScore ||
            analysisSummary.overallScore,
          resumeQuotes: resumeQuotes.slice(0, 12),
          recommendations: recommendations.slice(0, 8),
        };

        if (process.env.NODE_ENV !== 'production') {
          console.log('[LexSidebar] resumeAnalysisContext', {
            resumeId,
            resumeQuotes: nextContext.resumeQuotes?.length || 0,
            recommendations: nextContext.recommendations?.length || 0,
            hasAnalysisSummary: Boolean(analysisSummary && Object.keys(analysisSummary).length),
            hasKeyPoints: Boolean(keyPoints && Object.keys(keyPoints).length),
          });
        }

        setResumeAnalysisContext(nextContext);
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

  const sendLexMessage = useCallback(async (
    prompt: string,
    options?: {
      displayPrompt?: string;
      contextOverride?: { resumeId?: string; jobId?: string };
      sessionTypeOverride?: string;
      silent?: boolean;
      captureForMirror?: boolean;
    }
  ) => {
    const trimmed = prompt.trim();
    if (!trimmed || isTyping) return;

    const intentForRequest = currentIntentRef.current;
    const displayPrompt = options?.displayPrompt?.trim() || trimmed;
    const silent = Boolean(options?.silent);
    const captureForMirror = options?.captureForMirror ?? !silent;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: displayPrompt,
      timestamp: new Date(),
      intent: intentForRequest
    };

    if (!silent) {
      const nextMessages = [...messagesRef.current, userMsg];
      setMessages(nextMessages);
      setInput('');
    }
    setIsTyping(true);

    try {
      const intendedWorkspace =
        currentIntentRef.current
          ? null
          : intentForRequest === 'recruiter-review' || intentForRequest === 'quote-review'
          ? null
          : detectWorkspaceIntent(trimmed);

      const sessionType =
        options?.sessionTypeOverride ||
        sessionTypeOverride ||
        currentSessionType ||
        'general';
      const overrideJobId = options?.contextOverride?.jobId;

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
          jobContext: overrideJobId
            ? { jobId: overrideJobId }
            : workspaceState.context.selectedJobId
            ? { jobId: workspaceState.context.selectedJobId }
            : undefined,
          captureForMirror
        })
      });

      const data = await response.json();

      if (intendedWorkspace && intendedWorkspace !== workspaceState.currentView) {
        onWorkspaceSwitch(intendedWorkspace);
      }

        const rawContent = data?.response?.text || data?.message || data?.content || "I'm here to help with your career work.";
        let panelContent = rawContent;
        let chatContent = rawContent;

        if (pendingSummaryRef.current === 'application-final-review') {
          const split = rawContent.split(/CHAT SUMMARY:/i);
          if (split.length > 1) {
            panelContent = split[0].replace(/PANEL REVIEW:/i, '').trim();
            chatContent = split.slice(1).join('CHAT SUMMARY:').trim();
          } else {
            panelContent = rawContent;
            chatContent = rawContent;
          }
        }

        const lexMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: chatContent,
          timestamp: new Date(),
          intent: intentForRequest
        };

        setMessages((prev) => [...prev, lexMsg]);

        if (pendingSummaryRef.current) {
          dispatchStrategySummary({
            resumeId: pendingSummaryMetaRef.current?.resumeId,
            jobId: pendingSummaryMetaRef.current?.jobId,
            text: pendingSummaryRef.current === 'application-final-review' ? panelContent : lexMsg.content,
            contextTag: pendingSummaryRef.current
          });
          pendingSummaryRef.current = null;
          pendingSummaryMetaRef.current = null;
        }

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
    sessionTypeOverride,
  ]);

  useEffect(() => {
    if (workspaceState.currentView !== 'assessment') return;
    if (assessmentPromptedRef.current) return;
    const userCount = messages.filter((m) => m.role === 'user').length;
    if (userCount > 0) return;

    if (!lexResumeContext) return;

    if (!lexResumeContext.hasResume) {
      assessmentPromptedRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: `lex-assessment-no-resume-${Date.now()}`,
          role: 'assistant',
          content:
            "I don’t have your resume loaded yet. Open Resume Manager, set your master resume, then come back here and I’ll start the assessment.",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const resumeName = lexResumeContext.masterResume?.fileName;
    const opening = resumeName
      ? `I reviewed your resume (${resumeName}).`
      : `Let's get started.`;

    assessmentPromptedRef.current = true;
    void sendLexMessage(
      `You are Lex. Start the career assessment now. Say: "${opening} Let's start the career assessment." Then ask the current reality check question: "What's your current role, and what drains you vs. what brings out your best?"`,
      { sessionTypeOverride: 'career-assessment', silent: true, captureForMirror: false }
    );
  }, [workspaceState.currentView, messages, lexResumeContext, sendLexMessage]);

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

      if (payload.contextTag === 'tailor-strategy' || payload.contextTag === 'tailor-edit-passes') {
        pendingSummaryRef.current = payload.contextTag;
        pendingSummaryMetaRef.current = { resumeId: payload.resumeId, jobId: payload.jobId };
      }
      if (payload.contextTag === 'application-final-review') {
        pendingSummaryRef.current = payload.contextTag;
        pendingSummaryMetaRef.current = { resumeId: payload.resumeId, jobId: payload.jobId };
      }
      if (payload.contextTag === 'cover-letter-strategy') {
        coverLetterStrategyRef.current = true;
        coverLetterStrategyMetaRef.current = { resumeId: payload.resumeId, jobId: payload.jobId };
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

      const displayPrompt = payload.displayPrompt
        ? payload.displayPrompt
        : payload.intent === 'recruiter-review'
        ? "Reviewing your resume now…"
        : payload.intent === 'quote-review'
        ? "Reviewing quote-level feedback…"
        : payload.prompt;

      const sessionTypeOverride =
        payload.contextTag === 'tailor-strategy' ||
        payload.contextTag === 'tailor-edit-passes' ||
        payload.contextTag === 'tailor-debrief'
          ? 'resume-tailoring'
          : payload.contextTag === 'cover-letter-strategy'
          ? 'cover-letter'
          : payload.contextTag === 'application-final-review'
          ? 'general'
          : undefined;
      void sendLexMessage(promptToSend, {
        displayPrompt,
        contextOverride: { resumeId: payload.resumeId, jobId: payload.jobId },
        sessionTypeOverride,
        captureForMirror: false
      });
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
          content: data?.mirror?.captured
            ? `Saved as a new version: ${data.resume.fileName}. Mirror Mode also learned from this revision.`
            : `Saved as a new version: ${data.resume.fileName}`,
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
      if (data?.mirror?.captured) {
        setVoiceUpdateNotice("Mirror Mode updated from the imported resume.");
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
    <div className="h-full min-h-0 w-full flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1020]/40">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/[0.04] rounded-full flex items-center justify-center border border-white/10">
              <Bot className="w-5 h-5 text-white/80" />
            </div>
            <div>
              <h3 className="text-white/90 font-medium text-sm">Lex</h3>
              <p className="text-white/50 text-xs">Your Career Coach</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/40">
            <span className="uppercase tracking-[0.2em]">Active</span>
            <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/60 uppercase tracking-[0.2em]">
              {workspaceState.currentView.replace('-', ' ')}
            </span>
            <span className="ml-1 uppercase tracking-[0.2em]">Voice</span>
            {(voiceSources.length > 0 ? voiceSources : ['standard']).map((source) => (
              <span
                key={source}
                className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/60 uppercase tracking-[0.2em]"
              >
                {source}
              </span>
            ))}
          </div>
          <LexConversationModal
            messages={saveMessages}
            topic={workspaceState.currentView}
            context={{
              sessionType: sessionTypeOverride || currentSessionType,
              workspaceView: workspaceState.currentView,
              resumeId: workspaceState.context.selectedResumeId,
              jobId: workspaceState.context.selectedJobId
            }}
            onLoad={({ messages: loaded, context }) => {
              const mapped: Message[] = loaded.map((msg, idx) => ({
                id: msg.id || `loaded-${idx}-${Date.now()}`,
                role: msg.sender === 'lex' ? 'assistant' : 'user',
                content: msg.text,
                timestamp: new Date(msg.timestamp),
                kind: msg.context === 'mode' ? 'mode' : undefined,
              }));
              const shouldNudgeResume = Boolean(context?.sessionType);
              const modeNudge =
                context?.sessionType === 'career-assessment'
                  ? "Welcome back. Let’s continue your career assessment. Pick up from your last answer and we’ll move to the next phase."
                  : context?.sessionType === 'resume-tailoring'
                  ? "Welcome back. Let’s continue tailoring this resume. Start where you left off."
                  : context?.sessionType === 'cover-letter'
                  ? "Welcome back. Let’s continue your cover letter strategy. Pick up from your last answer."
                  : context?.sessionType === 'job-discussion'
                  ? "Welcome back. Let’s continue breaking down this job. Start where you left off."
                  : context?.sessionType === 'match-analysis'
                  ? "Welcome back. Let’s continue the match analysis. Pick up from your last answer."
                  : "Welcome back. Let’s continue where we left off.";
              const withNudge = shouldNudgeResume
                ? [
                    ...mapped,
                    {
                      id: `lex-assessment-resume-${Date.now()}`,
                      role: 'assistant' as const,
                      content: modeNudge,
                      timestamp: new Date(),
                    },
                  ]
                : mapped;
              setMessages(withNudge);
              if (context?.sessionType) {
                setSessionTypeOverride(context.sessionType);
              } else {
                setSessionTypeOverride(null);
              }
              if (context?.workspaceView && context.workspaceView !== workspaceState.currentView) {
                onWorkspaceSwitch(context.workspaceView as WorkspaceView);
              }
              if (context?.resumeId || context?.jobId) {
                onContextUpdate({
                  selectedResumeId: context.resumeId,
                  selectedJobId: context.jobId
                });
              }
            }}
            triggerLabel="Save Chat"
            triggerClassName="career-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
          />
        </div>

        {guardrails && guardrails.blendRequired && (
          <div className="mt-2 rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-2 text-[11px] text-purple-100">
            Cross-chamber blending needs explicit consent.
            <div className="mt-1 text-[10px] text-purple-100/80">
              Ursie will only blend voices when you say yes.
            </div>
            <a
              href="/mirror-mode"
              className="mt-2 inline-flex text-[10px] uppercase tracking-[0.2em] text-purple-100/80 underline underline-offset-4"
            >
              Open Mirror Mode
            </a>
            <button
              type="button"
              onClick={() => setShowBlendConsent(true)}
              className="mt-2 w-full rounded-md border border-purple-300/40 bg-purple-500/20 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-purple-100 hover:bg-purple-500/30"
            >
              Review consent
            </button>
          </div>
        )}
        {voiceUpdateNotice && (
          <div className="mt-2 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
            {voiceUpdateNotice}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-5">
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
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-white/[0.08] text-white/90'
                  : 'bg-white/[0.04] text-white/80'
              }`}
            >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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
                      className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-white/70 hover:bg-white/10 transition"
                    >
                      Preview Updated Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveRevision(revisionText)}
                      disabled={savingRevision}
                      className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-white/70 hover:bg-white/10 transition disabled:opacity-60"
                    >
                      {savingRevision ? 'Saving…' : 'Save As New Resume Version'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] rounded-2xl px-4 py-3">
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

      {showBlendConsent && guardrails?.blendDenied?.length && guardrails.primaryChamber && (
        <BlendConsentModal
          fromChambers={guardrails.blendDenied}
          toChamber={guardrails.primaryChamber}
          onClose={() => setShowBlendConsent(false)}
          onApprove={async () => {
            await handleApproveBlend();
            setShowBlendConsent(false);
          }}
        />
      )}

      {/* Quick Actions */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="flex flex-wrap gap-2">
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
      <div className="p-4 border-t border-white/[0.06] flex-shrink-0">
        {showGeneratePlan && (
          <>
            <button
              onClick={handleGeneratePlan}
              disabled={isGeneratingPlan || !canGeneratePlan}
              className="career-btn-primary w-full mb-3 px-3 py-2 rounded-lg text-xs uppercase tracking-[0.2em] disabled:opacity-50"
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
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Lex anything..."
            rows={2}
            className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="h-[42px] px-4 rounded-xl bg-white/[0.12] text-white/90 hover:bg-white/[0.16] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
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
