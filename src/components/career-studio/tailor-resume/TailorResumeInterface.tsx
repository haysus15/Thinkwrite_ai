// Tailor Resume Interface - COMPLETE VERSION WITH SAVE BUTTON
// src/components/career-studio/tailor-resume/TailorResumeInterface.tsx

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Briefcase,
  Sparkles,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageCircle,
  Loader2,
  AlertCircle,
  CheckCircle,
  Zap,
  Target,
  Rocket,
  Star,
  Building2,
  MapPin,
  Calendar,
  SkipForward,
  Save, //  ADDED Save icon
} from "lucide-react";

import type {
  TailoredResume,
  ResumeChange,
  TailoringLevel,
  StructuredResumeContent,
} from "@/types/tailored-resume";
import { ApplyMirrorModeButton } from "@/components/voice-transform";
import { VoiceFeedbackPrompt } from "@/components/voice-feedback";

interface TailorResumeInterfaceProps {
  jobAnalysisId?: string;
  masterResumeId?: string;
}

interface ResumeOption {
  id: string;
  fileName: string;
  score?: number;
  isMaster: boolean;
  uploadedAt: string;
}

interface JobAnalysisOption {
  id: string;
  jobTitle: string;
  company: string;
  location?: string;
  isSaved: boolean;
  analyzedAt: string;
  atsScore?: number;
}

type ViewMode =
  | "select-inputs"
  | "select-level"
  | "strategy-session"
  | "extract-insights"
  | "processing"
  | "review"
  | "finalized";

const STRATEGY_SESSION_KEY = "lexStrategyConversation";

const TAILORING_LEVEL_CONFIG: Record<
  TailoringLevel,
  {
    name: string;
    description: string;
    lexDescription: string;
    expectedChanges: string;
    icon: React.ReactNode;
    color: string;
  }
> = {
  light: {
    name: "Light Touch",
    description: "Keyword optimization and minor phrasing adjustments",
    lexDescription:
      "I'll add relevant keywords naturally and tweak some phrases. Your resume stays mostly the same – just optimized for ATS.",
    expectedChanges: "5–10 small changes",
    icon: <Zap className="w-6 h-6" />,
    color: "from-emerald-400 to-lime-500",
  },
  medium: {
    name: "Balanced",
    description:
      "Rewrite bullets to emphasize relevant experience, stronger action verbs",
    lexDescription:
      "I'll rewrite your bullet points to better highlight experience that matches this role. More impactful language, clearer achievements.",
    expectedChanges: "10–20 meaningful changes",
    icon: <Target className="w-6 h-6" />,
    color: "from-sky-400 to-indigo-500",
  },
  heavy: {
    name: "Full Restructure",
    description:
      "Significant rewrites, reordered sections, comprehensive optimization",
    lexDescription:
      "I'm going to reshape your resume around what this employer wants. Expect major rewrites and possibly reordering your experience.",
    expectedChanges: "20+ substantial changes",
    icon: <Rocket className="w-6 h-6" />,
    color: "from-fuchsia-500 to-rose-500",
  },
};

