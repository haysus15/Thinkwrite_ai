"use client";

import React, {
  useState,
  useRef,
  useCallback,
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
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  issue: string;
  solution: string;
  impact: string;
  currentExample?: string;
  improvedExample?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = useCallback(
    async (files: FileList) => {
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
    },
    []
  );

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

  const handleSaveDraft = async () => {
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
  };

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

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files);
      }
    },
    [handleFileUpload]
  );

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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "weak_language":
        return "";
      case "missing_metrics":
        return "";
      case "passive_voice":
        return "";
      case "generic_description":
        return "";
      default:
        return "️";
    }
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

      {/* Main 3-panel layout - Fixed widths to prevent cutoff */}
      <div className="flex gap-4">
        {/* LEFT: Resume Library - Fixed width */}
        <section className="w-[240px] flex-shrink-0 space-y-3">
          {/* Upload card */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3">
            <h2 className="text-xs font-semibold text-white mb-2">
              My Resumes ({resumes.length})
            </h2>
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

                  <button
                    onClick={() => reAnalyzeResume(selectedResume.id)}
                    disabled={isReanalyzing === selectedResume.id}
                    className="bg-[#9333EA] hover:bg-violet-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {isReanalyzing === selectedResume.id
                      ? "Analyzing..."
                      : " Re-run analysis"}
                  </button>
                </div>
              </div>

              {/* Side-by-side recruiter review workspace */}
              {reviewSource === "recruiter" && originalResumeText && appliedSuggestions.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
                    <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">
                      Original Resume (Read-only)
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 max-h-[360px] overflow-auto p-2.5">
                      <pre className="whitespace-pre-wrap text-[11px] leading-5 text-white/85">
                        {originalResumeText}
                      </pre>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] uppercase tracking-wider text-white/40">
                        Draft (Editable)
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDraftResumeText(originalResumeText);
                            setDraftDirty(false);
                          }}
                          className="text-[10px] text-white/60 hover:text-white transition"
                        >
                          Reset Draft
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={draftSaving || !draftResumeText.trim()}
                          className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                        >
                          {draftSaving ? "Saving..." : "Save Draft"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={draftResumeText}
                      onChange={(e) => {
                        setDraftResumeText(e.target.value);
                        setDraftDirty(true);
                      }}
                      className="flex-1 min-h-[260px] max-h-[360px] rounded-lg border border-white/10 bg-black/20 p-2.5 text-[11px] text-white/90 placeholder-white/30 focus:outline-none focus:border-[#9333EA]/50"
                    />
                    {draftSaveError && (
                      <div className="text-[11px] text-red-300 mt-2">
                        {draftSaveError}
                      </div>
                    )}
                    {draftDirty && (
                      <div className="text-[10px] text-white/40 mt-1">
                        Unsaved changes
                      </div>
                    )}
                  </div>
                </div>
              ) : reviewSource === "recruiter" && originalResumeText ? (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 text-center text-[11px] text-white/50">
                  Run Recruiter Review to generate a side-by-side draft.
                </div>
              ) : reviewSource === "recruiter" ? (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 text-center text-[11px] text-white/50">
                  Resume text not available yet. Upload or re-analyze to enable draft editing.
                </div>
              ) : null}

              {reviewSource === "recruiter" && appliedSuggestions.length > 0 && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">
                    Lex Changes (Accept/Reject)
                  </div>
                  <div className="space-y-2">
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
                              onChange={(e) => {
                                setReviewSuggestions((prev) =>
                                  prev.map((item) =>
                                    item.id === suggestion.id
                                      ? { ...item, accepted: e.target.checked }
                                      : item
                                  )
                                );
                              }}
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

              {/* Lex guidance (routes into main Lex sidebar) */}
              <div className="career-card rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-white/90">
                      Lex Can Coach You On This Resume
                    </p>
                    <p className="text-[10px] text-white/50">
                      These prompts auto-send to the main Lex chat on the left.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() =>
                        sendResumeLexPrompt(
                          "Explain my score like an HR manager and tell me what to fix first."
                        )
                      }
                      disabled={!selectedResume}
                      className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Explain Score
                    </button>
                    <button
                      onClick={() =>
                        sendResumeLexPrompt(
                          "Find my weakest bullets and rewrite one to be metric-driven."
                        )
                      }
                      disabled={!selectedResume}
                      className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Fix Bullets
                    </button>
                    <button
                      onClick={() =>
                        sendResumeLexPrompt(
                          "Review this resume like a recruiter and list the top 3 risks. Then apply the fixes you recommend and return the complete updated resume.",
                          "recruiter-review"
                        )
                      }
                      className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Recruiter Review
                    </button>
                  </div>
                </div>
              </div>

              {/* Analysis content */}
              {selectedResume.analysisResults ? (
                <>
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

                  {/* Quotes Section */}
                  {selectedResume.analysisResults.resumeQuotes &&
                    selectedResume.analysisResults.resumeQuotes.length >
                      0 && (
                      <div
                        className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="text-[11px] font-semibold text-white">
                              Quote-level feedback
                            </h3>
                            <p className="text-[9px] text-white/40">
                              Real lines from your resume with stronger
                              versions
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              sendResumeLexPrompt(
                                "Review the quote-level feedback for this resume and prioritize the fixes. Walk me through the top issues and rewrite the riskiest bullets.",
                                "quote-review"
                              )
                            }
                            className="text-[9px] text-[#9333EA] hover:underline"
                          >
                            Open full chat →
                          </button>
                        </div>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                          {selectedResume.analysisResults.resumeQuotes
                            .slice(0, 4)
                            .map((quote, index) => (
                              <div
                                key={index}
                                className="bg-white/[0.02] rounded-lg p-2 border border-white/[0.06]"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="text-lg">
                                    {getCategoryIcon(quote.category)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <h4 className="text-white text-[10px] font-medium truncate">
                                        {quote.issue}
                                      </h4>
                                      <span className="text-[8px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded flex-shrink-0">
                                        {quote.category
                                          .replace("_", " ")
                                          .toUpperCase()}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <p className="text-[8px] text-white/40 mb-0.5">
                                           What you wrote
                                        </p>
                                        <p className="text-[9px] text-white/70 bg-red-500/10 border border-red-500/20 rounded p-1.5 line-clamp-2 max-h-[64px] overflow-hidden break-words whitespace-pre-wrap">
                                          &quot;{quote.originalText}&quot;
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[8px] text-white/40 mb-0.5">
                                           Stronger version
                                        </p>
                                        <p className="text-[9px] text-white/70 bg-emerald-500/10 border border-emerald-500/20 rounded p-1.5 line-clamp-2 max-h-[64px] overflow-hidden break-words whitespace-pre-wrap">
                                          &quot;
                                          {quote.suggestedImprovement}
                                          &quot;
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>

                        <div className="mt-3 border-t border-white/10 pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] font-semibold text-white/80">
                              Lex quote-level review
                            </h4>
                            {quoteReviewLoading && (
                              <span className="text-[9px] text-white/40">Working…</span>
                            )}
                          </div>
                          {quoteReviewResponse ? (
                            <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-[10px] text-white/75 whitespace-pre-wrap">
                              {quoteReviewResponse}
                            </div>
                          ) : (
                            <div className="text-[9px] text-white/40">
                              Run “Open full chat” to show Lex’s prioritized quote-level fixes here.
                            </div>
                          )}
                        </div>

                        {reviewSource === "quote" && originalResumeText && appliedSuggestions.length > 0 && (
                          <div className="mt-3 border-t border-white/10 pt-3">
                            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                              Quote-Level Draft (Editable)
                            </div>
                            <div className="grid gap-3 lg:grid-cols-2">
                              <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3">
                                <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">
                                  Original Resume (Read-only)
                                </div>
                                <div className="rounded-lg border border-white/10 bg-black/20 max-h-[320px] overflow-auto p-2.5">
                                  <pre className="whitespace-pre-wrap text-[11px] leading-5 text-white/85">
                                    {originalResumeText}
                                  </pre>
                                </div>
                              </div>

                              <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3 flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-[11px] uppercase tracking-wider text-white/40">
                                    Draft (Editable)
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDraftResumeText(originalResumeText);
                                        setDraftDirty(false);
                                      }}
                                      className="text-[10px] text-white/60 hover:text-white transition"
                                    >
                                      Reset Draft
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleSaveDraft}
                                      disabled={draftSaving || !draftResumeText.trim()}
                                      className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                                    >
                                      {draftSaving ? "Saving..." : "Save Draft"}
                                    </button>
                                  </div>
                                </div>
                                <textarea
                                  value={draftResumeText}
                                  onChange={(e) => {
                                    setDraftResumeText(e.target.value);
                                    setDraftDirty(true);
                                  }}
                                  className="flex-1 min-h-[220px] max-h-[320px] rounded-lg border border-white/10 bg-black/20 p-2.5 text-[11px] text-white/90 placeholder-white/30 focus:outline-none focus:border-[#9333EA]/50"
                                />
                                {draftSaveError && (
                                  <div className="text-[11px] text-red-300 mt-2">
                                    {draftSaveError}
                                  </div>
                                )}
                                {draftDirty && (
                                  <div className="text-[10px] text-white/40 mt-1">
                                    Unsaved changes
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">
                                Lex Changes (Accept/Reject)
                              </div>
                              <div className="space-y-2">
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
                                          onChange={(e) => {
                                            setReviewSuggestions((prev) =>
                                              prev.map((item) =>
                                                item.id === suggestion.id
                                                  ? { ...item, accepted: e.target.checked }
                                                  : item
                                              )
                                            );
                                          }}
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
                          </div>
                        )}
                      </div>
                    )}

                  {/* Score breakdown */}
                  <div
                    className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3"
                  >
                    <h3 className="text-[11px] font-semibold text-white mb-2">
                       Scoring breakdown
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(
                        selectedResume.analysisResults.scoreBreakdown
                      ).map(([key, category]) => {
                        const pct =
                          (category.score / category.maxScore) * 100;
                        return (
                          <div
                            key={key}
                            className="bg-white/[0.02] rounded-lg p-2 border border-white/[0.06]"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-white text-[10px] font-medium">
                                {key === "formatting" && " Formatting"}
                                {key === "keywords" && " Keywords"}
                                {key === "content" && " Content"}
                                {key === "atsCompatibility" && " ATS"}
                              </h4>
                              <span
                                className={`text-[10px] font-semibold ${getScoreColor(
                                  pct
                                )}`}
                              >
                                {category.score}/{category.maxScore}
                              </span>
                            </div>
                            <p className="text-[9px] text-white/50 line-clamp-2">
                              {category.explanation}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div
                    className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3"
                  >
                    <h3 className="text-[11px] font-semibold text-white mb-2">
                       Priority fixes
                    </h3>
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
