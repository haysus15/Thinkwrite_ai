"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Target,
  AlertTriangle,
  Building2,
  FileText,
  Sparkles,
} from "lucide-react";

import type { JobAnalysisResult } from "../../../types/job-analysis";
import JobInputForm from "./JobInputForm";
import SavedAnalysesSidebar from "./SavedAnalysesSidebar";
import AnalysisResults from "./AnalysisResults";

type CtaMode = "default" | "coverletter";

export default function JobAnalysisInterface() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ------------------------------------------------------------
  // Cover Letter selection mode
  // ------------------------------------------------------------
  const selectForCoverLetter = searchParams.get("selectForCoverLetter") === "true";
  const returnResumeId = searchParams.get("returnResumeId") || "";

  const [currentAnalysis, setCurrentAnalysis] = useState<JobAnalysisResult | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Cover letter selection state
  const [selectedJobForCoverLetter, setSelectedJobForCoverLetter] = useState<string | null>(null);

  // UI polish
  const [scrollY, setScrollY] = useState(0);
  const shellScrollRef = useRef<HTMLDivElement | null>(null);

  const fitScore = deriveFitScore(currentAnalysis);
  const jobTitle = (currentAnalysis as any)?.job_title ?? (currentAnalysis as any)?.title;
  const company =
    (currentAnalysis as any)?.company ??
    (currentAnalysis as any)?.company_name ??
    (currentAnalysis as any)?.organization;

  const selectedJobDetails = useMemo(
    () => savedAnalyses.find((a) => a.id === selectedJobForCoverLetter),
    [savedAnalyses, selectedJobForCoverLetter]
  );

  const ctaMode: CtaMode = selectForCoverLetter ? "coverletter" : "default";

  useEffect(() => {
    loadSavedAnalyses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = shellScrollRef.current;
    if (!el) return;

    const onScroll = () => setScrollY(el.scrollTop || 0);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const loadSavedAnalyses = async () => {
    try {
      const response = await fetch("/api/job-analysis");
      const data = await response.json();
      if (data.success) setSavedAnalyses(data.analyses || []);
    } catch (error) {
      console.error("Failed to load saved analyses:", error);
    }
  };

  const handleJobAnalysis = async (content: string, isUrl: boolean) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/job-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, isUrl }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentAnalysis(data.analysis);
        await loadSavedAnalyses();
      } else {
        console.error("Analysis failed:", data.error);
      }
    } catch (error) {
      console.error("Analysis request failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAnalysis = async (analysisId: string) => {
    try {
      const response = await fetch(
        `/api/job-analysis/${analysisId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_saved: true }),
        }
      );
      if (response.ok) await loadSavedAnalyses();
    } catch (error) {
      console.error("Failed to save analysis:", error);
    }
  };

  const handleMarkApplied = async (analysisId: string) => {
    try {
      const response = await fetch(
        `/api/job-analysis/${analysisId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ has_applied: true, applied_at: new Date().toISOString() }),
        }
      );
      if (response.ok) await loadSavedAnalyses();
    } catch (error) {
      console.error("Failed to mark as applied:", error);
    }
  };

  const handleDiscussWithLex = (analysisId: string) => {
  router.push(
    `/career-studio/lex?mode=job-analysis&jobId=${encodeURIComponent(analysisId)}`
  );
};

  const handleSendToTailor = (analysisId: string) => {
  router.push(
    `/career-studio/tailor-resume?jobAnalysisId=${encodeURIComponent(analysisId)}`
  );
};

  // ------------------------------------------------------------
  // Send to Cover Letter
  // ------------------------------------------------------------
  const handleSendToCoverLetter = (analysisId: string) => {
    const params = new URLSearchParams();
    params.set("jobAnalysisId", analysisId);
    if (returnResumeId) params.set("resumeId", returnResumeId);
    router.push(`/career-studio/cover-letter?${params.toString()}`);
  };

  // Cover letter selection list
  const handleSelectForCoverLetter = (analysisId: string) => setSelectedJobForCoverLetter(analysisId);

  const handleConfirmCoverLetterSelection = () => {
    if (selectedJobForCoverLetter) handleSendToCoverLetter(selectedJobForCoverLetter);
  };

  const handleLoadSavedAnalysis = async (analysisId: string) => {
    try {
      const response = await fetch(`/api/job-analysis/${analysisId}`);
      const data = await response.json();

      if (data.success) {
        setCurrentAnalysis(data.analysis);
        if (selectForCoverLetter) setSelectedJobForCoverLetter(analysisId);
      }
    } catch (error) {
      console.error("Failed to load analysis:", error);
    }
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    try {
      const response = await fetch(
        `/api/job-analysis/${analysisId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        await loadSavedAnalyses();
        if ((currentAnalysis as any)?.id === analysisId) setCurrentAnalysis(null);
        if (selectedJobForCoverLetter === analysisId) setSelectedJobForCoverLetter(null);
      }
    } catch (error) {
      console.error("Failed to delete analysis:", error);
    }
  };

  const backHref = selectForCoverLetter
    ? "/career-studio/cover-letter"
    : "/career-studio";

  return (
    <Shell scrollRef={shellScrollRef} scrollY={scrollY}>
      {/* Cover Letter Selection Banner */}
      {selectForCoverLetter && (
        <div className="mb-6 bg-[#9333EA]/10 border border-[#9333EA]/30 rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#9333EA]/10 blur-[80px] rounded-full" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-500/10 blur-[90px] rounded-full" />
          </div>

          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#9333EA]/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#9333EA]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Select a Job for Cover Letter</p>
                <p className="text-xs text-white/60">
                  {selectedJobForCoverLetter
                    ? `Selected: ${selectedJobDetails?.job_title} at ${selectedJobDetails?.company_name}`
                    : "Click on a saved job below to select it"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(backHref)}
                className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmCoverLetterSelection}
                disabled={!selectedJobForCoverLetter}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedJobForCoverLetter
                    ? "bg-[#9333EA] text-white hover:bg-[#7E22CE]"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
              >
                Use for Cover Letter →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN */}
        <section className="w-full lg:w-[280px] flex-shrink-0 space-y-4">
          {/* Job input card */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#9333EA]/10 blur-[90px] rounded-full" />
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-violet-500/10 blur-[90px] rounded-full" />
            </div>

            <div className="relative">
              <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <span className="text-lg"></span>
                Analyze a job
              </h2>
              <p className="text-[11px] text-white/50 mb-3">
                Paste a LinkedIn URL, company careers link, or the full text of the posting.
              </p>

              <JobInputForm onAnalyze={handleJobAnalysis} isLoading={isAnalyzing} />

              <div className="mt-3 flex items-center gap-2 text-[10px] text-white/40">
                <Sparkles className="w-3 h-3 text-[#9333EA]" />
                Tip: save the best postings so Tailor & Cover Letter can pull them instantly.
              </div>
            </div>
          </div>

          {/* Saved analyses card */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-xl">
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <span className="text-lg"></span>
              Saved analyses
              {selectForCoverLetter && (
                <span className="text-[9px] px-1.5 py-0.5 bg-[#9333EA]/20 text-[#9333EA] rounded ml-auto">
                  SELECT ONE
                </span>
              )}
            </h2>

            <p className="text-[11px] text-white/50 mb-3">
              {selectForCoverLetter
                ? "Click a job to select it for your cover letter."
                : "Reopen jobs you've decoded, track which ones you applied to, and send any of them to Lex or Tailor Resume."}
            </p>

            {selectForCoverLetter ? (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {savedAnalyses.filter((a) => a.is_saved).length === 0 ? (
                  <p className="text-xs text-white/40 text-center py-4">No saved jobs yet. Analyze a job first!</p>
                ) : (
                  savedAnalyses
                    .filter((a) => a.is_saved)
                    .map((analysis) => (
                      <button
                        key={analysis.id}
                        onClick={() => {
                          handleSelectForCoverLetter(analysis.id);
                          handleLoadSavedAnalysis(analysis.id);
                        }}
                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                          selectedJobForCoverLetter === analysis.id
                            ? "border-[#9333EA] bg-[#9333EA]/10"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white/90 truncate">{analysis.job_title}</p>
                            <p className="text-xs text-white/50 truncate">{analysis.company_name}</p>
                            {analysis.location && <p className="text-[10px] text-white/30 mt-0.5">{analysis.location}</p>}
                          </div>
                          {selectedJobForCoverLetter === analysis.id && (
                            <div className="w-5 h-5 rounded-full bg-[#9333EA] flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs"></span>
                            </div>
                          )}
                        </div>

                        {analysis.has_applied && (
                          <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                            Applied
                          </span>
                        )}
                      </button>
                    ))
                )}
              </div>
            ) : (
              <SavedAnalysesSidebar
                analyses={savedAnalyses}
                onSelect={handleLoadSavedAnalysis}
                onMarkApplied={handleMarkApplied}
                onDiscussWithLex={handleDiscussWithLex}
                onDelete={handleDeleteAnalysis}
              />
            )}
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <section className="flex-1 min-w-0">
          {isAnalyzing ? (
            <AnalyzingCard />
          ) : currentAnalysis ? (
            <AnalysisResults
              analysis={currentAnalysis}
              onSave={handleSaveAnalysis}
              onDiscussWithLex={handleDiscussWithLex}
              onSendToTailor={handleSendToTailor}
              onSendToCoverLetter={handleSendToCoverLetter}
            />
          ) : (
            <EmptyState />
          )}
        </section>
      </div>
    </Shell>
  );
}

/* ============================================================
   SMALL UI COMPONENTS
============================================================ */

function FocusChip({
  active,
  label,
  icon,
  onEnter,
  onLeave,
  onClick,
  tone,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
  tone: "amber" | "red" | "blue";
}) {
  const toneClasses =
    tone === "amber"
      ? "hover:border-[#9333EA]/60 hover:text-[#9333EA]"
      : tone === "red"
      ? "hover:border-red-400/70 hover:text-red-300"
      : "hover:border-blue-400/70 hover:text-blue-300";

  const activeClasses =
    tone === "amber"
      ? "border-[#9333EA]/60 text-[#9333EA] bg-[#9333EA]/10"
      : tone === "red"
      ? "border-red-400/60 text-red-200 bg-red-500/10"
      : "border-blue-400/60 text-blue-200 bg-blue-500/10";

  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border bg-white/[0.03] text-white/75 transition-colors flex items-center gap-1 ${
        active ? activeClasses : `border-white/12 ${toneClasses}`
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AnalyzingCard() {
  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 shadow-xl text-center text-sm relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-[#9333EA]/10 blur-[110px] rounded-full" />
        <div className="absolute -bottom-24 right-0 w-[500px] h-[260px] bg-blue-500/10 blur-[110px] rounded-full" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent,rgba(255,255,255,0.04),transparent)] animate-[scan_2.2s_linear_infinite]" />
      </div>

      <div className="relative flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-[#9333EA] border-t-transparent rounded-full animate-spin" />
        <p className="text-white text-base font-semibold">Analyzing job posting…</p>
        <p className="text-white/60 text-xs max-w-md">
          I&apos;m scraping the posting, mapping the requirements, and looking for hidden signals in how
          they describe the role, team, and company.
        </p>
      </div>

      <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-white/55 max-w-xl mx-auto">
        {[
          {
            title: "Pass 1 · Surface details",
            bullets: ["Parse title, level, and location", "Identify must-have vs nice-to-have"],
          },
          {
            title: "Pass 2 · Hidden signals",
            bullets: ["Decode culture / red-flag language", "Look for signs of scope and chaos"],
          },
          {
            title: "Pass 3 · Company intel",
            bullets: ["Check for growth vs maintenance signals", "Infer how this role fits into the org"],
          },
          {
            title: "Pass 4 · Fit framing",
            bullets: ["Prepare how you should position yourself", "Highlight questions to ask in interview"],
          },
        ].map((card) => (
          <div key={card.title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
            <p className="font-semibold mb-1">{card.title}</p>
            <ul className="space-y-1 list-disc list-inside">
              {card.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% {
            transform: translateY(-80%);
            opacity: 0.2;
          }
          50% {
            opacity: 0.45;
          }
          100% {
            transform: translateY(120%);
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-10 shadow-xl text-center text-sm relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[340px] bg-[#9333EA]/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-24 left-0 w-[520px] h-[280px] bg-violet-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative">
        <div className="text-5xl mb-4"></div>
        <h2 className="text-xl font-semibold text-white mb-2">Ready to decode your next job posting</h2>
        <p className="text-white/65 max-w-xl mx-auto mb-6">
          Drop in any job description and I&apos;ll translate it like an insider: what&apos;s real, what&apos;s
          fluff, and how risky vs promising it actually looks.
        </p>

        <div className="space-y-3 text-[11px] text-white/60 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[#9333EA]"></span>
            <span>
              &quot;Fast-paced environment&quot; often means understaffed and reactive — I&apos;ll tell you when that&apos;s the case.
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[#9333EA]"></span>
            <span>Spot mismatches between responsibilities and seniority level before you waste time applying.</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[#9333EA]"></span>
            <span>Get questions to ask in the interview that make you sound like you&apos;ve already worked there.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FIT SCORE HELPERS
============================================================ */

function deriveFitScore(analysis: JobAnalysisResult | null): number | null {
  if (!analysis) return null;
  const a: any = analysis;

  const candidate =
    a.overallFitScore ??
    a.fitScore ??
    a.fit_score ??
    a.matchScore ??
    a.match_score ??
    null;

  if (typeof candidate !== "number" || Number.isNaN(candidate)) return null;
  return Math.max(0, Math.min(100, candidate));
}

function getFitScoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-[#9333EA]";
  return "text-red-400";
}

function getFitScoreLabel(score: number): string {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Decent match";
  if (score >= 40) return "Questionable match";
  return "Long shot";
}

/* ============================================================
   SHARED SHELL
============================================================ */

function Shell({
  children,
  scrollRef,
  scrollY,
}: {
  children: React.ReactNode;
  scrollRef: React.RefObject<HTMLDivElement>;
  scrollY: number;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <GlobalBackground scrollY={scrollY} />
      <div className="relative z-10 h-screen overflow-y-auto" ref={scrollRef}>
        <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function GlobalBackground({ scrollY }: { scrollY: number }) {
  const y = Math.min(120, Math.max(0, scrollY));
  return (
    <div className="fixed inset-0 pointer-events-none -z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a10] to-black" />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[520px] bg-[#9333EA]/[0.05] rounded-full blur-[160px]"
        style={{ transform: `translate(-50%, ${y * 0.08}px)` }}
      />
      <div
        className="absolute bottom-[18%] left-[8%] w-[340px] h-[340px] bg-blue-600/[0.03] rounded-full blur-[120px]"
        style={{ transform: `translateY(${-y * 0.06}px)` }}
      />
      <div
        className="absolute top-[32%] right-[8%] w-[280px] h-[280px] bg-violet-600/[0.03] rounded-full blur-[110px]"
        style={{ transform: `translateY(${y * 0.05}px)` }}
      />
      <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.9)_1px,transparent_0)] [background-size:18px_18px]" />
    </div>
  );
}
