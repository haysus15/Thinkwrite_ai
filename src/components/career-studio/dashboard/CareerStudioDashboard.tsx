"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useVoiceStatusForCareer } from "@/hooks/useVoiceStatusForCareer";

interface ChatMessage {
  id: string;
  sender: "user" | "lex";
  message: string;
  timestamp: Date;
  navigationSuggestion?: {
    text: string;
    href: string;
  };
}

interface ResumeContext {
  hasResume: boolean;
  masterResume?: {
    id: string;
    fileName: string;
    score?: number;
    analysisStatus: "pending" | "complete" | "needs_lex_review";
    uploadedAt: string;
    keyIssues?: string[];
    source?: "upload" | "builder";
  };
  totalResumes: number;
  analyzedResumes: number;
  averageScore?: number;
  builderResumes: number;
}

interface JobAnalysisStats {
  totalAnalyses: number;
  savedAnalyses: number;
  appliedCount: number;
  emailApplications: number;
  recentJobId?: string;
  recentJobTitle?: string;
}


interface HighMatchJob {
  id: string; // job_analysis_id
  jobTitle: string;
  company: string;
  matchScore: number;
}

type MainView = "overview" | "opportunities" | "progress";

export default function CareerStudioDashboardV2() {
  const { user } = useAuth();
  const router = useRouter();
  const effectiveUserId = (user?.id || "").trim();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLexThinking, setIsLexThinking] = useState(false);

  const [resumeContext, setResumeContext] = useState<ResumeContext>({
    hasResume: false,
    totalResumes: 0,
    analyzedResumes: 0,
    builderResumes: 0,
  });

  const [jobAnalysisStats, setJobAnalysisStats] = useState<JobAnalysisStats>({
    totalAnalyses: 0,
    savedAnalyses: 0,
    appliedCount: 0,
    emailApplications: 0,
  });

  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [mainView, setMainView] = useState<MainView>("overview");

  const [highMatchJobs, setHighMatchJobs] = useState<HighMatchJob[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<number>(0);

  const [applicationsCount, setApplicationsCount] = useState<number>(0);
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);

  // Mirror Mode voice status
  const voiceStatus = useVoiceStatusForCareer();

  useEffect(() => {
    if (!effectiveUserId) {
      setIsLoadingContext(false);
      setChatMessages([
        {
          id: "1",
          sender: "lex",
          message: "Sign in to load your career data.",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    initializeDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  /**
   * FIXED: loadApplicationsCount
   * - uses await fetch()
   * - uses effectiveUserId (not hardcoded uuid)
   * - parses as text then JSON to avoid "Unexpected end of JSON input"
   * - handles non-OK responses safely
   */
  const loadApplicationsCount = async (): Promise<void> => {
    try {
      if (!effectiveUserId) {
        setApplicationsCount(0);
        return;
      }

      const res = await fetch("/api/applications/stats", { cache: "no-store" });

      const raw = await res.text();
      if (!raw) {
        console.warn("[applications/stats] empty response body", { status: res.status });
        setApplicationsCount(0);
        return;
      }

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        console.error("[applications/stats] non-JSON response", {
          status: res.status,
          preview: raw.slice(0, 300),
        });
        setApplicationsCount(0);
        return;
      }

      if (!res.ok || data?.success !== true) {
        console.warn("[applications/stats] request failed", { status: res.status, data });
        setApplicationsCount(0);
        return;
      }

      setApplicationsCount(Number(data?.stats?.total_count ?? 0));
    } catch (err) {
      console.error("[applications/stats] fetch error", err);
      setApplicationsCount(0);
    }
  };

  const loadResumeContext = async (): Promise<ResumeContext | null> => {
    try {
      const response = await fetch("/api/lex/resume-context", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!data?.success) return null;

      const context: ResumeContext = {
        hasResume: !!data.resumeStatus?.hasAnyResumes,
        totalResumes: data.resumeStatus?.totalResumes || 0,
        analyzedResumes: data.resumeStatus?.analyzedResumes || 0,
        averageScore: data.resumeStatus?.averageScore,
        builderResumes: data.resumeStatus?.builderResumes || 0,
      };

      if (data.resumeContext?.masterResume) {
        const masterAnalysis = data.resumeContext.masterResume.automatedAnalysis;
        context.masterResume = {
          id: data.resumeContext.masterResume.id,
          fileName: data.resumeContext.masterResume.fileName,
          score: masterAnalysis?.overallScore,
          analysisStatus: masterAnalysis
            ? data.resumeContext.masterResume.lexAnalyses?.length > 0
              ? "complete"
              : "needs_lex_review"
            : "pending",
          uploadedAt: data.resumeContext.masterResume.uploadedAt,
          keyIssues: masterAnalysis?.resumeQuotes?.slice(0, 3).map((q: any) => q.issue),
          source: data.resumeContext.masterResume.source || "upload",
        };
      }

      setResumeContext(context);
      return context;
    } catch (e) {
      console.error("Failed to load resume context:", e);
      return null;
    }
  };

  const loadJobAnalysisStats = async (): Promise<JobAnalysisStats | null> => {
    try {
      if (!effectiveUserId) return null;

      const response = await fetch("/api/job-analysis", {
        cache: "no-store",
      });

      const raw = await response.text();
      if (!raw) return null;

      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        console.warn("[job-analysis] non-JSON response preview:", raw.slice(0, 250));
        return null;
      }

      if (!data?.success) return null;

      const analyses = Array.isArray(data.analyses) ? data.analyses : [];
      const saved = analyses.filter((a: any) => a.is_saved);

      // newest saved first
      saved.sort((a: any, b: any) => {
        const da = new Date(a.created_at || a.createdAt || 0).getTime();
        const db = new Date(b.created_at || b.createdAt || 0).getTime();
        return db - da;
      });

      const mostRecent = saved[0];

      const stats: JobAnalysisStats = {
        totalAnalyses: analyses.length,
        savedAnalyses: saved.length,
        appliedCount: analyses.filter((a: any) => a.has_applied).length,
        emailApplications: analyses.filter((a: any) => a.application_email).length,
        recentJobId: mostRecent?.id,
        recentJobTitle: mostRecent?.job_title,
      };

      setJobAnalysisStats(stats);

      // IMPORTANT: compute match scores using your current API (POST), not the broken GET list
      await loadHighMatchJobs(saved);

      return stats;
    } catch (e) {
      console.error("Failed to load job analysis stats:", e);
      return null;
    }
  };

  /**
   * FIXED: loadHighMatchJobs
   * Your current /api/resume-job-match GET requires resumeId+jobAnalysisId.
   * So instead we:
   * - take your master resume id
   * - POST for top N saved analyses to compute/cache match scores
   * - filter >= 80
   */
  const loadHighMatchJobs = async (savedAnalyses: any[]) => {
    try {
      if (!effectiveUserId) return;

      const resumeId = resumeContext.masterResume?.id;
      if (!resumeId) {
        setHighMatchJobs([]);
        setWeeklyTrend(0);
        return;
      }

      const candidates = (savedAnalyses || []).slice(0, 12); // keep it light

      if (candidates.length === 0) {
        setHighMatchJobs([]);
        setWeeklyTrend(0);
        return;
      }

      const results = await Promise.all(
        candidates.map(async (a: any) => {
          try {
            const r = await fetch("/api/resume-job-match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                resumeId,
                jobAnalysisId: a.id,
              }),
            });

            const raw = await r.text();
            if (!raw) return null;

            const data = JSON.parse(raw);
            if (!data?.success) return null;

            // matchScore is returned by your calculator API response
            const score =
              typeof data?.match?.matchScore === "number"
                ? data.match.matchScore
                : typeof data?.matchScore === "number"
                ? data.matchScore
                : typeof data?.match?.match_score === "number"
                ? data.match.match_score
                : 0;

            return {
              id: a.id,
              jobTitle: a.job_title || a.title || "Unknown Position",
              company: a.company_name || a.company || "Unknown Company",
              matchScore: score,
            } as HighMatchJob;
          } catch {
            return null;
          }
        })
      );

      const highMatches = results
        .filter(Boolean)
        .filter((j: any) => (j.matchScore ?? 0) >= 80)
        .sort((a: any, b: any) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

      setHighMatchJobs(highMatches);

      if (highMatches.length > 0) {
        const avgMatch = Math.round(highMatches.reduce((sum: number, job: any) => sum + (job.matchScore || 0), 0) / highMatches.length);
        const trend = avgMatch > 85 ? 8 : avgMatch > 80 ? 5 : 3;
        setWeeklyTrend(trend);
      } else {
        setWeeklyTrend(0);
      }
    } catch (e) {
      console.error("Failed to load high match jobs:", e);
      setHighMatchJobs([]);
      setWeeklyTrend(0);
    }
  };

  const buildInitialLexMessage = (rc: ResumeContext | null, js: JobAnalysisStats | null) => {
    const resumeOk = !!rc?.hasResume;
    const totalJobs = js?.totalAnalyses || 0;

    if (!resumeOk && totalJobs === 0) {
      return "Hi! I'm Lex, your career strategist. You’re at the perfect starting point—upload a resume or build one from scratch. What do you want to do first?";
    }
    if (!resumeOk && totalJobs > 0) {
      return `Welcome back! You analyzed ${totalJobs} job posting(s). Upload a resume so I can match you to your best opportunities.`;
    }
    if (resumeOk && totalJobs === 0) {
      const mr = rc?.masterResume;
      if (mr?.analysisStatus === "complete" && mr?.score) {
        return `Your resume "${mr.fileName}" scored ${mr.score}/100. Ready to analyze jobs and tailor for specific roles?`;
      }
      return `Welcome back! I see "${mr?.fileName}". Let’s complete analysis, then start job research.`;
    }

    const mr = rc?.masterResume;
    const scoreText = mr?.score ? ` (scored ${mr.score}/100)` : "";
    const savedText = (js?.savedAnalyses || 0) > 0 ? `With ${js?.savedAnalyses} saved, ` : "";
    return `Perfect setup! You have your resume analyzed${scoreText} and researched ${totalJobs} job posting(s). ${savedText}What’s your next priority?`;
  };

  const initializeDashboard = async () => {
    setIsLoadingContext(true);

    try {
      // loadApplicationsCount doesn't depend on others
      await loadApplicationsCount();

      // loadResumeContext first so we have masterResume.id
      const rc = await loadResumeContext();
      const js = await loadJobAnalysisStats();

      setChatMessages([
        {
          id: "1",
          sender: "lex",
          message: buildInitialLexMessage(rc, js),
          timestamp: new Date(),
        },
      ]);
    } catch (e) {
      console.error("Dashboard initialization failed:", e);
      setChatMessages([
        {
          id: "1",
          sender: "lex",
          message: "I hit a loading issue. Refresh the page—if it persists, check your API routes.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoadingContext(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || !effectiveUserId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      message: message.trim(),
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsLexThinking(true);

    try {
      const response = await fetch("/api/lex/dashboard-guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          resumeContext,
          jobAnalysisStats,
          applicationsCount,
        }),
      });

      if (!response.ok) throw new Error("Failed to get Lex response");

      const data = await response.json();

      const lexMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "lex",
        message: data.response,
        timestamp: new Date(),
        navigationSuggestion: data.navigationSuggestion,
      };

      setChatMessages((prev) => [...prev, lexMessage]);

      if (data.contextUpdated) {
        await Promise.all([loadResumeContext(), loadJobAnalysisStats(), loadApplicationsCount()]);
      }
    } catch (e) {
      console.error("Error sending message to Lex:", e);
      setChatMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: "lex", message: "Connection issue—try again.", timestamp: new Date() },
      ]);
    } finally {
      setIsLexThinking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput);
    }
  };

  const handleTailorResumeClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (!resumeContext.hasResume) {
      router.push("/career-studio/resume-manager");
      return;
    }

    if (jobAnalysisStats.savedAnalyses === 0) {
      router.push("/career-studio/job-analysis");
      return;
    }

    const params = new URLSearchParams();
    if (resumeContext.masterResume?.id) params.set("masterResumeId", resumeContext.masterResume.id);
    if (jobAnalysisStats.recentJobId) params.set("jobAnalysisId", jobAnalysisStats.recentJobId);

    router.push(`/career-studio/tailor-resume?${params.toString()}`);
  };

  /**
   * FIXED: trackApplication payload
   * Your /api/applications POST requires job_title + company_name.
   * We send those + job_analysis_id.
   */
  const trackApplication = async (jobAnalysisId: string) => {
    if (!jobAnalysisId) return;
    setTrackingJobId(jobAnalysisId);

    try {
      const job = highMatchJobs.find((j) => j.id === jobAnalysisId);

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_analysis_id: jobAnalysisId,
          job_title: job?.jobTitle || "Unknown Position",
          company_name: job?.company || "Unknown Company",
          status: "saved",
        }),
      });

      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (res.ok && data?.success && data.application?.id) {
        await loadApplicationsCount();
        router.push(`/career-studio/applications`);
        return;
      }

      console.error("Track failed:", { status: res.status, data, rawPreview: raw?.slice?.(0, 250) });
    } catch (e) {
      console.error("Failed to track application:", e);
    } finally {
      setTrackingJobId(null);
    }
  };

  const stats = {
    applications: applicationsCount,
    resumes: resumeContext.totalResumes,
    jobAnalyses: jobAnalysisStats.totalAnalyses,
    avgScore: resumeContext.averageScore || 0,
  };

  // ---------- UI components ----------
  const StatMini = ({ label, value }: { label: string; value: string }) => (
    <div className="text-center">
      <div className="text-lg font-semibold text-[#9333EA]">{value}</div>
      <div className="text-[10px] text-white/50 mt-0.5">{label}</div>
    </div>
  );

  const HeroSection = () => (
    <section className="relative overflow-hidden rounded-2xl bg-black border border-white/10 shadow-2xl">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#9333EA]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-[10%] w-[200px] h-[200px] bg-blue-500/10 rounded-full blur-[80px]" />
        <div className="absolute top-[30%] right-[5%] w-[180px] h-[180px] bg-violet-500/10 rounded-full blur-[70px]" />
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.06),transparent)] bg-[length:100%_6px]" />
      </div>

      <div className="relative z-10 p-6 sm:p-8">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-12 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9333EA]" />
              ThinkWrite • Career OS
            </div>

            <h1 className="text-[32px] sm:text-[42px] lg:text-[52px] font-extralight leading-[1] tracking-tight">
              <span className="text-white/80">See your</span>
              <br />
              <span className="text-[#9333EA]">next move</span>
              <br />
              <span className="text-white/50">before you make it.</span>
            </h1>

            <p className="text-white/40 text-sm font-light max-w-md leading-relaxed">
              Track resume strength, analyzed roles, and weekly momentum in one place.
            </p>

            <div className="grid grid-cols-4 gap-3 pt-2">
              <StatMini label="Applications" value={String(stats.applications)} />
              <StatMini label="Resumes" value={String(stats.resumes)} />
              <StatMini label="Analyses" value={String(stats.jobAnalyses)} />
              <StatMini label="Avg Score" value={stats.avgScore > 0 ? String(stats.avgScore) : "--"} />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => {
                  if (!resumeContext.hasResume) {
                    router.push("/career-studio/resume-manager");
                  } else {
                    router.push("/career-studio/job-analysis");
                  }
                }}
                className="px-5 py-2.5 rounded-lg bg-[#9333EA] text-white text-sm font-medium hover:bg-[#7E22CE] transition-colors"
              >
                Run career scan
              </button>

              <button
                onClick={() => chatInputRef.current?.focus()}
                className="px-5 py-2.5 rounded-lg border border-white/15 text-white/60 text-sm hover:border-white/30 hover:text-white/80 transition-colors"
              >
                Talk to Lex
              </button>
            </div>
          </div>

        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex flex-wrap items-center gap-4">
          <span className="text-[9px] uppercase tracking-widest text-white/40">Live Signals</span>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/60">
            {resumeContext.hasResume && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Resume analyzed
                </span>
                <span className="text-white/20">•</span>
              </>
            )}

            {highMatchJobs.length > 0 ? (
              <span>
                Top match:{" "}
                <span className="text-[#9333EA]">
                  {highMatchJobs[0].company} · {highMatchJobs[0].matchScore}%
                </span>
              </span>
            ) : jobAnalysisStats.totalAnalyses > 0 ? (
              <span>{jobAnalysisStats.totalAnalyses} jobs analyzed</span>
            ) : (
              <span>Analyze jobs to see match signals</span>
            )}

            {highMatchJobs.length > 1 && (
              <>
                <span className="text-white/20">•</span>
                <span>{highMatchJobs.length} high-match roles found</span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  // --- (everything below is your existing UI; unchanged except it now uses the fixed data) ---

  const getRecentActivity = () => {
    const items: Array<{ id: string; title: string; subtitle: string; timestamp: string; icon: string }> = [];

    if (resumeContext.masterResume) {
      items.push({
        id: "resume-master",
        title: resumeContext.masterResume.fileName,
        subtitle:
          resumeContext.masterResume.analysisStatus === "complete"
            ? `Score: ${resumeContext.masterResume.score}/100`
            : resumeContext.masterResume.analysisStatus === "needs_lex_review"
            ? "Ready for review"
            : "Processing",
        timestamp: new Date(resumeContext.masterResume.uploadedAt).toLocaleDateString(),
        icon: "RM",
      });
    }

    if (jobAnalysisStats.totalAnalyses > 0) {
      items.push({
        id: "job-analyses",
        title: "Job Analysis Activity",
        subtitle: `${jobAnalysisStats.totalAnalyses} analyzed, ${jobAnalysisStats.savedAnalyses} saved`,
        timestamp: "Recent",
        icon: "JA",
      });
    }

    items.push({
      id: "sample-1",
      title: "Sample: Product Manager — Adobe",
      subtitle: "Example activity card",
      timestamp: "—",
      icon: "NEW",
    });

    return items.slice(0, 4);
  };

  const getTailorResumeStatus = () => {
    if (!resumeContext.hasResume) {
      return { enabled: false, subtitle: "Upload resume first", href: "/career-studio/resume-manager" };
    }
    if (jobAnalysisStats.savedAnalyses === 0) {
      return { enabled: false, subtitle: "Save a job first", href: "/career-studio/job-analysis" };
    }
    return { enabled: true, subtitle: `${jobAnalysisStats.savedAnalyses} jobs ready`, href: "/career-studio/tailor-resume" };
  };

  const getQuickActions = () => {
    const tailorStatus = getTailorResumeStatus();
    return [
      { title: "Resume Manager", subtitle: resumeContext.hasResume ? `${resumeContext.totalResumes} resume(s)` : "Upload resumes", icon: "RM", href: "/career-studio/resume-manager", onClick: undefined as undefined | ((e: React.MouseEvent) => void), isNew: false, highlight: false },
      { title: "Build Resume", subtitle: "Create with Lex", icon: "BR", href: "/career-studio/resume-builder", onClick: undefined, isNew: true, highlight: false },
      { title: "Job Analysis", subtitle: jobAnalysisStats.totalAnalyses > 0 ? `${jobAnalysisStats.totalAnalyses} analyzed` : "Decode postings", icon: "JA", href: "/career-studio/job-analysis", onClick: undefined, isNew: false, highlight: false },
      { title: "Tailor Resume", subtitle: tailorStatus.subtitle, icon: "TR", href: tailorStatus.href, onClick: handleTailorResumeClick, isNew: false, highlight: tailorStatus.enabled },
      { title: "Assessment", subtitle: "Get your roadmap", icon: "AS", href: "/career-studio/assessment", onClick: undefined, isNew: true, highlight: false },
      { title: "Applications", subtitle: `Track ${stats.applications}`, icon: "AP", href: "/career-studio/applications", onClick: undefined, isNew: false, highlight: false },
    ];
  };

  const getContextualQuickActions = () => {
    if (!resumeContext.hasResume && jobAnalysisStats.totalAnalyses === 0) {
      return [
        { text: "Help me upload my resume", action: "I need help uploading my resume" },
        { text: "Build a new resume", action: "I want to build a new resume from scratch" },
        { text: "Best career strategy?", action: "What's the best career strategy?" },
      ];
    }
    if (!resumeContext.hasResume) {
      return [
        { text: "Upload resume to match", action: "I want to upload my resume" },
        { text: "Build resume for jobs", action: "Help me build a resume" },
        { text: "Review my research", action: "Let's review the job research" },
      ];
    }
    if (jobAnalysisStats.totalAnalyses === 0) {
      return [
        { text: "Find matching jobs", action: "Help me find jobs that match" },
        { text: "Improve resume score", action: "How can I improve my score?" },
        { text: "Start analyzing jobs", action: "I want to analyze job postings" },
      ];
    }
    return [
      { text: "Tailor for saved jobs", action: "Help me tailor my resume" },
      { text: "Review strategy", action: "Review my application strategy" },
      { text: "Prioritize opportunities", action: "Help me prioritize" },
    ];
  };

  const OverviewPanel = () => {
    const displayJobs = highMatchJobs.length > 0 ? highMatchJobs.slice(0, 3) : [];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <h3 className="text-xs font-medium text-white/60 mb-3">Top Opportunities</h3>
          <div className="space-y-2">
            {displayJobs.length > 0 ? (
              displayJobs.map((job, i) => (
                <div
                  key={`${job.id}-${i}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-white/50 text-xs">{job.company?.[0] ?? "?"}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white/85 truncate">{job.jobTitle}</p>
                      <p className="text-[10px] text-white/40 truncate">{job.company}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className={`text-base font-light ${job.matchScore >= 90 ? "text-emerald-400" : "text-white/80"}`}>
                      {job.matchScore}%
                    </span>

                    <button
                      onClick={() => trackApplication(job.id)}
                      disabled={trackingJobId === job.id}
                      className={`text-[10px] px-2 py-1 rounded-md border transition ${
                        trackingJobId === job.id
                          ? "border-white/10 text-white/30 bg-white/[0.02] cursor-not-allowed"
                          : "border-[#9333EA]/30 text-[#9333EA] hover:bg-[#9333EA]/10"
                      }`}
                      title="Create an application tracker for this job"
                    >
                      {trackingJobId === job.id ? "Tracking..." : "Track"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                <p className="text-white/40 text-sm">No high-match jobs yet</p>
                <p className="text-white/30 text-[10px] mt-1">
                  {!resumeContext.hasResume ? "Upload a resume to start matching" : "Analyze jobs to see your top matches"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-white/60 mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {getRecentActivity().map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center flex-shrink-0 text-xs">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/85 truncate">{item.title}</p>
                  <p className="text-[10px] text-white/40 truncate">{item.subtitle}</p>
                </div>
                <span className="text-[9px] text-white/30 flex-shrink-0">{item.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const OpportunitiesPanel = () => {
    const displayJobs = highMatchJobs.length > 0 ? highMatchJobs : [];

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-white/60">All Opportunities</h3>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/30 overflow-hidden">
          {displayJobs.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {displayJobs.map((job, i) => (
                <div key={`${job.id}-${i}`} className="group flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-[#9333EA]/30">
                      <span className="text-white/50 text-sm">{job.company?.[0] ?? "?"}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm text-white/85 truncate group-hover:text-[#9333EA] transition-colors">{job.jobTitle}</h4>
                      <p className="text-[10px] text-white/40 truncate">{job.company}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className={`text-lg font-extralight ${job.matchScore >= 90 ? "text-emerald-400" : "text-white/80"}`}>
                      {job.matchScore}%
                    </span>

                    <button
                      onClick={() => trackApplication(job.id)}
                      disabled={trackingJobId === job.id}
                      className={`text-[10px] px-2 py-1 rounded-md border transition ${
                        trackingJobId === job.id
                          ? "border-white/10 text-white/30 bg-white/[0.02] cursor-not-allowed"
                          : "border-[#9333EA]/30 text-[#9333EA] hover:bg-[#9333EA]/10"
                      }`}
                    >
                      {trackingJobId === job.id ? "Tracking..." : "Track"}
                    </button>

                    <svg className="w-4 h-4 text-white/20 group-hover:text-[#9333EA]/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-white/40 text-sm">No opportunities matched yet</p>
              <p className="text-white/30 text-[10px] mt-1">
                {!resumeContext.hasResume ? "Upload a resume and analyze jobs to see matches" : "Compare your resume against saved jobs to find matches"}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const ProgressPanel = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-xs font-medium text-white/60 mb-3">Career Progress</h3>
        <div className="space-y-3">
          {[
            { label: "Response Rate", value: "25%", percent: 25 },
            { label: "Interviews", value: "8", percent: 80 },
            { label: "Offers", value: "2", percent: 40, highlight: true },
            { label: "Resume Score", value: String(stats.avgScore || "--"), percent: stats.avgScore || 0 },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-white/50">{item.label}</span>
                <span className={`text-base font-medium ${item.highlight ? "text-[#9333EA]" : "text-white/80"}`}>{item.value}</span>
              </div>
              <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${item.highlight ? "bg-[#9333EA]" : "bg-white/40"}`} style={{ width: `${item.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-medium text-white/60 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          {getQuickActions().map((action, i) => (
            <div key={i}>
              {action.onClick ? (
                <button
                  onClick={action.onClick}
                  className={`w-full text-left p-3 rounded-xl bg-white/[0.03] border hover:bg-white/[0.05] transition-colors ${
                    action.highlight ? "border-[#9333EA]/30" : "border-white/[0.06]"
                  }`}
                >
                  {action.isNew && (
                    <span className="float-right text-[8px] px-1.5 py-0.5 bg-[#9333EA] text-white rounded font-medium">NEW</span>
                  )}
                  <div className="w-7 h-7 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center text-sm mb-2">
                    {action.icon}
                  </div>
                  <p className="text-sm text-white/80">{action.title}</p>
                  <p className="text-[10px] text-white/40">{action.subtitle}</p>
                </button>
              ) : (
                <Link href={action.href}>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                    {action.isNew && (
                      <span className="float-right text-[8px] px-1.5 py-0.5 bg-[#9333EA] text-white rounded font-medium">NEW</span>
                    )}
                    <div className="w-7 h-7 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center text-sm mb-2">
                      {action.icon}
                    </div>
                    <p className="text-sm text-white/80">{action.title}</p>
                    <p className="text-[10px] text-white/40">{action.subtitle}</p>
                  </div>
                </Link>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={!resumeContext.hasResume ? () => router.push("/career-studio/resume-builder") : handleTailorResumeClick}
          className="w-full mt-3 p-4 rounded-xl bg-white/[0.03] border border-[#9333EA]/20 hover:bg-white/[0.05] hover:border-[#9333EA]/40 transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80 font-medium flex items-center gap-2">
                <span className="text-[#9333EA]">Next</span>
                {!resumeContext.hasResume ? "Build Your Resume" : jobAnalysisStats.savedAnalyses > 0 ? "Tailor Resume Now" : "Analyze Jobs First"}
              </p>
              <p className="text-[10px] text-white/40 mt-0.5">
                {!resumeContext.hasResume ? "Create with Lex's guidance" : jobAnalysisStats.savedAnalyses > 0 ? `${jobAnalysisStats.savedAnalyses} jobs ready` : "Find jobs to tailor for"}
              </p>
            </div>
            <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );

  const ControlCenter = () => (
    <section className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Career Studio</p>
          <h2 className="text-lg font-medium text-white mt-0.5">Control Center</h2>
        </div>

        <div className="inline-flex items-center rounded-full bg-white/5 p-0.5 border border-white/10 text-[11px]">
          {(
            [
              ["overview", "Overview"],
              ["opportunities", "Opportunities"],
              ["progress", "Progress"],
            ] as [MainView, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMainView(key)}
              className={`px-3 py-1.5 rounded-full transition-all ${
                mainView === key ? "bg-[#9333EA] text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mainView === "overview" && <OverviewPanel />}
      {mainView === "opportunities" && <OpportunitiesPanel />}
      {mainView === "progress" && <ProgressPanel />}
    </section>
  );

  const LexSidebar = () => (
    <div className="w-72 flex-shrink-0">
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#9333EA] to-violet-700 flex items-center justify-center">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-black" />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-base">Lex</h3>
            <p className="text-white/50 text-[11px] truncate">
              Career Strategist
              {resumeContext.hasResume && <span className="text-[#9333EA]"> • Ready</span>}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {resumeContext.hasResume && resumeContext.masterResume && (
            <div className="p-2.5 bg-white/[0.04] rounded-lg border border-white/[0.08]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/60 truncate max-w-[140px]">{resumeContext.masterResume.fileName}</span>
                {resumeContext.masterResume.score && (
                  <span className="text-emerald-400 font-bold flex-shrink-0">{resumeContext.masterResume.score}/100</span>
                )}
              </div>
            </div>
          )}

          {jobAnalysisStats.totalAnalyses > 0 && (
            <div className="p-2.5 bg-white/[0.04] rounded-lg border border-white/[0.08]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/60">Jobs Analyzed</span>
                <span className="text-emerald-400 font-bold">{jobAnalysisStats.totalAnalyses}</span>
              </div>
            </div>
          )}

          {/* Mirror Mode Voice Status */}
          <Link href="/mirror-mode">
            <div className="p-2.5 bg-white/[0.04] rounded-lg border border-white/[0.08] hover:bg-white/[0.06] transition-colors cursor-pointer">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/60 flex items-center gap-1.5">
                  <span className="text-violet-400"></span> Voice Profile
                </span>
                <span className={voiceStatus.confidenceLevel >= 65 ? "text-emerald-400 font-bold" : voiceStatus.confidenceLevel >= 25 ? "text-[#9333EA] font-medium" : "text-white/50"}>
                  {voiceStatus.isLoading ? "..." : voiceStatus.confidenceLabel}
                </span>
              </div>
              {!voiceStatus.isLoading && voiceStatus.exists && (
                <div className="text-[9px] text-white/40 mt-1">
                  {voiceStatus.documentCount} doc{voiceStatus.documentCount !== 1 ? 's' : ''} learned • {voiceStatus.confidenceLevel}%
                </div>
              )}
              {!voiceStatus.isLoading && !voiceStatus.exists && (
                <div className="text-[9px] text-white/40 mt-1">
                  Tap to teach your writing voice
                </div>
              )}
            </div>
          </Link>

          {resumeContext.hasResume && jobAnalysisStats.savedAnalyses > 0 && (
            <button
              onClick={handleTailorResumeClick}
              className="w-full p-2.5 bg-white/[0.04] rounded-lg border border-[#9333EA]/30 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#9333EA] font-medium">Ready to Tailor</span>
                <span className="text-white/40">→</span>
              </div>
            </button>
          )}
        </div>

        <div ref={chatContainerRef} className="bg-black/50 rounded-lg p-3 mb-3 border border-white/[0.06] h-40 overflow-y-auto">
          {isLoadingContext ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-[#9333EA] rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-[#9333EA] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-1.5 h-1.5 bg-[#9333EA] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={msg.sender === "user" ? "text-right" : "text-left"}>
                  {msg.sender === "user" ? (
                    <div className="bg-[#9333EA]/20 rounded-lg px-2.5 py-1.5 inline-block max-w-[90%]">
                      <p className="text-white/90 text-[11px] break-words">{msg.message}</p>
                    </div>
                  ) : (
                    <div className="bg-white/[0.06] rounded-lg px-2.5 py-1.5 inline-block max-w-[90%]">
                      <p className="text-white/80 text-[11px] leading-relaxed break-words">{msg.message}</p>
                    </div>
                  )}
                </div>
              ))}

              {isLexThinking && (
                <div className="text-left">
                  <div className="bg-white/[0.06] rounded-lg px-2.5 py-1.5 inline-block">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5 mb-3">
          {getContextualQuickActions().map((action, i) => (
            <button
              key={i}
              onClick={() => sendMessage(action.action)}
              className="w-full text-left p-2 rounded-lg bg-black/40 hover:bg-black/60 transition-colors text-white/70 text-[11px] border border-white/[0.06]"
            >
              {action.text}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            ref={chatInputRef}
            type="text"
            placeholder="Ask Lex..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLexThinking || isLoadingContext}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 pr-9 text-white text-[11px] placeholder-white/30 focus:outline-none focus:border-[#9333EA]/50 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(chatInput)}
            disabled={!chatInput.trim() || isLexThinking || isLoadingContext}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#9333EA] rounded flex items-center justify-center hover:bg-[#7E22CE] transition-colors disabled:opacity-50"
          >
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  const GlobalBackground = () => (
    <div className="fixed inset-0 pointer-events-none -z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] to-black" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[#9333EA]/[0.03] rounded-full blur-[150px]" />
      <div className="absolute bottom-[20%] left-[10%] w-[300px] h-[300px] bg-blue-600/[0.02] rounded-full blur-[100px]" />
      <div className="absolute top-[30%] right-[10%] w-[250px] h-[250px] bg-violet-600/[0.02] rounded-full blur-[80px]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <GlobalBackground />

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex gap-6">
            <LexSidebar />
            <div className="flex-1 min-w-0 space-y-6">
              <HeroSection />
              <ControlCenter />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
