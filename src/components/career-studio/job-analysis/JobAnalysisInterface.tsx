'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookmarkPlus, Check, Trash2 } from 'lucide-react';

type Props = {
};

type JobAnalysis = {
  id: string;
  job_title: string;
  company_name: string;
  location?: string;
  job_description?: string;
  requirements?: string[];
  responsibilities?: string[];
  ats_keywords?: {
    mustHave?: string[];
    niceToHave?: string[];
    skills?: string[];
  };
  hidden_insights?: {
    redFlags?: string[];
    greenFlags?: string[];
    cultureClues?: string[];
    salaryIntel?: string;
  };
  industry_intelligence?: {
    marketPosition?: string;
    growthIndicators?: string[];
    competitorContext?: string;
  };
  is_saved?: boolean;
  created_at: string;
};

type AnalysisResult = {
  success: boolean;
  jobId?: string;
  analysis?: any;
  error?: string;
};

export default function JobAnalysisInterface({}: Props) {
  const [inputMode, setInputMode] = useState<'url' | 'text'>('text');
  const [content, setContent] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<JobAnalysis | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<JobAnalysis[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [activeTab, setActiveTab] = useState<'new' | 'saved'>('new');

  // Fetch saved analyses
  const fetchSavedAnalyses = useCallback(async () => {
    try {
      const res = await fetch("/api/job-analysis?saved=true");
      const data = await res.json();
      if (data.success && data.analyses) {
        setSavedAnalyses(data.analyses);
      }
    } catch (e) {
      console.error('Failed to fetch saved analyses:', e);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedAnalyses();
  }, [fetchSavedAnalyses]);

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setError('Please enter a job URL or description');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setCurrentAnalysis(null);

    try {
      const res = await fetch('/api/job-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          isUrl: inputMode === 'url',
        }),
      });

      const data: AnalysisResult = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Transform the result to our JobAnalysis type
      const analysis: JobAnalysis = {
        id: data.jobId || data.analysis?.id,
        job_title: data.analysis?.jobDetails?.title || 'Unknown Position',
        company_name: data.analysis?.jobDetails?.company || 'Unknown Company',
        location: data.analysis?.jobDetails?.location,
        job_description: data.analysis?.jobDetails?.description,
        requirements: data.analysis?.jobDetails?.requirements,
        responsibilities: data.analysis?.jobDetails?.responsibilities,
        ats_keywords: data.analysis?.atsKeywords,
        hidden_insights: data.analysis?.hiddenInsights,
        industry_intelligence: data.analysis?.industryIntelligence,
        is_saved: false,
        created_at: new Date().toISOString(),
      };

      setCurrentAnalysis(analysis);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze job posting');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveAnalysis = async (analysisId: string) => {
    try {
      const res = await fetch(`/api/job-analysis/${analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_saved: true }),
      });

      if (res.ok) {
        if (currentAnalysis?.id === analysisId) {
          setCurrentAnalysis({ ...currentAnalysis, is_saved: true });
        }
        fetchSavedAnalyses();
      }
    } catch (e) {
      console.error('Failed to save analysis:', e);
    }
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    if (!confirm('Are you sure you want to delete this analysis?')) return;

    try {
      const res = await fetch(`/api/job-analysis/${analysisId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSavedAnalyses(prev => prev.filter(a => a.id !== analysisId));
        if (currentAnalysis?.id === analysisId) {
          setCurrentAnalysis(null);
        }
      }
    } catch (e) {
      console.error('Failed to delete analysis:', e);
    }
  };

  return (
    <div className="min-h-full bg-transparent">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'new'
                ? 'bg-[#9333EA] text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            New Analysis
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'saved'
                ? 'bg-[#9333EA] text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Saved ({savedAnalyses.length})
          </button>
        </div>

        {activeTab === 'new' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Analyze a Job Posting</h2>

                {/* Mode Toggle */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setInputMode('text')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                      inputMode === 'text'
                        ? 'bg-[#9333EA] text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Paste Description
                  </button>
                  <button
                    onClick={() => setInputMode('url')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                      inputMode === 'url'
                        ? 'bg-[#9333EA] text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Enter URL
                  </button>
                </div>

                {/* Input */}
                {inputMode === 'url' ? (
                  <input
                    type="url"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="https://linkedin.com/jobs/..."
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]/50"
                  />
                ) : (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste the full job description here..."
                    rows={12}
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]/50 resize-none"
                  />
                )}

                {/* Error */}
                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Analyze Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !content.trim()}
                  className="w-full mt-4 py-3 bg-[#9333EA] text-white font-semibold rounded-lg hover:bg-[#7E22CE] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <span></span>
                      Analyze Job Posting
                    </>
                  )}
                </button>
              </div>

              {/* What You'll Get */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                  What You'll Get
                </h3>
                <ul className="space-y-2 text-sm text-white/80">
                  <li className="flex items-start gap-2">
                    <span className="text-[#9333EA]"></span>
                    <span>ATS keywords to include in your resume</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#9333EA]"></span>
                    <span>Hidden insights about the role & company</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#9333EA]"></span>
                    <span>Red flags and green flags to watch for</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#9333EA]"></span>
                    <span>Industry intelligence & market context</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#9333EA]"></span>
                    <span>Direct link to tailor your resume</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Results Section */}
            <div>
              {currentAnalysis ? (
                <AnalysisCard
                  analysis={currentAnalysis}
                  onSave={() => handleSaveAnalysis(currentAnalysis.id)}
                  onDelete={() => handleDeleteAnalysis(currentAnalysis.id)}
                />
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl"></span>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No Analysis Yet</h3>
                  <p className="text-white/60 text-sm">
                    Paste a job description or URL to get started. Lex will decode the posting and give you actionable insights.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Saved Analyses Tab */
          <div>
            {loadingSaved ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[#9333EA] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : savedAnalyses.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl"></span>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Saved Analyses</h3>
                <p className="text-white/60 text-sm">
                  Analyze a job posting and save it to see it here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedAnalyses.map((analysis) => (
                  <AnalysisCard
                    key={analysis.id}
                    analysis={analysis}
                    onSave={() => {}}
                    onDelete={() => handleDeleteAnalysis(analysis.id)}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Analysis Card Component
function AnalysisCard({
  analysis,
  onSave,
  onDelete,
  compact = false,
}: {
  analysis: JobAnalysis;
  onSave: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(
    compact ? null : 'keywords'
  );

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{analysis.job_title}</h3>
            <p className="text-[#9333EA]">{analysis.company_name}</p>
            {analysis.location && (
              <p className="text-white/60 text-sm mt-1">{analysis.location}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!analysis.is_saved && (
              <button
                onClick={onSave}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                title="Save analysis"
              >
                <BookmarkPlus className="w-4 h-4 text-white/80" />
              </button>
            )}
            {analysis.is_saved && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 text-xs">
                <Check className="w-3.5 h-3.5" />
                Saved
              </div>
            )}
            <button
              onClick={onDelete}
              className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Delete analysis"
            >
              <Trash2 className="w-4 h-4 text-red-300" />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link
            href={`/career-studio/tailor-resume?jobAnalysisId=${analysis.id}`}
            className="px-3 py-1.5 bg-[#9333EA] text-white text-sm font-medium rounded-lg hover:bg-[#7E22CE] transition-colors"
          >
            Tailor Resume
          </Link>
          <Link
            href={`/career-studio/cover-letter?jobAnalysisId=${analysis.id}`}
            className="px-3 py-1.5 bg-white/10 text-white text-sm font-medium rounded-lg hover:bg-white/20 transition-colors"
          >
            Write Cover Letter
          </Link>
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="divide-y divide-white/5">
        {/* ATS Keywords */}
        {analysis.ats_keywords && (
          <div>
            <button
              onClick={() => toggleSection('keywords')}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <span className="font-medium text-white">ATS Keywords</span>
              <span className="text-white/40">{expandedSection === 'keywords' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'keywords' && (
              <div className="px-6 pb-4 space-y-3">
                {analysis.ats_keywords.mustHave && analysis.ats_keywords.mustHave.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Must Have</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.ats_keywords.mustHave.map((kw, i) => (
                        <span key={i} className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.ats_keywords.niceToHave && analysis.ats_keywords.niceToHave.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Nice to Have</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.ats_keywords.niceToHave.map((kw, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.ats_keywords.skills && analysis.ats_keywords.skills.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.ats_keywords.skills.map((kw, i) => (
                        <span key={i} className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Hidden Insights */}
        {analysis.hidden_insights && (
          <div>
            <button
              onClick={() => toggleSection('insights')}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <span className="font-medium text-white">Hidden Insights</span>
              <span className="text-white/40">{expandedSection === 'insights' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'insights' && (
              <div className="px-6 pb-4 space-y-3">
                {analysis.hidden_insights.greenFlags && analysis.hidden_insights.greenFlags.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 uppercase tracking-wider mb-2"> Green Flags</p>
                    <ul className="space-y-1">
                      {analysis.hidden_insights.greenFlags.map((flag, i) => (
                        <li key={i} className="text-sm text-white/80">• {flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.hidden_insights.redFlags && analysis.hidden_insights.redFlags.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 uppercase tracking-wider mb-2"> Red Flags</p>
                    <ul className="space-y-1">
                      {analysis.hidden_insights.redFlags.map((flag, i) => (
                        <li key={i} className="text-sm text-white/80">• {flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.hidden_insights.cultureClues && analysis.hidden_insights.cultureClues.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Culture Clues</p>
                    <ul className="space-y-1">
                      {analysis.hidden_insights.cultureClues.map((clue, i) => (
                        <li key={i} className="text-sm text-white/80">• {clue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.hidden_insights.salaryIntel && (
                  <div>
                    <p className="text-xs text-[#9333EA] uppercase tracking-wider mb-2">Salary Intel</p>
                    <p className="text-sm text-white/80">{analysis.hidden_insights.salaryIntel}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Industry Intelligence */}
        {analysis.industry_intelligence && (
          <div>
            <button
              onClick={() => toggleSection('industry')}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <span className="font-medium text-white">Industry Intelligence</span>
              <span className="text-white/40">{expandedSection === 'industry' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'industry' && (
              <div className="px-6 pb-4 space-y-3">
                {analysis.industry_intelligence.marketPosition && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Market Position</p>
                    <p className="text-sm text-white/80">{analysis.industry_intelligence.marketPosition}</p>
                  </div>
                )}
                {analysis.industry_intelligence.growthIndicators && analysis.industry_intelligence.growthIndicators.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Growth Indicators</p>
                    <ul className="space-y-1">
                      {analysis.industry_intelligence.growthIndicators.map((indicator, i) => (
                        <li key={i} className="text-sm text-white/80">• {indicator}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.industry_intelligence.competitorContext && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Competitor Context</p>
                    <p className="text-sm text-white/80">{analysis.industry_intelligence.competitorContext}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Requirements */}
        {analysis.requirements && analysis.requirements.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('requirements')}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <span className="font-medium text-white">Requirements ({analysis.requirements.length})</span>
              <span className="text-white/40">{expandedSection === 'requirements' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'requirements' && (
              <div className="px-6 pb-4">
                <ul className="space-y-2">
                  {analysis.requirements.map((req, i) => (
                    <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                      <span className="text-[#9333EA]">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-white/5 flex items-center justify-between">
        <span className="text-xs text-white/40">
          Analyzed {new Date(analysis.created_at).toLocaleDateString()}
        </span>
        {analysis.is_saved && (
          <span className="text-xs text-green-400"> Saved</span>
        )}
      </div>
    </div>
  );
}
