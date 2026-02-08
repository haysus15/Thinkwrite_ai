"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import {
  dispatchLexPrompt,
  dispatchResumeUpdated,
  subscribeToResumeUpdated,
  subscribeToRecruiterReview,
  subscribeToQuoteReview,
  type RecruiterReviewSuggestion,
} from "@/lib/career-studio/lexBus";
import type { WorkspaceContext } from "@/types/career-studio-workspace";
import { useResumeManagerPanel } from "./ResumeManagerPanelContext";

/* ============================================================
   TYPES
============================================================ */

interface Resume {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
  isMasterResume: boolean;
  analysisResults?: AnalysisResults;
  fileSize: number;
  analysisStatus: "pending" | "analyzing" | "complete" | "error";
  hasLegacyAnalysis?: boolean;
}

interface AnalysisResults {
  overallScore: number;
  scoreBreakdown: {
    formatting: CategoryScore;
    keywords: CategoryScore;
    content: CategoryScore;
    atsCompatibility: CategoryScore;
  };
  recommendations: Recommendation[];
  hrPerspective: HRPerspective;
  resumeQuotes?: ResumeQuote[];
  educationalInsights?: EducationalInsight[];
  ruleIssues?: RuleIssue[];
}

function parseQuoteLevelSuggestions(response: string): RecruiterReviewSuggestion[] {
  const suggestions: RecruiterReviewSuggestion[] = [];
  const normalized = response.replace(/\r/g, "");
  const regex = /Original:\s*\"([\s\S]*?)\"\s*Rewrite:\s*\"([\s\S]*?)\"/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized))) {
    const before = match[1].trim();
    const after = match[2].trim();
    if (before && after) {
      suggestions.push({ before, after });
    }
  }

  if (suggestions.length > 0) return suggestions;

  const fallbackRegex = /Original:\s*([^\n]+)\s*\n\s*Rewrite:\s*([^\n]+)/gi;
  while ((match = fallbackRegex.exec(normalized))) {
    const before = match[1].replace(/^\"|\"$/g, "").trim();
    const after = match[2].replace(/^\"|\"$/g, "").trim();
    if (before && after) {
      suggestions.push({ before, after });
    }
  }

  return suggestions;
}

interface ResumeQuote {
  originalText: string;
  context: string;
  issue: string;
  suggestedImprovement: string;
  category: string;
}

interface EducationalInsight {
  topic: string;
  explanation: string;
  yourExample?: string;
  betterExample?: string;
  lexTip?: string;
}

interface CategoryScore {
  score: number;
  maxScore: number;
  level: "excellent" | "good" | "needs_improvement" | "poor";
  explanation: string;
  whyItMatters: string;
  specificIssues: string[];
  positivePoints: string[];
  examplesFromResume: string[];
  deductions?: Array<{ reason: string; points: number }>;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  issue: string;
  solution: string;
  impact: string;
  currentExample?: string;
  improvedExample?: string;
}

interface RuleIssue {
  severity: "high" | "medium" | "low";
  category: "structure" | "format" | "verbiage" | "impact" | "ats";
  issue: string;
  evidence?: string;
  recommendation?: string;
}

interface HRPerspective {
  firstImpression: string;
  likelyOutcome: "will_advance" | "maybe_advance" | "unlikely_advance";
  overallAssessment: string;
  specificConcerns?: string[];
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

interface ResumeManagerProps {
  onContextUpdate?: (context: Partial<WorkspaceContext>) => void;
}

function buildStrictResumeHeader(resumeText: string) {
  return [
    "You are Lex. STRICT MODE:",
    "- Only use facts and wording that appear in the resume text below.",
    "- Do not invent, infer, or add any new facts.",
    "- Every issue must include a direct verbatim quote from the resume.",
    "- If you cannot find a quote, say \"No supported quote\" and skip that item.",
    "",
    "RESUME TEXT (source of truth):",
    "---BEGIN RESUME---",
    resumeText.trim(),
    "---END RESUME---",
    ""
  ].join("\n");
}

export default function ResumeManagerPage({ onContextUpdate }: ResumeManagerProps) {
  const { user, loading: authLoading } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [originalResumeText, setOriginalResumeText] = useState("");
  const [draftResumeText, setDraftResumeText] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [reviewSuggestions, setReviewSuggestions] = useState<
    Array<RecruiterReviewSuggestion & { id: string; accepted: boolean; applied: boolean }>
  >([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<
    Array<RecruiterReviewSuggestion & { id: string; accepted: boolean; applied: boolean }>
  >([]);
  const [reviewSource, setReviewSource] = useState<"recruiter" | "quote" | null>(null);
  const [quoteReviewResponse, setQuoteReviewResponse] = useState<string | null>(null);
  const [quoteReviewLoading, setQuoteReviewLoading] = useState(false);
  const [rightPanelActive, setRightPanelActive] = useState(false);
  const [openDraftEditorSignal, setOpenDraftEditorSignal] = useState(0);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 240;
    const saved = window.localStorage.getItem("resumeManager.leftWidth");
    return saved ? Number(saved) : 240;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setPanel } = useResumeManagerPanel();

  // Derived values - must be defined before useEffects that reference them
  const masterResume = resumes.find((resume) => resume.isMasterResume);
  const selectedResume = selectedResumeId
    ? resumes.find((r) => r.id === selectedResumeId)
    : masterResume || resumes[0] || null;

  const selectResume = useCallback(
    (resumeId: string) => {
      setSelectedResumeId(resumeId);
      onContextUpdate?.({ selectedResumeId: resumeId });
    },
    [onContextUpdate]
  );

  const sendResumeLexPrompt = useCallback(
    (prompt: string, intent: "general" | "recruiter-review" | "quote-review" = "general") => {
      if (!selectedResume) {
        setToastVisible(true);
        window.setTimeout(() => setToastVisible(false), 1400);
        return;
      }
      setRightPanelActive(true);
      if (intent === "quote-review") {
        setReviewSource("quote");
        setReviewSuggestions([]);
        setAppliedSuggestions([]);
      }
      if (intent === "recruiter-review") {
        setReviewSource("recruiter");
      }
      dispatchLexPrompt({
        prompt,
        workspace: "resume-manager",
        resumeId: selectedResume.id,
        intent,
      });
      if (intent === "quote-review") {
        setQuoteReviewLoading(true);
        setQuoteReviewResponse(null);
      }
      setToastVisible(true);
      window.setTimeout(() => setToastVisible(false), 1400);
    },
    [selectedResume]
  );

  const handleToggleSuggestion = useCallback((id: string, accepted: boolean) => {
    setReviewSuggestions((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, accepted } : item
      )
    );
  }, []);

  const handleOpenFullChat = useCallback(() => {
    const scoredQuotes = selectedResume?.analysisResults?.resumeQuotes || [];
    const formatted = scoredQuotes
      .map(
        (quote, index) =>
          `${index + 1}) ${quote.issue}\nOriginal: "${quote.originalText}"\nRewrite: "${quote.suggestedImprovement}"`
      )
      .join("\n\n");

    const prompt = scoredQuotes.length && originalResumeText
      ? [
          buildStrictResumeHeader(originalResumeText),
          "Use ONLY the scored quote-level priorities below.",
          "Do not invent new issues or rewrites. Keep the same originals and rewrites.",
          "Return each item in this exact format:",
          "1) Issue: ...",
          "Quote: \"<verbatim from resume>\"",
          "Suggested rewrite: \"<use the provided rewrite>\"",
          "",
          "SCORDED QUOTE-LEVEL PRIORITIES:",
          formatted
        ].join("\n")
      : "No scored quote-level priorities or resume text available. Ask the user to run analysis first.";

    sendResumeLexPrompt(prompt, "quote-review");
  }, [sendResumeLexPrompt, selectedResume?.analysisResults?.resumeQuotes, originalResumeText]);

  const handleRecruiterReview = useCallback(
    () =>
      sendResumeLexPrompt(
        originalResumeText
          ? [
              buildStrictResumeHeader(originalResumeText),
              "Review this resume like a recruiter and list the top 3 risks.",
              "Do NOT return a full resume. Only list issues and suggested edits.",
              "For each item, output in this exact format:",
              "1) Issue: ...",
              "Quote: \"<verbatim from resume>\"",
              "Before: \"<verbatim line or bullet from resume>\"",
              "After: \"<rewrite using only facts already in resume>\""
            ].join("\n")
          : "Resume text not available. Ask the user to re-run analysis.",
        "recruiter-review"
      ),
    [sendResumeLexPrompt, originalResumeText]
  );

  const handleExplainScore = useCallback(
    () =>
      sendResumeLexPrompt(
        originalResumeText
          ? [
              buildStrictResumeHeader(originalResumeText),
              "Explain my score like an HR manager and tell me what to fix first.",
              "Provide up to 3 fixes. For each:",
              "Issue: ...",
              "Quote: \"<verbatim from resume>\"",
              "Suggested rewrite: \"<rewrite using only facts already in resume>\""
            ].join("\n")
          : "Resume text not available. Ask the user to re-run analysis."
      ),
    [sendResumeLexPrompt, originalResumeText]
  );

  const handleFixBullets = useCallback(
    () =>
      sendResumeLexPrompt(
        originalResumeText
          ? [
              buildStrictResumeHeader(originalResumeText),
              "Find my weakest bullets and rewrite up to 2 to be clearer or more impact-focused.",
              "Do not add new facts or metrics.",
              "For each:",
              "Issue: ...",
              "Quote: \"<verbatim from resume>\"",
              "Suggested rewrite: \"<rewrite using only facts already in resume>\""
            ].join("\n")
          : "Resume text not available. Ask the user to re-run analysis."
      ),
    [sendResumeLexPrompt, originalResumeText]
  );

  const handleExplainResumeWideIssues = useCallback(() => {
    const issues = selectedResume?.analysisResults?.ruleIssues || [];
    const formatted = issues
      .map(
        (issue, index) =>
          `${index + 1}) [${issue.severity.toUpperCase()} · ${issue.category.toUpperCase()}] ${issue.issue}` +
          (issue.evidence ? `\nEvidence: ${issue.evidence}` : "") +
          (issue.recommendation ? `\nRecommendation: ${issue.recommendation}` : "")
      )
      .join("\n\n");

    const prompt = issues.length && originalResumeText
      ? [
          buildStrictResumeHeader(originalResumeText),
          "Explain each resume-wide issue below in plain language and teach the user how to fix it.",
          "Provide 1-2 concrete edits per issue that they can apply in the draft.",
          "For each issue, include:",
          "Issue: ...",
          "Quote: \"<verbatim from resume>\"",
          "Suggested rewrite: \"<rewrite using only facts already in resume>\"",
          "",
          "RESUME-WIDE ISSUES:",
          formatted
        ].join("\n")
      : "There are no resume-wide issues or resume text yet. Ask the user to run analysis first.";

    sendResumeLexPrompt(prompt, "general");
  }, [sendResumeLexPrompt, selectedResume?.analysisResults?.ruleIssues, originalResumeText]);

  const handleFixResumeWideIssues = useCallback(() => {
    const issues = selectedResume?.analysisResults?.ruleIssues || [];
    const formatted = issues
      .map(
        (issue, index) =>
          `${index + 1}) [${issue.severity.toUpperCase()} · ${issue.category.toUpperCase()}] ${issue.issue}` +
          (issue.evidence ? `\nEvidence: ${issue.evidence}` : "") +
          (issue.recommendation ? `\nRecommendation: ${issue.recommendation}` : "")
      )
      .join("\n\n");

    const prompt = issues.length && originalResumeText
      ? [
          buildStrictResumeHeader(originalResumeText),
          "Apply fixes for the resume-wide issues below. Provide exact edits and call out where to apply them.",
          "If an issue needs more data, ask a specific question instead of guessing.",
          "For each issue, include:",
          "Issue: ...",
          "Quote: \"<verbatim from resume>\"",
          "Before: \"<verbatim line or bullet from resume>\"",
          "After: \"<rewrite using only facts already in resume>\"",
          "",
          "RESUME-WIDE ISSUES:",
          formatted
        ].join("\n")
      : "There are no resume-wide issues or resume text yet. Ask the user to run analysis first.";

    sendResumeLexPrompt(prompt, "general");
  }, [sendResumeLexPrompt, selectedResume?.analysisResults?.ruleIssues, originalResumeText]);

  const handleOpenDraftEditor = useCallback(() => {
    setRightPanelActive(true);
    setOpenDraftEditorSignal((prev) => prev + 1);
  }, []);

  const handleDraftChange = useCallback((value: string) => {
    setDraftResumeText(value);
    setDraftDirty(true);
  }, []);

  const handleResetDraft = useCallback(() => {
    setDraftResumeText(originalResumeText);
    setDraftDirty(false);
  }, [originalResumeText]);

  const handleJumpToScoredQuotes = useCallback(() => {
    if (typeof document === "undefined") return;
    const target = document.getElementById("scored-quote-priorities");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const loadResumes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/resumes`);
      const data = await response.json();

      if (data.success) {
        setResumes(data.resumes);
        if (data.masterResume && !selectedResumeId) {
          selectResume(data.masterResume.id);
        }
      } else {
        setError(data.error || "Failed to load resumes");
      }
    } catch (error) {
      console.error("Error loading resumes:", error);
      setError("Failed to load resumes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResumes();
  }, []);

  useEffect(() => {
    return subscribeToResumeUpdated(({ resumeId }) => {
      loadResumes();
      onContextUpdate?.({ selectedResumeId: resumeId });
      setSelectedResumeId(resumeId);
    });
  }, [onContextUpdate]);

  useEffect(() => {
    return subscribeToRecruiterReview(({ resumeId, suggestions }) => {
      if (!selectedResume || selectedResume.id !== resumeId) return;
      const normalized = suggestions.map((s, index) => ({
        id: `${resumeId}-${index}`,
        before: s.before,
        after: s.after,
        accepted: true,
        applied: false,
      }));
      setReviewSource("recruiter");
      setReviewSuggestions(normalized);
    });
  }, [selectedResume]);

  useEffect(() => {
    return subscribeToQuoteReview(({ resumeId, response }) => {
      if (!selectedResume || selectedResume.id !== resumeId) return;
      setQuoteReviewResponse(response);
      setQuoteReviewLoading(false);
      const parsed = parseQuoteLevelSuggestions(response);
      if (parsed.length > 0) {
        const normalized = parsed.map((s, index) => ({
          id: `${resumeId}-quote-${index}`,
          before: s.before,
          after: s.after,
          accepted: true,
          applied: false,
        }));
        setReviewSource("quote");
        setReviewSuggestions(normalized);
      }
    });
  }, [selectedResume]);

  useEffect(() => {
    if (!originalResumeText || reviewSuggestions.length === 0) {
      setAppliedSuggestions([]);
      return;
    }

    let updated = originalResumeText;
    const nextSuggestions = reviewSuggestions.map((suggestion) => {
      if (!suggestion.accepted) {
        return { ...suggestion, applied: false };
      }

      if (suggestion.before && updated.includes(suggestion.before)) {
        updated = updated.replace(suggestion.before, suggestion.after);
        return { ...suggestion, applied: true };
      }

      return { ...suggestion, applied: false };
    });

    setDraftResumeText(updated);
    setDraftDirty(true);
    setAppliedSuggestions(nextSuggestions);
  }, [originalResumeText, reviewSuggestions]);

  useEffect(() => {
    if (!selectedResume?.id) {
      setOriginalResumeText("");
      setDraftResumeText("");
      setDraftDirty(false);
      setReviewSuggestions([]);
      setReviewSource(null);
      setQuoteReviewResponse(null);
      setQuoteReviewLoading(false);
      return;
    }

    const loadRaw = async () => {
      try {
        const response = await fetch(`/api/resumes/${selectedResume.id}`);
        const data = await response.json();
        if (data?.success && data?.resume) {
          const rawText =
            data.resume.extractedText ||
            data.resume.fullText ||
            data.resume.automatedAnalysis?.extractedText ||
            "";
          setOriginalResumeText(rawText);
          setDraftSaveError(null);
          setDraftDirty(false);
          setDraftResumeText(rawText);
          setReviewSuggestions([]);
          setReviewSource(null);
          setQuoteReviewResponse(null);
          setQuoteReviewLoading(false);
        }
      } catch (err) {
        console.error("Failed to load resume text:", err);
      }
    };

    loadRaw();
  }, [selectedResume?.id]);

  const handleFileUpload = async (files: FileList) => {
      if (!files.length) return;

      const file = files[0];
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ];

      if (!allowedTypes.includes(file.type)) {
        alert("Please upload a PDF, Word document, or text file.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/resumes", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          setResumes((prev) => [data.resume, ...prev]);
          if (data.resume.isMasterResume) {
            selectResume(data.resume.id);
          }
          alert(data.message);
        } else {
          throw new Error(data.details || data.error || "Upload failed");
        }
      } catch (error) {
        console.error("Error uploading resume:", error);
        setError(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
  };

  const reAnalyzeResume = async (resumeId: string) => {
    setIsReanalyzing(resumeId);
    try {
      const response = await fetch("/api/resumes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });

      const data = await response.json();

      if (data.success) {
        await loadResumes();
        alert(`Re-analysis complete! Score: ${data.score}/100`);
      } else {
        throw new Error(data.error || "Re-analysis failed");
      }
    } catch (error) {
      console.error("Error re-analyzing resume:", error);
      alert("Re-analysis failed. Please try again.");
    } finally {
      setIsReanalyzing(null);
    }
  };

  const handleSaveDraft = useCallback(async () => {
    if (!selectedResume?.id || !draftResumeText.trim()) return;
    setDraftSaving(true);
    setDraftSaveError(null);
    try {
      const response = await fetch("/api/resumes/lex-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceResumeId: selectedResume.id,
          revisedText: draftResumeText,
          fileName: `${selectedResume.fileName || "Resume"} (Draft)`,
        }),
      });
      const data = await response.json();
      if (!data?.success || !data?.resume?.id) {
        throw new Error(data?.error || "Failed to save draft");
      }
      dispatchResumeUpdated({ resumeId: data.resume.id });
      setDraftDirty(false);
    } catch (err: any) {
      console.error("Save draft failed:", err);
      setDraftSaveError(err?.message || "Failed to save draft");
    } finally {
      setDraftSaving(false);
    }
  }, [selectedResume?.id, selectedResume?.fileName, draftResumeText]);

  const panelData = useMemo(
    () => ({
      active: rightPanelActive,
      openDraftEditorSignal,
      quoteReviewLoading,
      quoteReviewResponse,
      reviewSource,
      scoredQuoteCount: selectedResume?.analysisResults?.resumeQuotes?.length || 0,
      ruleIssues: selectedResume?.analysisResults?.ruleIssues || [],
      appliedSuggestions,
      onToggleSuggestion: handleToggleSuggestion,
      onOpenFullChat: handleOpenFullChat,
      onRecruiterReview: handleRecruiterReview,
      onExplainScore: handleExplainScore,
      onFixBullets: handleFixBullets,
      onJumpToScoredQuotes: handleJumpToScoredQuotes,
      onExplainResumeWideIssues: handleExplainResumeWideIssues,
      onFixResumeWideIssues: handleFixResumeWideIssues,
      originalResumeText,
      draftResumeText,
      draftDirty,
      draftSaving,
      draftSaveError,
      onDraftChange: handleDraftChange,
      onResetDraft: handleResetDraft,
      onSaveDraft: handleSaveDraft,
    }),
    [
      rightPanelActive,
      openDraftEditorSignal,
      quoteReviewLoading,
      quoteReviewResponse,
      reviewSource,
      appliedSuggestions,
      handleToggleSuggestion,
      handleOpenFullChat,
      handleRecruiterReview,
      handleExplainScore,
      handleFixBullets,
      handleJumpToScoredQuotes,
      handleExplainResumeWideIssues,
      handleFixResumeWideIssues,
      originalResumeText,
      draftResumeText,
      draftDirty,
      draftSaving,
      draftSaveError,
      handleDraftChange,
      handleResetDraft,
      handleSaveDraft,
    ]
  );

  const setMasterResume = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/resumes/${resumeId}/master`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        setResumes((prev) =>
          prev.map((resume) => ({
            ...resume,
            isMasterResume: resume.id === resumeId,
          }))
        );
        alert(data.message);
      } else {
        throw new Error(data.error || "Failed to set master resume");
      }
    } catch (error) {
      console.error("Error setting master resume:", error);
      alert("Failed to set master resume");
    }
  };

  const deleteResume = async (resumeId: string) => {
    const resumeToDelete = resumes.find((r) => r.id === resumeId);
    if (!resumeToDelete) return;

    if (
      !confirm(
        `Are you sure you want to delete "${resumeToDelete.fileName}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/resumes/${resumeId}/delete`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        setResumes((prev) =>
          prev.filter((resume) => resume.id !== resumeId)
        );
        if (selectedResumeId === resumeId) {
          setSelectedResumeId(null);
          onContextUpdate?.({ selectedResumeId: undefined });
        }
        alert(data.message);
      } else {
        throw new Error(data.error || "Failed to delete resume");
      }
    } catch (error) {
      console.error("Error deleting resume:", error);
      alert("Failed to delete resume");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files);
      }
  };

  const startResize = (side: "left") => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startLeft = leftWidth;

    const onMove = (evt: MouseEvent) => {
      const delta = evt.clientX - startX;
      if (side === "left") {
        const next = Math.min(420, Math.max(180, startLeft + delta));
        setLeftWidth(next);
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400";
    if (score >= 70) return "text-[#9333EA]";
    if (score >= 55) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreLevel = (score: number) => {
    if (score >= 85) return "EXCELLENT";
    if (score >= 70) return "GOOD";
    if (score >= 55) return "NEEDS WORK";
    return "POOR";
  };

  const getLikelyOutcomeColor = (
    outcome: HRPerspective["likelyOutcome"]
  ) => {
    if (outcome === "will_advance") return "text-emerald-400";
    if (outcome === "maybe_advance") return "text-[#9333EA]";
    return "text-red-400";
  };

  const selectedScore =
    selectedResume?.analysisResults?.overallScore ?? undefined;
  const ruleIssues = selectedResume?.analysisResults?.ruleIssues || [];
  const rulePenalty = ruleIssues.reduce((sum, issue) => {
    if (issue.severity === "high") return sum + 4;
    if (issue.severity === "medium") return sum + 2;
    return sum + 1;
  }, 0);
  const rulePenaltyBreakdown = ruleIssues.reduce(
    (acc, issue) => {
      acc[issue.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
  const baseScoreFromBreakdown =
    selectedResume?.analysisResults?.scoreBreakdown
      ? Object.values(selectedResume.analysisResults.scoreBreakdown).reduce(
          (sum, category) => sum + category.score,
          0
        )
      : 0;
  const computedFinalScore = Math.max(0, baseScoreFromBreakdown - rulePenalty);
  const ruleLosses = [...ruleIssues]
    .map((issue) => ({
      issue: issue.issue,
      severity: issue.severity,
      points: issue.severity === "high" ? 4 : issue.severity === "medium" ? 2 : 1,
    }))
    .sort((a, b) => b.points - a.points);
  const baseDeductions = selectedResume?.analysisResults?.scoreBreakdown
    ? Object.entries(selectedResume.analysisResults.scoreBreakdown).flatMap(
        ([key, category]) =>
          (category.deductions || []).map((deduction) => ({
            category: key,
            ...deduction,
          }))
      )
    : [];
  const topBaseDeductions = [...baseDeductions]
    .sort((a, b) => b.points - a.points)
    .slice(0, 6);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("resumeManager.leftWidth", String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("resumeManager.leftCollapsed", String(leftCollapsed));
  }, [leftCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLeft = window.localStorage.getItem("resumeManager.leftCollapsed");
    if (savedLeft !== null) setLeftCollapsed(savedLeft === "true");
  }, []);

  useEffect(() => {
    if (!setPanel) return;
    setPanel(panelData);
  }, [setPanel, panelData]);

  useEffect(() => {
    return () => setPanel(null);
  }, [setPanel]);

  /* ============================================================
     LOADING STATE
  ============================================================ */

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#9333EA] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/80 text-sm">
              Loading your resumes...
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  /* ============================================================
     MAIN RENDER
  ============================================================ */

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full border border-white/20 mx-auto mb-4" />
          <p className="text-white/60">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full border border-white/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Authentication Required</h2>
          <p className="text-white/60 mb-4">Please sign in to access Resume Manager.</p>
          <a
            href={getAuthRequiredUrl("/career-studio/dashboard?workspace=resume-manager")}
            className="inline-block px-6 py-3 bg-[#9333EA] text-white font-semibold rounded-lg hover:bg-[#7E22CE] transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <Shell>
      {/* Error Display */}
      {error && (
        <div className="mb-4">
          <div className="bg-red-500/15 border border-red-500/40 rounded-lg p-2 text-xs text-red-300 flex items-center justify-between">
            <span>
              <strong>Error:</strong> {error}
            </span>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-100"
            >
              
            </button>
          </div>
        </div>
      )}

      {/* Main layout with resizable panels */}
      <div className="flex gap-0">
        {/* LEFT: Resume Library */}
        {leftCollapsed ? (
          <div className="w-8 flex-shrink-0 flex items-center justify-center">
            <button
              onClick={() => setLeftCollapsed(false)}
              className="text-white/50 hover:text-white text-xs"
              title="Expand left panel"
            >
              →
            </button>
          </div>
        ) : (
          <section className="flex-shrink-0 space-y-3" style={{ width: leftWidth }}>
          {/* Upload card */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-white">
                My Resumes ({resumes.length})
              </h2>
              <button
                onClick={() => setLeftCollapsed(true)}
                className="text-white/50 hover:text-white text-xs"
                title="Collapse left panel"
              >
                ←
              </button>
            </div>
            <div
              className={`border border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
                dragActive
                  ? "border-[#9333EA] bg-[#9333EA]/5"
                  : "border-white/20 hover:border-white/40 bg-black/40"
              } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={(e) =>
                  e.target.files && handleFileUpload(e.target.files)
                }
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="text-white/70">
                  <div className="animate-spin w-6 h-6 border-2 border-[#9333EA] border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-[10px]">Analyzing...</p>
                </div>
              ) : (
                <div className="text-white/60">
                  <div className="text-2xl mb-1"></div>
                  <p className="text-[11px] font-medium">Drop resume here</p>
                  <p className="text-[9px] text-white/40 mt-0.5">
                    PDF, DOCX, TXT · Max 10MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Resume list */}
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-2 max-h-[400px] overflow-y-auto">
            <div className="space-y-1.5">
              {resumes.map((resume) => {
                const isSelected =
                  selectedResumeId === resume.id ||
                  (!selectedResumeId && resume.isMasterResume);

                return (
                  <div
                    key={resume.id}
                    role="button"
                    tabIndex={0}
                    className={`w-full text-left p-2 rounded-lg cursor-pointer transition-all border text-[10px] ${
                      isSelected
                        ? "bg-[#9333EA]/10 border-[#9333EA]/40"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    }`}
                    onClick={() => selectResume(resume.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectResume(resume.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <h3 className="text-white font-medium text-[11px] truncate">
                            {resume.fileName}
                          </h3>
                          {resume.isMasterResume && (
                            <span className="bg-[#9333EA] text-white text-[8px] px-1 py-0.5 rounded font-bold flex-shrink-0">
                              MASTER
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-white/40">
                          <span>
                            {new Date(
                              resume.uploadedAt
                            ).toLocaleDateString()}
                          </span>
                          {resume.analysisResults && (
                            <span
                              className={`font-semibold ${getScoreColor(
                                resume.analysisResults.overallScore
                              )}`}
                            >
                              {resume.analysisResults.overallScore}/100
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-1.5 text-[9px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          reAnalyzeResume(resume.id);
                        }}
                        disabled={isReanalyzing === resume.id}
                        className="text-white/50 hover:text-[#9333EA] disabled:opacity-50"
                      >
                        {isReanalyzing === resume.id ? "..." : "Re-analyze"}
                      </button>
                      {!resume.isMasterResume && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMasterResume(resume.id);
                          }}
                          className="text-white/50 hover:text-[#9333EA]"
                        >
                          Set Master
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteResume(resume.id);
                        }}
                        className="text-white/50 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}

              {resumes.length === 0 && (
                <div className="text-center text-white/40 py-6 text-[10px]">
                  <div className="text-2xl mb-1"></div>
                  <p>Upload your first resume</p>
                </div>
              )}
            </div>
          </div>
        </section>
        )}

        {!leftCollapsed && (
          <div
            className="w-1 cursor-col-resize bg-white/5 hover:bg-white/10 mx-2"
            onMouseDown={startResize("left")}
            title="Resize panels"
          />
        )}

        {/* MIDDLE: Analysis Canvas - Flexible */}
        <section className="flex-1 min-w-0 space-y-3">
          {selectedResume ? (
            <>
              {/* Resume header */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2 truncate">
                      {selectedResume.fileName}
                      {selectedResume.isMasterResume && (
                        <span className="bg-[#9333EA] text-white px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0">
                          MASTER
                        </span>
                      )}
                    </h2>
                    <p className="text-white/40 text-[10px] mt-0.5">
                      Uploaded{" "}
                      {new Date(
                        selectedResume.uploadedAt
                      ).toLocaleDateString()}{" "}
                      · {(selectedResume.fileSize / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={handleOpenDraftEditor}
                      className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-[11px] text-white/80 hover:bg-white/10 transition"
                    >
                      Open Draft Editor
                    </button>
                    <button
                      onClick={() => reAnalyzeResume(selectedResume.id)}
                      disabled={isReanalyzing === selectedResume.id}
                      className="bg-[#9333EA] hover:bg-violet-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
                    >
                      {isReanalyzing === selectedResume.id
                        ? "Analyzing..."
                        : " Re-run analysis"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Analysis content */}
              {selectedResume.analysisResults ? (
                <>
                  <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
                    <div className="text-[10px] text-white/60 mb-2">
                      Recruiter Review (Lex Suggestions · Not Scored)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={handleOpenFullChat}
                        className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition"
                      >
                        Quote-level review
                      </button>
                      <button
                        onClick={handleRecruiterReview}
                        className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition"
                      >
                        Recruiter review
                      </button>
                      <button
                        onClick={handleExplainScore}
                        className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition"
                      >
                        Explain score
                      </button>
                      <button
                        onClick={handleFixBullets}
                        className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition"
                      >
                        Fix bullets
                      </button>
                    </div>
                  </div>

                  {/* Score + HR row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Score card */}
                    <div
                      className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3"
                    >
                      <p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">
                        Overall Score
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-3xl font-semibold ${getScoreColor(
                            selectedResume.analysisResults.overallScore
                          )}`}
                        >
                          {selectedResume.analysisResults.overallScore}
                        </span>
                        <span className="text-white/50 text-sm">/100</span>
                      </div>
                      <p
                        className={`text-[10px] mt-0.5 font-semibold ${getScoreColor(
                          selectedResume.analysisResults.overallScore
                        )}`}
                      >
                        {getScoreLevel(
                          selectedResume.analysisResults.overallScore
                        )}
                      </p>
                      {selectedResume.analysisResults.resumeQuotes && (
                        <p className="text-[9px] text-[#9333EA] mt-2">
                          {" "}
                          {
                            selectedResume.analysisResults.resumeQuotes
                              .length
                          }{" "}
                          quote-level examples
                        </p>
                      )}
                      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2 text-[9px] text-white/60">
                        <div className="text-white/80 font-semibold mb-1">
                          How this score works
                        </div>
                        <div>
                          Base Score = Formatting + Keywords + Content + ATS
                        </div>
                        <div>
                          Rule Penalties = High (-4) · Medium (-2) · Low (-1)
                        </div>
                        <div>
                          Scoring comes from the analysis engine (not Lex chat)
                        </div>
                        <div>
                          Base Score (from breakdown): {baseScoreFromBreakdown}/100
                        </div>
                        <div>
                          Total Rule Penalty: -{rulePenalty} (High {rulePenaltyBreakdown.high}, Medium {rulePenaltyBreakdown.medium}, Low {rulePenaltyBreakdown.low})
                        </div>
                        <div>
                          Computed Final: {computedFinalScore}/100
                        </div>
                        <div>
                          Stored Final: {selectedResume.analysisResults.overallScore}/100
                        </div>
                        {computedFinalScore !== selectedResume.analysisResults.overallScore && (
                          <div className="text-[8px] text-amber-300 mt-1">
                            Note: Stored score differs from computed. Re-analyze to sync.
                          </div>
                        )}
                      </div>
                      {selectedResume.analysisResults.scoreBreakdown && (
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2 text-[9px] text-white/60">
                          <div className="text-white/80 font-semibold mb-2">
                            Base score breakdown
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(selectedResume.analysisResults.scoreBreakdown).map(
                              ([key, category]) => (
                                <div
                                  key={key}
                                  className="rounded border border-white/10 bg-black/20 p-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-white/70">
                                      {key === "formatting" && "Formatting"}
                                      {key === "keywords" && "Keywords"}
                                      {key === "content" && "Content"}
                                      {key === "atsCompatibility" && "ATS"}
                                    </span>
                                    <span className="text-white/80">
                                      {category.score}/{category.maxScore}
                                    </span>
                                  </div>
                                  <div className="text-[8px] text-white/40 line-clamp-2">
                                    {category.explanation}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                      {topBaseDeductions.length > 0 && (
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2 text-[9px] text-white/60">
                          <div className="text-white/80 font-semibold mb-2">
                            Why you lost base points
                          </div>
                          <div className="space-y-1">
                            {topBaseDeductions.map((deduction, index) => (
                              <div
                                key={`${deduction.category}-${deduction.reason}-${index}`}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="text-white/70">
                                  {deduction.reason}
                                </span>
                                <span className="text-white/50">
                                  -{deduction.points} ({deduction.category})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {ruleLosses.length > 0 && (
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2 text-[9px] text-white/60">
                          <div className="text-white/80 font-semibold mb-2">
                            Rule penalty breakdown
                          </div>
                          <div className="space-y-1">
                            {ruleLosses.map((issue, index) => (
                              <div key={`${issue.issue}-${index}`} className="flex items-center justify-between">
                                <span className="text-white/70">{issue.issue}</span>
                                <span className="text-white/50">
                                  -{issue.points} ({issue.severity.toUpperCase()})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* HR perspective */}
                    <div
                      className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3"
                    >
                      <h3 className="text-[11px] font-semibold text-white mb-1 flex items-center gap-1">
                         HR Manager&apos;s first impression
                      </h3>
                      <p className="text-white/70 text-[10px] leading-relaxed line-clamp-3">
                        &quot;
                        {
                          selectedResume.analysisResults.hrPerspective
                            .firstImpression
                        }
                        &quot;
                      </p>
                      <div className="flex items-center justify-between text-[9px] mt-2">
                        <span className="text-white/50">Likely outcome:</span>
                        <span
                          className={`font-semibold ${getLikelyOutcomeColor(
                            selectedResume.analysisResults.hrPerspective
                              .likelyOutcome
                          )}`}
                        >
                          {selectedResume.analysisResults.hrPerspective.likelyOutcome
                            .replace("_", " ")
                            .toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-[11px] font-semibold text-white">
                          Lex Quote-Level Review (Explains Scored Issues)
                        </h3>
                        <p className="text-[9px] text-white/40">
                          {selectedResume.analysisResults.resumeQuotes?.length
                            ? `Based on ${selectedResume.analysisResults.resumeQuotes.length} scored quote-level priorities.`
                            : "No scored quote-level priorities yet. Run analysis first."}
                        </p>
                      </div>
                      {quoteReviewLoading && (
                        <span className="text-[9px] text-white/40">Working…</span>
                      )}
                    </div>
                    {quoteReviewResponse ? (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-[10px] text-white/75 whitespace-pre-wrap max-h-[260px] overflow-y-auto">
                        {quoteReviewResponse}
                      </div>
                    ) : (
                      <div className="text-[9px] text-white/40">
                        Run “Quote-level review” to show Lex’s notes.
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {selectedResume.analysisResults.resumeQuotes?.length ? (
                        <button
                          onClick={handleJumpToScoredQuotes}
                          className="text-[9px] text-[#FFD37A] hover:text-white transition"
                        >
                          View scored quote-level priorities
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {ruleIssues.length > 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-[11px] font-semibold text-white">
                            Resume-wide issues
                          </h3>
                          <p className="text-[9px] text-white/40">
                            Global structure, ATS, and clarity problems detected
                          </p>
                        </div>
                        <span className="text-[9px] text-white/40">
                          {ruleIssues.length} issues
                        </span>
                      </div>
                      <div className="text-[9px] text-white/50 mb-2">
                        Penalties applied: -{rulePenalty} (High {rulePenaltyBreakdown.high}, Medium {rulePenaltyBreakdown.medium}, Low {rulePenaltyBreakdown.low})
                      </div>
                      <div className="space-y-2 max-h-[260px] overflow-y-auto">
                        {ruleIssues.map((issue, index) => (
                          <div
                            key={index}
                            className="bg-white/[0.02] rounded-lg p-2 border border-white/[0.06]"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="text-[10px] text-white/80 font-medium">
                                {issue.issue}
                              </div>
                              <span
                                className={`text-[8px] px-1.5 py-0.5 rounded ${
                                  issue.severity === "high"
                                    ? "bg-red-500/20 text-red-300"
                                    : issue.severity === "medium"
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-slate-500/20 text-slate-300"
                                }`}
                              >
                                {issue.severity.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[8px] text-white/40 mb-1">
                              <span>{issue.category.toUpperCase()} · GLOBAL ISSUE</span>
                            </div>
                            {issue.evidence && (
                              <div className="text-[9px] text-white/60 mb-1">
                                {issue.evidence}
                              </div>
                            )}
                            {issue.recommendation && (
                              <div className="text-[9px] text-white/70">
                                {issue.recommendation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          onClick={handleExplainResumeWideIssues}
                          className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition"
                        >
                          Explain issues
                        </button>
                        <button
                          onClick={handleFixResumeWideIssues}
                          className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition"
                        >
                          Fix issues
                        </button>
                      </div>
                    </div>
                  )}

                  {reviewSource === 'recruiter' && appliedSuggestions.length > 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
                      <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">
                        Recruiter Review Changes (Lex Suggestions)
                      </div>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto">
                        {appliedSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className="rounded-lg border border-white/10 bg-black/20 p-2 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-white/80">Before → After</div>
                              <label className="flex items-center gap-2 text-white/60 text-[10px]">
                                <input
                                  type="checkbox"
                                  checked={suggestion.accepted}
                                  onChange={(e) => handleToggleSuggestion(suggestion.id, e.target.checked)}
                                />
                                Accept
                              </label>
                            </div>
                            <div className="mt-1 text-white/50">
                              <div className="line-clamp-2">Before: {suggestion.before}</div>
                              <div className="line-clamp-2">After: {suggestion.after}</div>
                            </div>
                            {!suggestion.applied && suggestion.accepted && (
                              <div className="mt-1 text-[10px] text-yellow-300">
                                Could not auto-apply. You can paste this change manually.
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedResume.analysisResults.resumeQuotes && (
                    <div
                      id="scored-quote-priorities"
                      className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-[11px] font-semibold text-white">
                            Quote-level priorities (Scored · Source of Truth)
                          </h3>
                          <p className="text-[9px] text-white/40">
                            Directly tied to score deductions.
                          </p>
                        </div>
                        <span className="text-[9px] text-white/40">
                          {selectedResume.analysisResults.resumeQuotes.length} items
                        </span>
                      </div>
                      <div className="space-y-2 max-h-[260px] overflow-y-auto">
                        {selectedResume.analysisResults.resumeQuotes.map((quote, index) => (
                          <div
                            key={`${quote.issue}-${index}`}
                            className="bg-white/[0.02] rounded-lg p-2 border border-white/[0.06]"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="text-[10px] text-white/80 font-medium">
                                {index + 1}) {quote.issue}
                              </div>
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#9333EA]/20 text-[#9333EA]">
                                {quote.category.replace(/_/g, " ").toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[9px] text-white/60 mb-1">
                              Original: {quote.originalText}
                            </div>
                            <div className="text-[9px] text-white/70">
                              Rewrite: {quote.suggestedImprovement}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div
                    className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3"
                  >
                    <h3 className="text-[11px] font-semibold text-white mb-2">
                       Priority fixes (Scored)
                    </h3>
                    <p className="text-[9px] text-white/40 mb-2">
                      Scored recommendations from the analysis engine.
                    </p>
                    <div className="space-y-2">
                      {selectedResume.analysisResults.recommendations
                        .slice(0, 3)
                        .map((rec, index) => (
                          <div
                            key={index}
                            className="bg-white/[0.02] rounded-lg p-2 border border-white/[0.06]"
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold flex-shrink-0 ${
                                  rec.priority === "high"
                                    ? "bg-red-500/20 text-red-300"
                                    : rec.priority === "medium"
                                    ? "bg-[#9333EA]/20 text-[#9333EA]"
                                    : "bg-blue-500/20 text-blue-300"
                                }`}
                              >
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white text-[10px] font-medium">
                                  {rec.issue}
                                </h4>
                                <p className="text-[9px] text-white/50 mt-0.5 line-clamp-2">
                                  {rec.solution}
                                </p>
                              </div>
                              <span
                                className={`text-[8px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
                                  rec.priority === "high"
                                    ? "bg-red-500/20 text-red-300"
                                    : rec.priority === "medium"
                                    ? "bg-[#9333EA]/20 text-[#9333EA]"
                                    : "bg-blue-500/20 text-blue-300"
                                }`}
                              >
                                {rec.priority.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              ) : selectedResume.analysisStatus === "analyzing" ? (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-8 text-center">
                  <div className="w-10 h-10 border-4 border-[#9333EA] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <h3 className="text-white text-sm font-semibold">
                    Analyzing your resume...
                  </h3>
                  <p className="text-white/50 text-[11px] mt-1">
                    Lex is reading line-by-line
                  </p>
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-8 text-center">
                  <div className="text-3xl mb-2">️</div>
                  <h3 className="text-white text-sm font-semibold">
                    Analysis needed
                  </h3>
                  <p className="text-white/50 text-[11px] mt-1 mb-3">
                    Run analysis to see score and feedback
                  </p>
                  <button
                    onClick={() => reAnalyzeResume(selectedResume.id)}
                    className="bg-[#9333EA] hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-[11px] font-semibold"
                  >
                     Analyze resume
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-8 text-center">
              <div className="text-4xl mb-3"></div>
              <h2 className="text-white text-base font-semibold">
                Welcome to Resume Manager
              </h2>
              <p className="text-white/50 text-[11px] mt-2 max-w-md mx-auto">
                Upload a resume to get{" "}
                <span className="text-[#9333EA]">
                  score, HR perspective, and quote-level feedback
                </span>{" "}
                from Lex.
              </p>
            </div>
          )}
        </section>

        

      </div>

      {toastVisible && (
        <div className="fixed bottom-6 left-6 z-50 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[11px] text-white/85 shadow-lg backdrop-blur">
          Sent to Lex →
        </div>
      )}
    </Shell>
  );
}

/* ============================================================
   SHARED SHELL
============================================================ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full text-white">
      <div className="max-w-7xl mx-auto px-6 py-4">{children}</div>
    </div>
  );
}
