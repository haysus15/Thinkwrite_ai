"use client";

import React, { useEffect, useState } from "react";

type InsightsData = {
  success: boolean;
  
  // Basic info
  id?: string;
  jobTitle?: string;
  companyName?: string;
  location?: string | null;
  status?: string;
  
  // Job Analysis - API returns camelCase!
  hiddenInsights: any;
  industryIntelligence: any;
  companyIntelligence: any;
  atsKeywords: any;
  requirements: string[] | null;
  
  // Tailored Resume
  tailoringLevel: string | null;
  changesAccepted: number | null;
  changesRejected: number | null;
  changesPending: number | null;
  resumeLexAssessment: string | null;
  resumeFinalized: boolean | null;
  resumeVersion: number | null;
  
  // Cover Letter
  voiceMatchScore: number | null;
  jobAlignmentScore: number | null;
  overallQualityScore: number | null;
  coverLetterLexSuggestions: any;
  
  // Readiness
  applicationReady: boolean;
  interviewReadyComplete: boolean;
  
  // Bundle flags - API returns camelCase!
  hasJobAnalysis: boolean;
  hasTailoredResume: boolean;
  hasCoverLetter: boolean;
};

type Props = {
  applicationId: string;
  userId?: string;
  onClose: () => void;
};

export default function ApplicationInsights({ applicationId, userId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      try {
        setLoading(true);
        const usp = new URLSearchParams();
        if (userId) usp.set("userId", userId);

        const res = await fetch(`/api/applications/${applicationId}/insights?${usp.toString()}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.error || "Failed to load insights");
          return;
        }

        setInsights(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, [applicationId, userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f] rounded-2xl border border-white/10 p-8 max-w-4xl w-full mx-4">
          <div className="text-white/60">Loading insights...</div>
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f] rounded-2xl border border-white/10 p-8 max-w-4xl w-full mx-4">
          <div className="text-red-400">Error: {error || "Not found"}</div>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Extract insights from the actual data structure
  const phraseTranslations = insights.hiddenInsights?.phraseTranslations || [];
  const redFlags = phraseTranslations.map((pt: any) => 
    `"${pt.original}" → ${pt.meaning} (${pt.severity} risk)`
  );
  
  const positiveSignals = insights.hiddenInsights?.positiveSignals || [];
  const greenFlags = positiveSignals.map((ps: any) => 
    `${ps.signal}: ${ps.interpretation}`
  );
  
  const cultureClues = insights.hiddenInsights?.cultureClues || [];
  const compensationSignals = insights.hiddenInsights?.compensationSignals || [];
  
  const salaryBenchmark = insights.industryIntelligence?.salaryBenchmark || null;
  const applicationTips = insights.industryIntelligence?.applicationTips || [];
  const interviewQuestions = insights.industryIntelligence?.interviewQuestions || [];
  
  const hardSkills = insights.atsKeywords?.hardSkills || [];
  const softSkills = insights.atsKeywords?.softSkills || [];
  const industryKeywords = insights.atsKeywords?.industryKeywords || [];
  
  const topKeywords = [
    ...hardSkills.slice(0, 5).map((hs: any) => hs.skill),
    ...softSkills.slice(0, 3).map((ss: any) => ss.skill),
    ...industryKeywords.slice(0, 4)
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f] rounded-2xl border border-white/10 max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-white/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-light text-white/90">{insights.jobTitle || "Job Position"}</h2>
              <p className="text-white/50 mt-1">{insights.companyName || "Company"}</p>
              {insights.location && (
                <p className="text-white/30 text-sm mt-0.5">{insights.location}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
            >
              Close
            </button>
          </div>

          {/* Readiness Badges */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs border ${
              insights.applicationReady 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-white/5 border-white/10 text-white/40"
            }`}>
              {insights.applicationReady ? "✓ Ready to Apply" : "⚠ Not Ready"}
            </span>

            {insights.interviewReadyComplete && (
              <span className="px-3 py-1 rounded-full text-xs border bg-blue-500/10 border-blue-500/30 text-blue-400">
                ✓ Interview Ready
              </span>
            )}

            {insights.status && (
              <span className={`px-3 py-1 rounded-full text-xs border bg-white/5 border-white/10 text-white/50`}>
                {insights.status}
              </span>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          
          {/* Job Analysis Insights */}
          {insights.hasJobAnalysis && (
            <Section title="Job Analysis" icon="🎯">
              {/* Salary Benchmark */}
              {salaryBenchmark && (
                <div className="mb-4 p-3 rounded-lg bg-[#EAAA00]/10 border border-[#EAAA00]/20">
                  <h4 className="text-sm font-medium text-[#EAAA00] mb-1">💰 Market Salary</h4>
                  <p className="text-lg font-semibold text-[#EAAA00]">{salaryBenchmark}</p>
                </div>
              )}

              {/* Red Flags */}
              {redFlags.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2">🚩 Watch Out For</h4>
                  <ul className="space-y-2">
                    {redFlags.map((flag: string, i: number) => (
                      <li key={i} className="text-sm text-white/70 pl-4 leading-relaxed">• {flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Green Flags */}
              {greenFlags.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">✅ Positive Signals</h4>
                  <ul className="space-y-2">
                    {greenFlags.map((flag: string, i: number) => (
                      <li key={i} className="text-sm text-white/70 pl-4 leading-relaxed">• {flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Culture Clues */}
              {cultureClues.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-blue-400 mb-2">🏢 Culture Signals</h4>
                  <ul className="space-y-1">
                    {cultureClues.map((clue: string, i: number) => (
                      <li key={i} className="text-sm text-white/60 pl-4">{clue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Compensation Signals */}
              {compensationSignals.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-amber-400 mb-2">💵 Compensation Notes</h4>
                  <ul className="space-y-1">
                    {compensationSignals.map((signal: string, i: number) => (
                      <li key={i} className="text-sm text-white/60 pl-4">• {signal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ATS Keywords */}
              {topKeywords.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-[#EAAA00] mb-2">🔑 Key Skills to Emphasize</h4>
                  <div className="flex flex-wrap gap-2">
                    {topKeywords.map((keyword: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-md bg-[#EAAA00]/10 border border-[#EAAA00]/20 text-[#EAAA00] text-xs"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Application Tips */}
              {applicationTips.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-purple-400 mb-2">💡 Application Tips</h4>
                  <ul className="space-y-1">
                    {applicationTips.map((tip: string, i: number) => (
                      <li key={i} className="text-sm text-white/70 pl-4">• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Interview Questions */}
              {interviewQuestions.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-cyan-400 mb-2">❓ Questions to Ask</h4>
                  <ul className="space-y-1">
                    {interviewQuestions.map((q: string, i: number) => (
                      <li key={i} className="text-sm text-white/70 pl-4">• {q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements Preview */}
              {insights.requirements && insights.requirements.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-white/70 mb-2">Requirements ({insights.requirements.length})</h4>
                  <ul className="space-y-1">
                    {insights.requirements.map((req, i) => (
                      <li key={i} className="text-sm text-white/50 pl-4">• {req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {/* Tailored Resume Insights */}
          {insights.hasTailoredResume && (
            <Section title="Tailored Resume" icon="📄">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Stat label="Tailoring Level" value={insights.tailoringLevel || "N/A"} />
                <Stat label="Version" value={`v${insights.resumeVersion || 1}`} />
                <Stat label="Changes Accepted" value={insights.changesAccepted || 0} color="emerald" />
                <Stat label="Changes Pending" value={insights.changesPending || 0} color="amber" />
              </div>

              {insights.resumeLexAssessment && (
                <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
                  <h4 className="text-sm font-medium text-[#EAAA00] mb-2">💬 Lex's Assessment</h4>
                  <p className="text-sm text-white/70 leading-relaxed">{insights.resumeLexAssessment}</p>
                </div>
              )}

              {insights.resumeFinalized && (
                <div className="mt-4 text-sm text-emerald-400">
                  ✓ Resume finalized and ready
                </div>
              )}
            </Section>
          )}

          {/* Cover Letter Insights */}
          {insights.hasCoverLetter && (
            <Section title="Cover Letter" icon="✉️">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <ScoreStat label="Voice Match" score={insights.voiceMatchScore} />
                <ScoreStat label="Job Alignment" score={insights.jobAlignmentScore} />
                <ScoreStat label="Overall Quality" score={insights.overallQualityScore} />
              </div>

              {insights.coverLetterLexSuggestions && 
               Array.isArray(insights.coverLetterLexSuggestions) && 
               insights.coverLetterLexSuggestions.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
                  <h4 className="text-sm font-medium text-[#EAAA00] mb-2">💡 Lex's Suggestions</h4>
                  <ul className="space-y-2">
                    {insights.coverLetterLexSuggestions.slice(0, 3).map((suggestion: any, i: number) => (
                      <li key={i} className="text-sm text-white/70">• {suggestion.text || suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {/* Empty State */}
          {!insights.hasJobAnalysis && !insights.hasTailoredResume && !insights.hasCoverLetter && (
            <div className="text-center py-12 text-white/40">
              <p className="text-lg mb-2">No insights available yet</p>
              <p className="text-sm">Complete Job Analysis and Tailor Resume to see insights here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
      <h3 className="text-lg font-medium text-white/80 mb-4 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: "emerald" | "amber" }) {
  const colorClass = color === "emerald" 
    ? "text-emerald-400" 
    : color === "amber" 
    ? "text-amber-400" 
    : "text-white/70";

  return (
    <div>
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className={`text-lg font-medium ${colorClass}`}>{value}</p>
    </div>
  );
}

function ScoreStat({ label, score }: { label: string; score: number | null }) {
  const getColor = (s: number | null) => {
    if (s === null) return "text-white/30";
    if (s >= 85) return "text-emerald-400";
    if (s >= 70) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div>
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className={`text-2xl font-light ${getColor(score)}`}>
        {score !== null ? `${score}%` : "—"}
      </p>
    </div>
  );
}