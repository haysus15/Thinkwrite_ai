"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MatchScoreDisplay from "./MatchScoreDisplay";

interface Resume {
  id: string;
  fileName: string;
  atsScore?: number;
  isMasterResume?: boolean;
}

interface MatchResult {
  matchScore: number;
  skillsMatch: any;
  experienceMatch: any;
  educationMatch: any;
  technologiesMatch: any;
  gaps: string[];
  strengths: string[];
  recommendation: string;
}

interface ActionButtonsProps {
  analysisId: string;
  jobTitle: string;
  company: string;
  hasApplicationEmail: boolean;
  onSave: () => void;
  onDiscussWithLex: () => void;
  onSendToTailor?: () => void;
  onSendToCoverLetter?: () => void;
}

export default function ActionButtons({
  analysisId,
  jobTitle,
  company,
  hasApplicationEmail,
  onSave,
  onDiscussWithLex,
  onSendToTailor,
  onSendToCoverLetter,
}: ActionButtonsProps) {
  const router = useRouter();

  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [showResumeSelector, setShowResumeSelector] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [selectedResumeName, setSelectedResumeName] = useState<string>("");
  const [hasLoadedResumes, setHasLoadedResumes] = useState(false);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const [isTrackingApp, setIsTrackingApp] = useState(false);
  const [trackedToApps, setTrackedToApps] = useState(false);

  useEffect(() => {
    loadResumes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadResumes = async () => {
    try {
      const response = await fetch("/api/resumes");
      const data = await response.json();

      console.log(' Loaded resumes:', data.resumes?.length || 0);

      if (data.success && data.resumes) {
        setResumes(data.resumes);
        const masterResume = data.resumes.find((r: any) => r.isMasterResume);
        if (masterResume) {
          setSelectedResumeId(masterResume.id);
          setSelectedResumeName(masterResume.fileName);
        }
      }
      setHasLoadedResumes(true);
    } catch (error) {
      console.error("Failed to load resumes:", error);
      setHasLoadedResumes(true);
    }
  };

  const handleCompareClick = () => {
    if (resumes.length === 0) {
      alert("Please upload a resume first to compare against this job.");
      return;
    }

    if (resumes.length === 1) {
      setSelectedResumeId(resumes[0].id);
      setSelectedResumeName(resumes[0].fileName);
      performComparison(resumes[0].id);
    } else {
      setShowResumeSelector(true);
    }
  };

  const performComparison = async (resumeId: string) => {
    setIsComparing(true);
    setShowResumeSelector(false);

    try {
      const response = await fetch("/api/resume-job-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId,
          jobAnalysisId: analysisId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMatchResult(data.match);
        if (data.resumeName) setSelectedResumeName(data.resumeName);
      } else {
        alert(data.error || "Failed to calculate match");
      }
    } catch (error) {
      console.error("Comparison failed:", error);
      alert("Failed to compare resume to job. Please try again.");
    } finally {
      setIsComparing(false);
    }
  };

  const handleResumeSelect = (resumeId: string) => {
    const resume = resumes.find((r) => r.id === resumeId);
    if (resume) {
      setSelectedResumeId(resumeId);
      setSelectedResumeName(resume.fileName);
      performComparison(resumeId);
    }
  };

  const handleDiscussWithLexWithContext = () => {
    if (matchResult) {
      sessionStorage.setItem(
        "lexMatchContext",
        JSON.stringify({
          matchScore: matchResult.matchScore,
          gaps: matchResult.gaps,
          strengths: matchResult.strengths,
          recommendation: matchResult.recommendation,
          jobTitle,
          company,
          resumeName: selectedResumeName,
        })
      );
    }
    onDiscussWithLex();
  };

  const handleSaveToApplied = async () => {
    if (!analysisId) return;

    setTransitionError(null);
    setIsTransitioning(true);

    try {
      await Promise.resolve(onSave());

      const apiUrl = "/api/applications/transition";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_analysis_id: analysisId,
          applied_method: "company_website",
        }),
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Transition failed");

      router.push("/career-studio/applications");
    } catch (e: any) {
      console.error("Save → Applied failed:", e);
      setTransitionError(e?.message || "Save → Applied failed");
    } finally {
      setIsTransitioning(false);
    }
  };

  //  Track Application with FULL DEBUG
const handleTrackApplication = async () => {
  console.log(' ============ TRACK APP STARTED ============');
  console.log(' [Track App] analysisId:', analysisId);
  console.log(' [Track App] jobTitle:', jobTitle);
  console.log(' [Track App] company:', company);
  
  setIsTrackingApp(true);
  
  try {
    const payload: any = {
      status: 'saved',
      priority: 'medium',
    };

    //  CORRECT - job analysis IDs DO start with "job-"
    if (analysisId && analysisId.startsWith('job-')) {
      payload.job_analysis_id = analysisId;
      console.log(' [Track App] Including job_analysis_id:', analysisId);
    } else {
      payload.job_title = jobTitle || 'Unknown Position';
      payload.company_name = company || 'Unknown Company';
      console.log('️ [Track App] No valid analysisId, using manual fields');
    }

    console.log(' [Track App] Final payload:', JSON.stringify(payload, null, 2));

    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log(' [Track App] Response status:', response.status);
    console.log(' [Track App] Response ok:', response.ok);
    
    const data = await response.json();
    console.log(' [Track App] Response data:', JSON.stringify(data, null, 2));

    if (data.success || data.existing) {
      const appId = data.application?.id || data.existing?.id;
      console.log(' [Track App] SUCCESS - Application ID:', appId);
      
      setTrackedToApps(true);
      
      const navUrl = "/career-studio/applications";
      console.log(' [Track App] Will navigate to:', navUrl);
      
      setTimeout(() => {
        console.log(' [Track App] Navigating now...');
        router.push(navUrl);
      }, 1500);
    } else {
      console.error(' [Track App] FAILED - Error:', data.error);
      alert(' Failed to track application: ' + (data.error || 'Unknown error'));
      setIsTrackingApp(false);
    }
  } catch (error: any) {  //  Now properly after try block closes
    console.error(' [Track App] EXCEPTION:', error);
    console.error(' [Track App] Error stack:', error.stack);
    alert(' Failed to track application');
    setIsTrackingApp(false);
  }
  
  console.log('============ TRACK APP ENDED ============');
};

  return (
    <>
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">Next Steps</h3>

        {transitionError && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {transitionError}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Save Analysis */}
          <button
            onClick={onSave}
            className="flex flex-col items-center justify-center p-4 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl border border-white/[0.08] transition-all duration-200 hover:border-[#9333EA]/30 group"
          >
            <div className="w-10 h-10 bg-[#9333EA]/20 rounded-xl flex items-center justify-center mb-2 group-hover:bg-[#9333EA]/30 transition-colors">
              <svg className="w-5 h-5 text-[#9333EA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <span className="text-white font-medium text-xs mb-0.5">Save</span>
            <span className="text-white/50 text-[10px] text-center">Keep analysis</span>
          </button>

          {/* Track Application */}
          <button
            onClick={handleTrackApplication}
            disabled={isTrackingApp || trackedToApps}
            className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-emerald-500/20 to-blue-500/15 hover:from-emerald-500/30 hover:to-blue-500/25 rounded-xl border border-emerald-400/30 transition-all duration-200 hover:border-emerald-400/50 group disabled:opacity-60"
            title="Add to Applications pipeline for tracking"
          >
            <div className="w-10 h-10 bg-emerald-400/20 rounded-xl flex items-center justify-center mb-2 group-hover:bg-emerald-400/30 transition-colors">
              {isTrackingApp ? (
                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              ) : trackedToApps ? (
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              )}
            </div>
            <span className="text-white font-medium text-xs mb-0.5">
              {isTrackingApp ? "Tracking..." : trackedToApps ? "Tracked!" : "Track App"}
            </span>
            <span className="text-white/50 text-[10px] text-center">Pipeline</span>
          </button>

          {/* Save → Applied */}
          <button
            onClick={handleSaveToApplied}
            disabled={isTransitioning}
            className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#9333EA]/20 to-emerald-500/15 hover:from-[#9333EA]/30 hover:to-emerald-500/25 rounded-xl border border-[#9333EA]/30 transition-all duration-200 hover:border-[#9333EA]/50 group disabled:opacity-60"
            title="Save and mark as applied (one-click)"
          >
            <div className="w-10 h-10 bg-[#9333EA]/20 rounded-xl flex items-center justify-center mb-2 group-hover:bg-[#9333EA]/30 transition-colors">
              {isTransitioning ? (
                <div className="w-5 h-5 border-2 border-[#9333EA] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-[#9333EA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
              )}
            </div>
            <span className="text-white font-medium text-xs mb-0.5">
              {isTransitioning ? "Working..." : "Save → Applied"}
            </span>
            <span className="text-white/50 text-[10px] text-center">One-click</span>
          </button>

          {/* Compare to Resume */}
          <button
            onClick={handleCompareClick}
            disabled={isComparing || !hasLoadedResumes}
            className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 rounded-xl border border-purple-400/30 transition-all duration-200 hover:border-purple-400/50 group disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-purple-400/20 rounded-xl flex items-center justify-center mb-2 group-hover:bg-purple-400/30 transition-colors">
              {isComparing ? (
                <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
            </div>
            <span className="text-white font-medium text-xs mb-0.5">{isComparing ? "Comparing..." : "Compare"}</span>
            <span className="text-white/50 text-[10px] text-center">Match score</span>
          </button>

          {/* Discuss with Lex */}
          <button
            onClick={onDiscussWithLex}
            className="flex flex-col items-center justify-center p-4 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl border border-white/[0.08] transition-all duration-200 hover:border-purple-400/30 group"
          >
            <div className="w-10 h-10 bg-purple-400/20 rounded-xl flex items-center justify-center mb-2 group-hover:bg-purple-400/30 transition-colors">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-white font-medium text-xs mb-0.5">Lex</span>
            <span className="text-white/50 text-[10px] text-center">HR insights</span>
          </button>

          {/* Tailor Resume */}
          <button
            onClick={onSendToTailor}
            disabled={!onSendToTailor}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 group ${
              onSendToTailor
                ? "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.08] hover:border-emerald-400/30"
                : "bg-white/[0.01] border-white/[0.05] opacity-60 cursor-not-allowed"
            }`}
          >
            <div
              className={`w-10 h-10 bg-emerald-400/20 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                onSendToTailor ? "group-hover:bg-emerald-400/30" : ""
              }`}
            >
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-white font-medium text-xs mb-0.5">Tailor</span>
            <span className="text-white/50 text-[10px] text-center">Optimize resume</span>
          </button>

          {/* Cover Letter */}
          <button
            onClick={onSendToCoverLetter}
            disabled={!onSendToCoverLetter}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 group ${
              onSendToCoverLetter
                ? "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.08] hover:border-blue-400/30"
                : "bg-white/[0.01] border-white/[0.05] opacity-60 cursor-not-allowed"
            }`}
          >
            <div
              className={`w-10 h-10 bg-blue-400/20 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                onSendToCoverLetter ? "group-hover:bg-blue-400/30" : ""
              }`}
            >
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 2v5a2 2 0 002 2h5" />
              </svg>
            </div>
            <span className="text-white font-medium text-xs mb-0.5">Cover Letter</span>
            <span className="text-white/50 text-[10px] text-center">Generate letter</span>
          </button>

          {/* Apply (email found) */}
          {hasApplicationEmail && (
            <button className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 rounded-xl border border-blue-400/30 transition-all duration-200 hover:border-blue-400/50 group">
              <div className="w-10 h-10 bg-blue-400/20 rounded-xl flex items-center justify-center mb-2 group-hover:bg-blue-400/30 transition-colors">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-white font-medium text-xs mb-0.5">Apply</span>
              <span className="text-white/50 text-[10px] text-center">Email found</span>
            </button>
          )}
        </div>
      </div>

      {/* Resume Selector Modal */}
      {showResumeSelector && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Select Resume to Compare</h3>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {resumes.map((resume) => (
                <button
                  key={resume.id}
                  onClick={() => handleResumeSelect(resume.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedResumeId === resume.id
                      ? "bg-purple-500/20 border-purple-500/50"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{resume.fileName}</p>
                      <p className="text-white/60 text-sm">
                        {resume.isMasterResume && <span className="text-[#9333EA]"> Master Resume • </span>}
                        {resume.atsScore && `ATS Score: ${resume.atsScore}/100`}
                      </p>
                    </div>
                    {selectedResumeId === resume.id && (
                      <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowResumeSelector(false)}
                className="flex-1 py-3 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Results Display */}
      {matchResult && (
        <MatchScoreDisplay
          match={matchResult}
          resumeName={selectedResumeName}
          jobTitle={jobTitle}
          company={company}
          onClose={() => setMatchResult(null)}
          onDiscussWithLex={handleDiscussWithLexWithContext}
        />
      )}
    </>
  );
}