export default function TailorResumeInterface({
  jobAnalysisId: initialJobAnalysisId,
  masterResumeId: initialMasterResumeId,
}: TailorResumeInterfaceProps) {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>("select-inputs");
  const [tailoringLevel, setTailoringLevel] = useState<TailoringLevel | null>(null);
  const [hoverLevel, setHoverLevel] = useState<TailoringLevel | null>(null);
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [voiceMetadata, setVoiceMetadata] = useState<{
    usedVoiceProfile: boolean;
    confidenceLevel: number;
  } | null>(null);
  const [voiceTransformedContent, setVoiceTransformedContent] = useState<string | null>(null);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //  ADDED: Save button state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    initialMasterResumeId || ""
  );
  const [selectedJobId, setSelectedJobId] = useState<string>(
    initialJobAnalysisId || ""
  );

  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [jobAnalyses, setJobAnalyses] = useState<JobAnalysisOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      initialJobAnalysisId &&
      initialMasterResumeId &&
      resumes.length > 0 &&
      jobAnalyses.length > 0
    ) {
      setViewMode("select-level");
    }
  }, [initialJobAnalysisId, initialMasterResumeId, resumes, jobAnalyses]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get("mode");

    if (mode === "extract-insights") {
      console.log(" Returned from Lex strategy session");
      handleExtractInsightsFromSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOptions = async () => {
    setIsLoadingOptions(true);
    try {
      await Promise.all([loadResumes(), loadJobAnalyses()]);
    } catch (err) {
      console.error("Failed to load options:", err);
      setError("Failed to load your resumes and job analyses");
    } finally {
      setIsLoadingOptions(false);
    }
  };

  //  UPDATED: Fixed loadResumes to properly get scores from analysisResults
  const loadResumes = async () => {
    try {
      const response = await fetch(`/api/resumes`);
      const data = await response.json();

      if (data.success && data.resumes) {
        const resumeOptions: ResumeOption[] = data.resumes.map((r: any) => {
          // Get analysis data from analysisResults object
          const analysisData = r.analysisResults || {};
          
          return {
            id: r.id,
            fileName: r.fileName || r.file_name,
            score: analysisData?.overallScore || r.atsScore || r.ats_score,
            isMaster: r.isMasterResume || r.is_master_resume || r.is_master || false,
            uploadedAt: r.uploadedAt || r.createdAt || r.uploaded_at || r.created_at,
          };
        });

        resumeOptions.sort((a, b) => {
          if (a.isMaster && !b.isMaster) return -1;
          if (!a.isMaster && b.isMaster) return 1;
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        });

        setResumes(resumeOptions);

        if (!selectedResumeId) {
          const master = resumeOptions.find((r) => r.isMaster);
          if (master) {
            setSelectedResumeId(master.id);
          } else if (resumeOptions.length > 0) {
            setSelectedResumeId(resumeOptions[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load resumes:", err);
    }
  };

  const loadJobAnalyses = async () => {
    try {
      const response = await fetch(`/api/job-analysis`);
      const data = await response.json();

      if (data.success && data.analyses) {
        const savedAnalyses = data.analyses.filter((a: any) => a.is_saved);

        const jobOptions: JobAnalysisOption[] = savedAnalyses.map((a: any) => ({
          id: a.id,
          jobTitle:
            a.job_title ||
            a.analysis_results?.jobDetails?.title ||
            "Unknown Position",
          company:
            a.company ||
            a.analysis_results?.jobDetails?.company ||
            "Unknown Company",
          location: a.analysis_results?.jobDetails?.location,
          isSaved: a.is_saved,
          analyzedAt: a.created_at,
          atsScore: a.analysis_results?.atsKeywords?.atsScore,
        }));

        jobOptions.sort(
          (a, b) =>
            new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
        );

        setJobAnalyses(jobOptions);

        if (!selectedJobId && jobOptions.length > 0) {
          setSelectedJobId(jobOptions[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load job analyses:", err);
    }
  };

  const handleContinueToLevelSelection = () => {
    if (!selectedResumeId || !selectedJobId) {
      setError("Please select both a resume and a job analysis");
      return;
    }
    setError(null);
    setViewMode("select-level");
  };

  const handleStrategySession = () => {
    if (!selectedResumeId || !selectedJobId) {
      setError("Please select both a resume and a job analysis");
      return;
    }

    router.push(
      `/career-studio/lex?mode=strategy&resumeId=${selectedResumeId}&jobId=${selectedJobId}&returnTo=tailor-resume`
    );
  };

  const handleExtractInsightsFromSession = async () => {
    try {
      setIsLoading(true);
      setViewMode("extract-insights");
      setError(null);

      const conversationData = sessionStorage.getItem(STRATEGY_SESSION_KEY);

      if (!conversationData) {
        throw new Error("No conversation found in session");
      }

      const parsed = JSON.parse(conversationData);

      const response = await fetch("/api/lex/extract-resume-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationHistory: parsed.messages,
          resumeId: parsed.resumeId,
          jobId: parsed.jobId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to extract suggestions");
      }

      const tailoredResumeId = data.tailoredResumeId;

      const loadResponse = await fetch(`/api/tailored-resume/${tailoredResumeId}`);
      const loadData = await loadResponse.json();

      if (loadData.success && loadData.tailoredResume) {
        setTailoredResume(loadData.tailoredResume);
        setVoiceMetadata(null);
        setCurrentChangeIndex(0);
        setViewMode("review");
      } else {
        throw new Error("Failed to load tailored resume");
      }

      sessionStorage.removeItem(STRATEGY_SESSION_KEY);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      console.error("Extract insights error:", err);
      setError(err instanceof Error ? err.message : "Failed to extract insights");
      setViewMode("select-inputs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTailoring = async () => {
    if (!tailoringLevel || !selectedJobId || !selectedResumeId) {
      setError("Please select a tailoring level");
      return;
    }

    setIsLoading(true);
    setError(null);
    setViewMode("processing");

    try {
      const response = await fetch("/api/tailored-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobAnalysisId: selectedJobId,
          masterResumeId: selectedResumeId,
          tailoringLevel,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate tailored resume");
      }

      setTailoredResume(data.tailoredResume);
      setVoiceMetadata(data.voiceMetadata || null);
      setCurrentChangeIndex(0);
      setViewMode("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setViewMode("select-level");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeDecision = async (status: "accepted" | "rejected") => {
    if (!tailoredResume) return;

    const currentChange = tailoredResume.changes[currentChangeIndex];

    try {
      const response = await fetch(
        `/api/tailored-resume/${tailoredResume.id}/change`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            changeId: currentChange.id,
            status,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        const updatedChanges = [...tailoredResume.changes];
        updatedChanges[currentChangeIndex] = {
          ...updatedChanges[currentChangeIndex],
          status,
        };

        const updated = {
          ...tailoredResume,
          changes: updatedChanges,
          changesAccepted: data.counts.accepted,
          changesRejected: data.counts.rejected,
          changesPending: data.counts.pending,
        };

        setTailoredResume(updated);
        moveToNextPendingChange(updatedChanges);
      }
    } catch (err) {
      console.error("Failed to update change:", err);
    }
  };

  const moveToNextPendingChange = (changes: ResumeChange[]) => {
    const nextPendingIndex = changes.findIndex(
      (c, i) => i > currentChangeIndex && c.status === "pending"
    );

    if (nextPendingIndex !== -1) {
      setCurrentChangeIndex(nextPendingIndex);
    } else {
      const prevPendingIndex = changes.findIndex((c) => c.status === "pending");
      if (prevPendingIndex !== -1) {
        setCurrentChangeIndex(prevPendingIndex);
      } else {
        setViewMode("finalized");
      }
    }
  };

  const handleSkipChange = () => {
    if (!tailoredResume) return;
    const nextIndex = (currentChangeIndex + 1) % tailoredResume.changes.length;
    setCurrentChangeIndex(nextIndex);
  };

  const handleDownload = async () => {
    if (!tailoredResume) return;

    try {
      setIsLoading(true);

      const response = await fetch(
        `/api/tailored-resume/${tailoredResume.id}/generate-docx`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ includeRejectedChanges: false }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate document");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tailored-resume-${tailoredResume.id.slice(0, 8)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download resume");
    } finally {
      setIsLoading(false);
    }
  };

  //  ADDED: Save to My Resumes Handler
  const handleSaveResume = async () => {
    if (!tailoredResume) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch(
        `/api/tailored-resume/${tailoredResume.id}/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customName: null,
            setAsMaster: false,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setSaveSuccess(true);
        console.log(" Resume saved:", data.fileName);
      } else {
        setError(data.error || "Failed to save resume");
      }
    } catch (err) {
      console.error("Save error:", err);
      setError("Error saving resume. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscussWithLex = () => {
    if (!tailoredResume) return;
    router.push(`/career-studio/lex?tailoredResumeId=${tailoredResume.id}`);
  };

  const handleAcceptAll = async () => {
    if (!tailoredResume) return;

    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/tailored-resume/${tailoredResume.id}/change`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "acceptAll" }),
        }
      );

      const data = await response.json();
      if (data.success) {
        const updatedChanges = tailoredResume.changes.map((c) => ({
          ...c,
          status: "accepted" as const,
        }));
        setTailoredResume({
          ...tailoredResume,
          changes: updatedChanges,
          changesAccepted: data.counts.accepted,
          changesRejected: data.counts.rejected,
          changesPending: data.counts.pending,
        });
        setViewMode("finalized");
      }
    } catch (err) {
      console.error("Failed to accept all:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedResume = resumes.find((r) => r.id === selectedResumeId);
  const selectedJob = jobAnalyses.find((j) => j.id === selectedJobId);
  const currentChange = tailoredResume?.changes[currentChangeIndex];
  const tailoredContentText = useMemo(() => {
    if (!tailoredResume?.tailoredContent) return "";
    return buildTailoredResumeText(tailoredResume.tailoredContent);
  }, [tailoredResume]);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-red-400 bg-red-400/20";
      case "medium":
        return "text-violet-400 bg-violet-400/20";
      case "low":
        return "text-emerald-400 bg-emerald-400/20";
      default:
        return "text-gray-400 bg-gray-400/20";
    }
  };

  const getSectionName = (section: string) => {
    const names: Record<string, string> = {
      summary: "Professional Summary",
      experience: "Experience",
      skills: "Skills",
      education: "Education",
      projects: "Projects",
      certifications: "Certifications",
      professional_development: "Professional Development",
    };
    return names[section] || section;
  };

  const getScoreColor = (score?: number) => {
    if (!score) return "text-white/40";
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-violet-400";
    return "text-orange-400";
  };

  const currentStep = (() => {
    switch (viewMode) {
      case "select-inputs":
        return 1;
      case "select-level":
      case "strategy-session":
        return 2;
      case "processing":
      case "extract-insights":
      case "review":
        return 3;
      case "finalized":
        return 4;
    }
  })();

  const steps = [
    { id: 1, label: "SOURCE" },
    { id: 2, label: "INTENSITY" },
    { id: 3, label: "EDIT PASSES" },
    { id: 4, label: "EXPORT" },
  ];

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-6 py-4 space-y-6">
        {/* Step Rail */}
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
          {steps.map((step, index) => {
            const active = step.id === currentStep;
            const passed = step.id < currentStep;
            return (
              <React.Fragment key={step.id}>
                <div
                  className={`flex items-center gap-2 ${
                    active ? "text-[#9333EA]" : passed ? "text-white/70" : ""
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center text-[8px] ${
                      active
                        ? "border-[#9333EA] bg-[#9333EA]/20"
                        : passed
                        ? "border-white/40 bg-white/10"
                        : "border-white/20"
                    }`}
                  >
                    {step.id}
                  </span>
                  <span>{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-2 p-3 bg-red-500/15 border border-red-500/40 rounded-lg flex items-center gap-3 text-sm">
            <AlertCircle className="w-4 h-4 text-red-300" />
            <span className="text-red-200 text-xs">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-300 hover:text-red-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MAIN CONTENT BY VIEW */}
        <main className="pb-8">
          {/* SELECT INPUTS VIEW */}
          {viewMode === "select-inputs" && (
            <div className="space-y-8">
              {isLoadingOptions ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 text-[#9333EA] animate-spin mb-3" />
                  <p className="text-white/60 text-sm">
                    Loading your resumes and job analyses...
                  </p>
                </div>
              ) : (
                <>
                  {/* Resume Selection */}
                  <section>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                      Step 01 · Source
                    </p>
                    <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#9333EA]" />
                      Select resume to tailor
                    </h2>
                    <p className="text-white/50 text-xs mb-4">
                      Pick the base resume that will be remixed around this job.
                    </p>

                    {resumes.length === 0 ? (
                      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-8 text-center">
                        <FileText className="w-10 h-10 text-white/20 mx-auto mb-3" />
                        <p className="text-white/60 text-sm mb-3">
                          No resumes uploaded yet.
                        </p>
                        <button
                          onClick={() => router.push("/career-studio/resume-manager")}
                          className="px-5 py-2.5 bg-[#9333EA] text-white rounded-lg text-xs font-semibold hover:bg-[#A855F7] transition-colors"
                        >
                          Go to Resume Manager
                        </button>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {resumes.map((resume) => {
                          const selected = selectedResumeId === resume.id;
                          return (
                            <button
                              key={resume.id}
                              onClick={() => setSelectedResumeId(resume.id)}
                              className={`relative p-4 rounded-xl border text-left transition-all group ${
                                selected
                                  ? "border-[#9333EA] bg-[#9333EA]/10 shadow-[0_0_25px_rgba(234,170,0,0.35)]"
                                  : "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
                              }`}
                            >
                              {resume.isMaster && (
                                <div className="absolute top-3 right-3">
                                  <Star className="w-4 h-4 text-[#9333EA] fill-[#9333EA]" />
                                </div>
                              )}
                              {selected && (
                                <div className="absolute top-3 left-3">
                                  <CheckCircle className="w-4 h-4 text-[#9333EA]" />
                                </div>
                              )}

                              <div className="pt-5">
                                <p className="text-[9px] uppercase tracking-[0.2em] text-white/35 mb-1">
                                  Resume
                                </p>
                                <FileText className="w-6 h-6 text-white/40 mb-2" />
                                <h3 className="text-white text-sm font-medium truncate pr-8">
                                  {resume.fileName}
                                </h3>
                                <div className="flex items-center justify-between mt-2 text-[11px] text-white/40">
                                  <span>
                                    {new Date(resume.uploadedAt).toLocaleDateString()}
                                  </span>
                                  {resume.score && (
                                    <span
                                      className={`font-semibold ${getScoreColor(
                                        resume.score
                                      )}`}
                                    >
                                      {resume.score}/100
                                    </span>
                                  )}
                                </div>
                                {resume.isMaster && (
                                  <span className="inline-flex items-center mt-2 px-2 py-0.5 bg-[#9333EA]/20 text-[#9333EA] text-[10px] rounded-full">
                                    MASTER
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Job Selection */}
                  <section>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                      Step 01 · Source
                    </p>
                    <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#9333EA]" />
                      Select target job
                    </h2>
                    <p className="text-white/50 text-xs mb-4">
                      Choose the analyzed job posting you want this resume to lock onto.
                    </p>

                    {jobAnalyses.length === 0 ? (
                      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-8 text-center">
                        <Briefcase className="w-10 h-10 text-white/20 mx-auto mb-3" />
                        <p className="text-white/60 text-sm mb-3">
                          No saved job analyses yet.
                        </p>
                        <button
                          onClick={() => router.push("/career-studio/job-analysis")}
                          className="px-5 py-2.5 bg-[#9333EA] text-white rounded-lg text-xs font-semibold hover:bg-[#A855F7] transition-colors"
                        >
                          Go to Job Decoder
                        </button>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        {jobAnalyses.map((job) => {
                          const selected = selectedJobId === job.id;
                          return (
                            <button
                              key={job.id}
                              onClick={() => setSelectedJobId(job.id)}
                              className={`relative p-4 rounded-xl border text-left transition-all group ${
                                selected
                                  ? "border-[#9333EA] bg-[#9333EA]/10 shadow-[0_0_25px_rgba(234,170,0,0.35)]"
                                  : "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
                              }`}
                            >
                              {selected && (
                                <div className="absolute top-3 right-3">
                                  <CheckCircle className="w-4 h-4 text-[#9333EA]" />
                                </div>
                              )}
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-5 h-5 text-white/60" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/35 mb-1">
                                    Job
                                  </p>
                                  <h3 className="text-white text-sm font-medium truncate pr-6">
                                    {job.jobTitle}
                                  </h3>
                                  <p className="text-white/60 text-[11px] truncate">
                                    {job.company}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-white/40">
                                    {job.location && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {job.location}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(job.analyzedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Action Buttons */}
                  {resumes.length > 0 && jobAnalyses.length > 0 && (
                    <>
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={handleContinueToLevelSelection}
                          disabled={!selectedResumeId || !selectedJobId}
                          className={`px-7 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                            selectedResumeId && selectedJobId
                              ? "bg-[#9333EA] text-white hover:bg-[#A855F7]"
                              : "bg-white/10 text-white/40 cursor-not-allowed"
                          }`}
                        >
                          Lock in sources
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-col items-center pt-4 gap-3">
                        <div className="flex items-center gap-3 text-white/40 text-xs">
                          <div className="flex-1 h-px bg-white/10" />
                          <span className="uppercase tracking-wider">Or</span>
                          <div className="flex-1 h-px bg-white/10" />
                        </div>

                        <button
                          onClick={handleStrategySession}
                          disabled={!selectedResumeId || !selectedJobId}
                          className={`px-7 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all border ${
                            selectedResumeId && selectedJobId
                              ? "bg-purple-500/20 border-purple-400/50 text-purple-200 hover:bg-purple-500/30"
                              : "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                          }`}
                        >
                          <MessageCircle className="w-4 h-4" />
                          Strategy Session with Lex First
                          <span className="text-xs opacity-70">(Recommended)</span>
                        </button>

                        <p className="text-xs text-white/50 text-center max-w-md">
                          Discuss your goals with Lex to get personalized, honest resume
                          advice before auto-generating changes
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* EXTRACT INSIGHTS VIEW */}
          {viewMode === "extract-insights" && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-purple-400 border-t-transparent animate-spin" />
                <MessageCircle className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Extracting insights from your conversation
                </h2>
                <p className="text-white/60 text-sm max-w-md mx-auto">
                  Analyzing your discussion with Lex to identify specific, honest resume
                  changes...
                </p>
              </div>

              <div className="w-full max-w-md mt-4">
                <div className="flex justify-between text-[10px] text-white/40 mb-1">
                  <span>Parse conversation</span>
                  <span>Extract suggestions</span>
                  <span>Verify honesty</span>
                </div>
                <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(168,85,247,0)_0%,rgba(168,85,247,0.8)_50%,rgba(168,85,247,0)_100%)] animate-[pulse_1.4s_ease-in-out_infinite]" />
                </div>
              </div>
            </div>
          )}

          {/* SELECT LEVEL VIEW */}
          {viewMode === "select-level" && (
            <div className="space-y-8">
              {/* Context Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#9333EA]" />
                    <p className="text-xs font-semibold text-white">Selected Resume</p>
                    <button
                      onClick={() => setViewMode("select-inputs")}
                      className="ml-auto text-[10px] text-[#9333EA] hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <p className="text-white/80 text-sm truncate">
                    {selectedResume?.fileName}
                  </p>
                  {selectedResume?.score && (
                    <p className={`text-xs mt-1 ${getScoreColor(selectedResume.score)}`}>
                      ATS Score: {selectedResume.score}/100
                    </p>
                  )}
                </div>

                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-4 h-4 text-[#9333EA]" />
                    <p className="text-xs font-semibold text-white">Target Job</p>
                    <button
                      onClick={() => setViewMode("select-inputs")}
                      className="ml-auto text-[10px] text-[#9333EA] hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <p className="text-white/80 text-sm truncate">
                    {selectedJob?.jobTitle}
                  </p>
                  <p className="text-white/60 text-[11px] truncate">
                    {selectedJob?.company}
                  </p>
                </div>
              </div>

              {/* Tailoring Level Selection */}
              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                  Step 02 · Intensity
                </p>
                <h2 className="text-lg font-semibold text-white mb-1">
                  Choose your tailoring level
                </h2>
                <p className="text-white/50 text-xs mb-4">
                  Decide how aggressive you want Lex to be. Light is a polish; Heavy is a
                  rebuild.
                </p>

                <div className="grid md:grid-cols-3 gap-4">
                  {(Object.keys(TAILORING_LEVEL_CONFIG) as TailoringLevel[]).map(
                    (level, idx) => {
                      const config = TAILORING_LEVEL_CONFIG[level];
                      const isSelected = tailoringLevel === level;
                      const modeLabel =
                        level === "light"
                          ? "MODE: GLIDE"
                          : level === "medium"
                          ? "MODE: PUNCH"
                          : "MODE: REBUILD";

                      return (
                        <button
                          key={level}
                          onClick={() => setTailoringLevel(level)}
                          onMouseEnter={() => setHoverLevel(level)}
                          onMouseLeave={() => setHoverLevel(null)}
                          className={`relative p-4 rounded-xl border text-left transition-all overflow-hidden group ${
                            isSelected
                              ? "border-[#9333EA] bg-[#9333EA]/10 shadow-[0_0_25px_rgba(234,170,0,0.35)]"
                              : "border-white/15 bg-white/[0.02] hover:border-white/40 hover:bg-white/[0.05]"
                          }`}
                        >
                          <span className="pointer-events-none select-none absolute right-3 bottom-1 text-4xl font-black text-white/5">
                            0{idx + 1}
                          </span>

                          {isSelected && (
                            <div className="absolute top-3 right-3">
                              <CheckCircle className="w-4 h-4 text-[#9333EA]" />
                            </div>
                          )}

                          <div
                            className={`w-11 h-11 rounded-lg flex items-center justify-center mb-3 bg-gradient-to-br ${config.color} text-white`}
                          >
                            {config.icon}
                          </div>

                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                            {modeLabel}
                          </p>
                          <h3 className="text-white text-base font-semibold mt-1 mb-1">
                            {config.name}
                          </h3>
                          <p className="text-white/60 text-xs mb-3">
                            {config.description}
                          </p>
                          <p className="text-[#9333EA] text-[11px] font-medium">
                            {config.expectedChanges}
                          </p>
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Lex commentary */}
                {tailoringLevel && (
                  <div className="mt-5 bg-black/60 border border-[#9333EA]/40 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#9333EA] text-white flex items-center justify-center text-xs font-bold">
                        L
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white mb-1">
                          Lex commentary
                        </p>
                        <p className="text-white/80 text-sm">
                          {TAILORING_LEVEL_CONFIG[tailoringLevel].lexDescription}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleStartTailoring}
                    disabled={!tailoringLevel}
                    className={`px-7 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                      tailoringLevel
                        ? "bg-[#9333EA] text-white hover:bg-[#A855F7]"
                        : "bg-white/10 text-white/40 cursor-not-allowed"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Start tailoring
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* PROCESSING VIEW */}
          {viewMode === "processing" && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-[#9333EA] border-t-transparent animate-spin" />
                <Sparkles className="w-8 h-8 text-[#9333EA] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Generating tailored resume
                </h2>
                <p className="text-white/60 text-sm max-w-md mx-auto">
                  Lex is re-sequencing your story around this job posting. This usually
                  takes under a minute.
                </p>
              </div>

              <div className="w-full max-w-md mt-4">
                <div className="flex justify-between text-[10px] text-white/40 mb-1">
                  <span>Job parse</span>
                  <span>Alignment</span>
                  <span>Rewrite</span>
                </div>
                <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(234,170,0,0)_0%,rgba(234,170,0,0.8)_50%,rgba(234,170,0,0)_100%)] animate-[pulse_1.4s_ease-in-out_infinite]" />
                </div>
              </div>

              <div className="mt-6 space-y-1 text-xs text-white/40">
                <p className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyzing job requirements
                </p>
                <p className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Mapping your experience to signal
                </p>
                <p className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Writing role-specific bullets
                </p>
              </div>
            </div>
          )}

          {/* REVIEW VIEW */}
          {viewMode === "review" && tailoredResume && currentChange && (
            <div className="space-y-6">
              {/* Honesty Badge for conversation-based changes */}
              {currentChange.conversationContext && (
                <div className="bg-purple-500/10 border border-purple-400/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-400/20 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-4 h-4 text-purple-300" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white mb-1">
                        From Your Strategy Session
                      </p>
                      <p className="text-sm text-white/80">
                        {currentChange.conversationContext}
                      </p>
                      <span className="inline-flex items-center mt-2 px-2 py-1 bg-emerald-400/20 text-emerald-300 text-xs rounded-full">
                         Verified Honest
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Accept all bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#9333EA] transition-all"
                    style={{
                      width: `${
                        ((tailoredResume.changesAccepted +
                          tailoredResume.changesRejected) /
                          tailoredResume.changes.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <div className="text-[11px] text-white/60 whitespace-nowrap ml-3">
                  <span className="text-emerald-400">
                    {tailoredResume.changesAccepted} accepted
                  </span>{" "}
                  ·{" "}
                  <span className="text-red-400">
                    {tailoredResume.changesRejected} rejected
                  </span>{" "}
                  ·{" "}
                  <span className="text-violet-400">
                    {tailoredResume.changesPending} pending
                  </span>
                </div>
                <button
                  onClick={handleAcceptAll}
                  className="ml-3 px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/60 rounded-md text-[11px] text-emerald-200 hover:bg-emerald-500/30"
                >
                  Accept all
                </button>
              </div>

              {/* Change info strip */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-white/50 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    CHANGE {currentChangeIndex + 1} / {tailoredResume.changes.length}
                  </span>
                  <span>·</span>
                  <span>
                    SECTION: {getSectionName(currentChange.section)}
                    {currentChange.subsection && ` · ${currentChange.subsection}`}
                  </span>
                  <span>·</span>
                  <span
                    className={`px-2 py-0.5 rounded-full capitalize ${getImpactColor(
                      currentChange.impact
                    )}`}
                  >
                    {currentChange.impact} impact
                  </span>
                </div>

                <button
                  onClick={handleDiscussWithLex}
                  className="flex items-center gap-1 text-[#9333EA] hover:text-[#A855F7]"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>De-brief with Lex</span>
                </button>
              </div>

              {/* Side-by-side panels */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="bg-white/[0.02] border border-red-500/40 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 border-b border-red-500/40 bg-red-500/10 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-red-300" />
                    <span className="text-xs font-semibold text-white">Source line</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                      {currentChange.original}
                    </p>
                  </div>
                </div>

                {/* Tailored */}
                <div className="bg-white/[0.02] border border-emerald-500/40 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 border-b border-emerald-500/40 bg-emerald-500/10 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <span className="text-xs font-semibold text-white">Tailored line</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                      {currentChange.tailored}
                    </p>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-semibold text-white/60 mb-1">
                      Why this change?
                    </p>
                    <p className="text-sm text-white/80">{currentChange.reason}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-[#9333EA] flex items-center justify-center text-[10px] text-white font-bold">
                        L
                      </div>
                      <p className="text-[11px] font-semibold text-white/70">
                        Lex's take
                      </p>
                    </div>
                    <p className="text-sm text-white/80">
                      {currentChange.lexTip ||
                        "This rewrite sharpens your alignment with the job's key requirements."}
                    </p>
                  </div>
                </div>

                {currentChange.keywords && currentChange.keywords.length > 0 && (
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-[11px] font-semibold text-white/60 mb-1">
                      Keywords hit
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentChange.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full bg-[#9333EA]/20 text-[#9333EA] text-[11px]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => handleChangeDecision("rejected")}
                  className="px-6 py-2.5 rounded-lg border border-red-500/60 bg-red-500/15 text-red-200 text-sm font-semibold flex items-center gap-2 hover:bg-red-500/25"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>

                <button
                  onClick={handleSkipChange}
                  className="px-5 py-2.5 rounded-lg bg-white/5 text-white/60 text-sm font-semibold flex items-center gap-2 hover:bg-white/10"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>

                <button
                  onClick={() => handleChangeDecision("accepted")}
                  className="px-6 py-2.5 rounded-lg border border-emerald-500/60 bg-emerald-500/15 text-emerald-200 text-sm font-semibold flex items-center gap-2 hover:bg-emerald-500/25"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10 text-[11px] text-white/60">
                <button
                  onClick={() =>
                    setCurrentChangeIndex((prev) => Math.max(0, prev - 1))
                  }
                  disabled={currentChangeIndex === 0}
                  className="flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <button
                  onClick={() =>
                    setCurrentChangeIndex((prev) =>
                      Math.min(tailoredResume.changes.length - 1, prev + 1)
                    )
                  }
                  disabled={currentChangeIndex === tailoredResume.changes.length - 1}
                  className="flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* FINALIZED VIEW */}
          {viewMode === "finalized" && tailoredResume && (
            <div className="space-y-8">
              {/* Success Header */}
              <div className="text-center pt-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Export ready.
                </h2>
                <p className="text-white/60 text-sm max-w-md mx-auto">
                  You accepted {tailoredResume.changesAccepted} changes and rejected{" "}
                  {tailoredResume.changesRejected}. Your tailored resume is ready to ship.
                </p>
              </div>

              {/* Stats Card */}
              <div className="bg-black/70 border border-white/10 rounded-xl p-4 font-mono text-xs text-white/70 space-y-1 max-w-2xl mx-auto">
                <p>
                  ROLE{"     "}:{" "}
                  <span className="text-white">{selectedJob?.jobTitle || "—"}</span>
                </p>
                <p>
                  COMPANY{"  "}:{" "}
                  <span className="text-white">{selectedJob?.company || "—"}</span>
                </p>
                <p>
                  CHANGES{"  "}:{" "}
                  <span className="text-emerald-300">
                    {tailoredResume.changesAccepted} accepted
                  </span>{" "}
                  ·{" "}
                  <span className="text-red-300">
                    {tailoredResume.changesRejected} rejected
                  </span>
                </p>
                <p>
                  MODE{"     "}:{" "}
                  <span className="text-[#9333EA] uppercase">
                    {tailoringLevel
                      ? TAILORING_LEVEL_CONFIG[tailoringLevel].name
                      : "Conversation"}
                  </span>
                </p>
              </div>

              {/* Lex Commentary */}
              {tailoredResume.lexCommentary?.overallAssessment && (
                <div className="bg-[#9333EA]/10 border border-[#9333EA]/30 rounded-xl p-4 space-y-3 max-w-2xl mx-auto">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#9333EA] flex items-center justify-center text-xs font-bold text-white">
                      L
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white mb-1">
                        Lex's final thoughts
                      </p>
                      <p className="text-sm text-white/85">
                        {tailoredResume.lexCommentary.overallAssessment}
                      </p>
                    </div>
                  </div>
                  {tailoredResume.lexCommentary.interviewTips &&
                    tailoredResume.lexCommentary.interviewTips.length > 0 && (
                      <div className="pl-11">
                        <p className="text-[11px] text-white/70 mb-1">
                          Interview angles to lean into:
                        </p>
                        <ul className="space-y-1">
                          {tailoredResume.lexCommentary.interviewTips.map((tip, i) => (
                            <li key={i} className="text-sm text-white/85 flex gap-2">
                              <span className="text-[#9333EA]">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}

              {/* Resume Preview */}
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#9333EA]" />
                    Resume Preview
                  </h3>
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">
                    {tailoredResume.changesAccepted} changes applied
                  </span>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-8 space-y-6 text-white/90">
                  {/* Preview Header */}
                  <div className="text-center border-b border-white/10 pb-4">
                    <h1 className="text-2xl font-bold text-white mb-1">
                      {selectedResume?.fileName.replace(/\.(pdf|docx|txt)$/i, "") ||
                        "Your Name"}
                    </h1>
                    <p className="text-sm text-white/60">
                      Tailored for {selectedJob?.jobTitle} at {selectedJob?.company}
                    </p>
                  </div>

                  {/* Show accepted changes by section */}
                  <div className="space-y-4">
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                      <p className="text-xs font-semibold text-emerald-300 mb-2 uppercase tracking-wider">
                         Changes Applied ({tailoredResume.changesAccepted})
                      </p>
                      <div className="space-y-3">
                        {tailoredResume.changes
                          .filter((c) => c.status === "accepted")
                          .slice(0, 5)
                          .map((change, idx) => (
                            <div key={idx} className="text-sm">
                              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                                {getSectionName(change.section)}
                              </p>
                              <p className="text-white/90 leading-relaxed">
                                {change.tailored}
                              </p>
                            </div>
                          ))}
                        {tailoredResume.changesAccepted > 5 && (
                          <p className="text-xs text-white/40 italic">
                            + {tailoredResume.changesAccepted - 5} more changes applied...
                          </p>
                        )}
                      </div>
                    </div>

                    {tailoredResume.changesRejected > 0 && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                        <p className="text-xs font-semibold text-red-300 mb-2 uppercase tracking-wider">
                           Changes Rejected ({tailoredResume.changesRejected})
                        </p>
                        <p className="text-xs text-white/60">
                          These suggestions were not applied to your final resume.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-center pt-4 border-t border-white/10">
                    <p className="text-xs text-white/40">
                      Download the DOCX file below to see your complete tailored resume
                      with all formatting.
                    </p>
                  </div>
                </div>
              </div>

              {voiceMetadata?.usedVoiceProfile && tailoredContentText && (
                <VoiceFeedbackPrompt
                  contentType="tailored_resume"
                  studioType="career"
                  originalContent={tailoredContentText}
                  confidenceLevel={voiceMetadata.confidenceLevel}
                  className="max-w-2xl mx-auto"
                />
              )}

              {/* Action Buttons */}
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Primary Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={handleDownload}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-7 py-3 rounded-lg bg-[#9333EA] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#A855F7] disabled:opacity-50 transition-all shadow-lg"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download DOCX
                  </button>

                  {/*  ADDED: SAVE TO MY RESUMES BUTTON */}
                  <button
                    onClick={handleSaveResume}
                    disabled={isSaving || saveSuccess}
                    className={`w-full sm:w-auto px-7 py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                      saveSuccess
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        Saved to My Resumes!
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save to My Resumes
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDiscussWithLex}
                    className="w-full sm:w-auto px-7 py-3 rounded-lg bg-white/10 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    De-brief with Lex
                  </button>

                  <ApplyMirrorModeButton
                    content={tailoredContentText}
                    contentType="tailored_resume"
                    onTransformed={(newContent) => {
                      setVoiceTransformedContent(newContent);
                    }}
                  />
                </div>

                {/* Secondary Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setViewMode("review");
                      setCurrentChangeIndex(0);
                    }}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg border border-white/20 bg-white/5 text-white/80 text-xs font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Review Changes Again
                  </button>

                  <button
                    onClick={() => router.push("/career-studio/applications")}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all"
                  >
                    <Rocket className="w-3 h-3" />
                    Track Application
                  </button>
                </div>

                {/* Tertiary */}
                <div className="text-center">
                  <button
                    onClick={() => router.push("/career-studio/job-analysis")}
                    className="text-[11px] text-white/50 hover:text-white flex items-center gap-1 justify-center mx-auto transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Back to Job Decoder
                  </button>
                </div>
              </div>

              {voiceTransformedContent && (
                <div className="max-w-2xl mx-auto mt-6 bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/60">Voice-Tuned Draft</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(voiceTransformedContent)}
                      className="text-xs text-white/60 hover:text-white"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="text-xs text-white/80 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {voiceTransformedContent}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </Shell>
  );
}

function buildTailoredResumeText(content: StructuredResumeContent): string {
  const parts: string[] = [];

  if (content.summary?.content) {
    parts.push("SUMMARY");
    parts.push(content.summary.content);
    parts.push("");
  }

  if (content.experience?.jobs?.length) {
    parts.push("EXPERIENCE");
    content.experience.jobs.forEach((job) => {
      const roleLine = [
        job.title,
        job.company,
        job.location ? `(${job.location})` : "",
      ]
        .filter(Boolean)
        .join(" ");
      parts.push(roleLine);
      parts.push(`${job.startDate} - ${job.current ? "Present" : job.endDate || "Present"}`);
      job.bullets?.forEach((bullet) => {
        parts.push(`- ${bullet.content}`);
      });
      parts.push("");
    });
  }

  if (content.skills?.groups?.length) {
    parts.push("SKILLS");
    content.skills.groups.forEach((group) => {
      parts.push(`${group.category}: ${group.skills.join(", ")}`);
    });
    parts.push("");
  }

  if (content.education?.entries?.length) {
    parts.push("EDUCATION");
    content.education.entries.forEach((entry) => {
      parts.push(
        [entry.degree, entry.institution, entry.location ? `(${entry.location})` : ""]
          .filter(Boolean)
          .join(" ")
      );
      if (entry.graduationDate) parts.push(entry.graduationDate);
      if (entry.honors?.length) parts.push(`Honors: ${entry.honors.join(", ")}`);
      parts.push("");
    });
  }

  if (content.certifications?.entries?.length) {
    parts.push("CERTIFICATIONS");
    content.certifications.entries.forEach((entry) => {
      parts.push([entry.name, entry.issuer].filter(Boolean).join(" - "));
    });
    parts.push("");
  }

  if (content.projects?.entries?.length) {
    parts.push("PROJECTS");
    content.projects.entries.forEach((entry) => {
      parts.push(entry.name);
      if (entry.description) parts.push(entry.description);
      entry.bullets?.forEach((bullet) => {
        parts.push(`- ${bullet.content}`);
      });
      parts.push("");
    });
  }

  if (content.other?.length) {
    content.other.forEach((section) => {
      parts.push(section.sectionTitle.toUpperCase());
      parts.push(section.content);
      parts.push("");
    });
  }

  return parts.join("\n").trim();
}

function getTailorMicrocopy({
  viewMode,
  tailoringLevel,
  hoverLevel,
}: {
  viewMode: ViewMode;
  tailoringLevel: TailoringLevel | null;
  hoverLevel: TailoringLevel | null;
}) {
  const activeLevel = hoverLevel || tailoringLevel;

  if (viewMode === "select-inputs") {
    return "Feed me a resume and a job. I'll handle the translation.";
  }

  if (viewMode === "select-level") {
    if (activeLevel === "light") return "Light touch: subtle polish, no ego death.";
    if (activeLevel === "medium") return "Balanced: stronger verbs, tighter story.";
    if (activeLevel === "heavy")
      return "Heavy mode: Yeezus rewrite, expect structural shifts.";
    return "Pick an intensity. We're somewhere between tweak and teardown.";
  }

  if (viewMode === "strategy-session" || viewMode === "extract-insights") {
    return "Learning your story from conversation—no fabrication, just strategic positioning.";
  }

  if (viewMode === "processing") {
    return "Lex is splicing your story into this job's signal.";
  }

  if (viewMode === "review") {
    return "Pass through each change like a tracklist—keep what hits, skip what doesn't.";
  }

  if (viewMode === "finalized") {
    return "You've got a tailored cut. Next stop: submit, then prep for the call.";
  }

  return "";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full text-white">{children}</div>
  );
}
