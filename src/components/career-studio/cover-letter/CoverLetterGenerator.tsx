"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  FileText, 
  Sparkles, 
  MessageCircle, 
  Download, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  Loader2,
  X
} from 'lucide-react';
import { VoiceFeedbackPrompt } from "@/components/voice-feedback";

// ============================================================================
// SAVED LETTERS SECTION - IMPORT
// ============================================================================
import { SavedCoverLetters } from './SavedCoverLettersSection';

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 
  | "select-inputs"
  | "select-approach"
  | "processing"
  | "extracting"
  | "review"
  | "finalized";

interface Resume {
  id: string;
  fileName: string;
  atsScore?: number;
}

interface JobAnalysis {
  id: string;
  jobTitle: string;
  companyName: string;
  location?: string;
}

interface CoverLetter {
  id: string;
  content: string;
  sections: {
    opening: { content: string };
    body: Array<{ content: string }>;
    closing: { content: string };
  };
  scores: {
    voiceMatch: number;
    jobAlignment: number;
    overall: number;
  };
  lexCommentary?: {
    overallAssessment: string;
    strengths: string[];
    improvements: string[];
  };
  metadata: {
    companyName: string;
    jobTitle: string;
    conversationBased?: boolean;
    honestlyVerified?: boolean;
  };
}

interface CoverLetterGeneratorProps {
  resumeId?: string;
  jobAnalysisId?: string;
}

const GENERATION_APPROACH = {
  quick: {
    name: "Quick Generate",
    description: "Auto-generate using AI analysis",
    expectedResult: "Ready in ~30 seconds",
    icon: Sparkles,
    color: "from-sky-400 to-indigo-500",
  },
  conversation: {
    name: "Strategy Session with Lex",
    description: "Talk with Lex first to craft honest narrative",
    expectedResult: "5-10 min conversation, then extract",
    icon: MessageCircle,
    color: "from-purple-500 to-fuchsia-500",
    recommended: true,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function CoverLetterGenerator({
  resumeId: initialResumeId,
  jobAnalysisId: initialJobId,
}: CoverLetterGeneratorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams?.get('mode');
  const isExtractMode = mode === 'extract-insights';

  const [viewMode, setViewMode] = useState<ViewMode>("select-inputs");
  const [selectedResumeId, setSelectedResumeId] = useState<string>(initialResumeId || "");
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || "");
  const [selectedApproach, setSelectedApproach] = useState<'quick' | 'conversation' | null>(null);

  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobs, setJobs] = useState<JobAnalysis[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [voiceMetadata, setVoiceMetadata] = useState<{
    usedVoiceProfile: boolean;
    confidenceLevel: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NEW: Saved letters refresh key
  const [savedLettersKey, setSavedLettersKey] = useState(0);

  // Load options on mount
  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle extract mode
  useEffect(() => {
    if (isExtractMode && selectedResumeId && selectedJobId) {
      handleExtractFromLexConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExtractMode, selectedResumeId, selectedJobId]);

  // Check for return from strategy session
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get("mode");
    if (mode === "extract-insights") {
      console.log(" Returned from Lex strategy session");
      handleExtractFromLexConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

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

  const loadResumes = async () => {
    try {
      console.log(' Loading resumes');
      const response = await fetch(`/api/resumes`);
      const data = await response.json();

      console.log(' Resumes API response:', data);

      if (data.success && data.resumes) {
        const resumeList: Resume[] = data.resumes.map((r: any) => {
          const analysisData = r.analysisResults || {};
          
          return {
            id: r.id,
            fileName: r.fileName || r.file_name,
            atsScore: analysisData?.overallScore || r.atsScore || r.ats_score,
          };
        });

        console.log(' Processed resumes:', resumeList);
        setResumes(resumeList);

        if (!selectedResumeId && resumeList.length > 0) {
          setSelectedResumeId(resumeList[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load resumes:", err);
    }
  };

  const loadJobAnalyses = async () => {
    try {
      console.log(' Loading job analyses');
      const response = await fetch(`/api/job-analysis`);
      const data = await response.json();

      console.log(' Job analyses API response:', data);

      if (data.success && data.analyses) {
        const savedAnalyses = data.analyses.filter((a: any) => a.is_saved);

        const jobList: JobAnalysis[] = savedAnalyses.map((a: any) => ({
          id: a.id,
          jobTitle:
            a.job_title ||
            a.analysis_results?.jobDetails?.title ||
            "Unknown Position",
          companyName:
            a.company_name ||
            a.analysis_results?.jobDetails?.company ||
            "Unknown Company",
          location: a.location || a.analysis_results?.jobDetails?.location,
        }));

        console.log(' Processed job analyses:', jobList);
        setJobs(jobList);

        if (!selectedJobId && jobList.length > 0) {
          setSelectedJobId(jobList[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load job analyses:", err);
    }
  };

  // NEW: Refresh saved letters list
  const refreshSavedLetters = () => {
    setSavedLettersKey(prev => prev + 1);
  };

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const handleContinueToApproachSelection = () => {
    if (!selectedResumeId || !selectedJobId) {
      setError('Please select both a resume and a job');
      return;
    }
    setError(null);
    setViewMode('select-approach');
  };

  const handleApproachSelected = (approach: 'quick' | 'conversation') => {
    setSelectedApproach(approach);
    if (approach === 'conversation') {
      router.push(
        `/career-studio/lex?mode=cover-letter-strategy&resumeId=${selectedResumeId}&jobId=${selectedJobId}&returnTo=cover-letter`
      );
    } else {
      handleQuickGenerate();
    }
  };

  // ============================================================================
  // GENERATION
  // ============================================================================

  const handleQuickGenerate = async () => {
    setViewMode('processing');
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/cover-letter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: selectedResumeId,
          jobAnalysisId: selectedJobId,
          approach: 'quick'
        })
      });

      const data = await response.json();

      if (data.success && data.coverLetter) {
        setCoverLetter(data.coverLetter);
        setVoiceMetadata(data.voiceMetadata || null);
        setViewMode('review');
        refreshSavedLetters(); // Refresh the saved letters list
      } else {
        throw new Error(data.error || 'Failed to generate cover letter');
      }
    } catch (err) {
      console.error('Quick generate error:', err);
      setError(err instanceof Error ? err.message : 'Generation failed');
      setViewMode('select-approach');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtractFromLexConversation = async () => {
    setViewMode('extracting');
    setIsProcessing(true);
    setError(null);

    try {
      const STORAGE_KEY = 'lexCoverLetterStrategy';
      const stored = sessionStorage.getItem(STORAGE_KEY);
      
      if (!stored) {
        throw new Error('No conversation found. Please complete the strategy session with Lex first.');
      }

      const conversationData = JSON.parse(stored);
      
      const response = await fetch('/api/lex/extract-cover-letter-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory: conversationData.messages,
          resumeId: selectedResumeId || conversationData.resumeId,
          jobId: selectedJobId || conversationData.jobId
        })
      });

      const data = await response.json();

      if (data.success && data.coverLetter) {
        setCoverLetter(data.coverLetter);
        setVoiceMetadata(data.voiceMetadata || null);
        setViewMode('review');
        sessionStorage.removeItem(STORAGE_KEY);
        window.history.replaceState({}, "", window.location.pathname);
        refreshSavedLetters(); // Refresh the saved letters list
      } else {
        throw new Error(data.error || 'Failed to extract cover letter');
      }
    } catch (err) {
      console.error('Extract error:', err);
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setViewMode('select-approach');
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCopyToClipboard = () => {
    if (coverLetter) {
      navigator.clipboard.writeText(coverLetter.content);
      alert('Cover letter copied to clipboard!');
    }
  };

  const handleDownload = () => {
    if (coverLetter) {
      const blob = new Blob([coverLetter.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cover-letter-${coverLetter.metadata.companyName}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleFinalize = () => {
    setViewMode('finalized');
  };

  const startOver = () => {
    setViewMode('select-inputs');
    setSelectedResumeId(initialResumeId || "");
    setSelectedJobId(initialJobId || "");
    setSelectedApproach(null);
    setCoverLetter(null);
    setVoiceMetadata(null);
    setError(null);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const selectedResume = resumes.find(r => r.id === selectedResumeId);
  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const getScoreColor = (score?: number) => {
    if (!score) return "text-white/40";
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-violet-400";
    return "text-orange-400";
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-full text-white">
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        
        {/* NEW: SAVED COVER LETTERS SECTION */}
        <SavedCoverLetters key={savedLettersKey} />
        
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/15 border border-red-500/40 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-300" />
            <span className="text-red-200 text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-300 hover:text-red-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* SELECT INPUTS VIEW */}
        {viewMode === 'select-inputs' && (
          <div className="space-y-8">
            {isLoadingOptions ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 text-[#9333EA] animate-spin mb-4" />
                <p className="text-white/60">Loading your resumes and job analyses...</p>
              </div>
            ) : (
              <>
                {/* Resume Selection */}
                <section>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#9333EA]" />
                    Select Your Resume
                  </h2>

                  {resumes.length === 0 ? (
                    <div className="p-8 rounded-xl border border-white/20 bg-white/[0.02] text-center">
                      <FileText className="w-12 h-12 text-white/30 mx-auto mb-3" />
                      <p className="text-white/60 mb-4">No resumes found</p>
                      <button
                        onClick={() => router.push('/career-studio/resume-manager')}
                        className="px-5 py-2.5 bg-[#9333EA] text-white rounded-lg text-sm font-semibold hover:bg-[#A855F7] transition"
                      >
                        Upload Resume
                      </button>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {resumes.map(resume => {
                        const selected = selectedResumeId === resume.id;
                        return (
                          <button
                            key={resume.id}
                            onClick={() => setSelectedResumeId(resume.id)}
                            className={`p-5 rounded-xl border text-left transition-all ${
                              selected
                                ? 'border-[#9333EA] bg-[#9333EA]/10 shadow-[0_0_25px_rgba(234,170,0,0.3)]'
                                : 'border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <FileText className="w-6 h-6 text-[#9333EA]" />
                              {selected && (
                                <CheckCircle className="w-5 h-5 text-[#9333EA]" />
                              )}
                            </div>
                            <h3 className="text-white text-sm font-medium mb-1 truncate">
                              {resume.fileName}
                            </h3>
                            {resume.atsScore && (
                              <p className={`text-xs ${getScoreColor(resume.atsScore)}`}>
                                ATS Score: {resume.atsScore}/100
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Job Selection */}
                <section>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#9333EA]" />
                    Select Target Job
                  </h2>

                  {jobs.length === 0 ? (
                    <div className="p-8 rounded-xl border border-white/20 bg-white/[0.02] text-center">
                      <AlertCircle className="w-12 h-12 text-white/30 mx-auto mb-3" />
                      <p className="text-white/60 mb-2">No saved job analyses found</p>
                      <p className="text-sm text-white/40 mb-4">
                        Analyze and save a job posting first
                      </p>
                      <button
                        onClick={() => router.push('/career-studio/job-analysis')}
                        className="px-5 py-2.5 bg-[#9333EA] text-white rounded-lg text-sm font-semibold hover:bg-[#A855F7] transition"
                      >
                        Analyze Job Posting
                      </button>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {jobs.map(job => {
                        const selected = selectedJobId === job.id;
                        return (
                          <button
                            key={job.id}
                            onClick={() => setSelectedJobId(job.id)}
                            className={`p-5 rounded-xl border text-left transition-all ${
                              selected
                                ? 'border-[#9333EA] bg-[#9333EA]/10 shadow-[0_0_25px_rgba(234,170,0,0.3)]'
                                : 'border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h3 className="text-white text-sm font-medium mb-1 truncate">
                                  {job.jobTitle}
                                </h3>
                                <p className="text-white/60 text-xs truncate">
                                  {job.companyName}
                                </p>
                                {job.location && (
                                  <p className="text-white/40 text-xs mt-1">
                                    {job.location}
                                  </p>
                                )}
                              </div>
                              {selected && (
                                <CheckCircle className="w-5 h-5 text-[#9333EA] ml-2" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Action Buttons */}
                {resumes.length > 0 && jobs.length > 0 && (
                  <>
                    <div className="flex justify-center">
                      <button
                        onClick={handleContinueToApproachSelection}
                        disabled={!selectedResumeId || !selectedJobId}
                        className={`px-8 py-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                          selectedResumeId && selectedJobId
                            ? 'bg-[#9333EA] text-white hover:bg-[#A855F7] shadow-lg'
                            : 'bg-white/10 text-white/40 cursor-not-allowed'
                        }`}
                      >
                        Continue to Approach Selection
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-3 text-white/40 text-xs">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="uppercase tracking-wider">Or</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>

                      <button
                        onClick={() => handleApproachSelected('conversation')}
                        disabled={!selectedResumeId || !selectedJobId}
                        className={`px-8 py-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border ${
                          selectedResumeId && selectedJobId
                            ? 'bg-purple-500/20 border-purple-400/50 text-purple-200 hover:bg-purple-500/30'
                            : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                        }`}
                      >
                        <MessageCircle className="w-5 h-5" />
                        Strategy Session with Lex First
                        <span className="text-xs opacity-70">(Recommended)</span>
                      </button>

                      <p className="text-xs text-white/50 text-center max-w-md">
                        Discuss your goals with Lex to get personalized, honest advice
                        before generating your cover letter
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* SELECT APPROACH VIEW */}
        {viewMode === 'select-approach' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-light mb-2">Choose Your Approach</h2>
              <p className="text-white/60">How would you like to create your cover letter?</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Quick Generate */}
              <button
                onClick={() => handleApproachSelected('quick')}
                className="p-8 rounded-2xl border border-white/20 hover:border-sky-400/50 hover:bg-sky-400/5 transition text-left"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${GENERATION_APPROACH.quick.color} flex items-center justify-center mb-4`}>
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-medium mb-2">{GENERATION_APPROACH.quick.name}</h3>
                <p className="text-white/60 mb-4">{GENERATION_APPROACH.quick.description}</p>
                <p className="text-sm text-white/40">{GENERATION_APPROACH.quick.expectedResult}</p>
              </button>

              {/* Strategy Session */}
              <button
                onClick={() => handleApproachSelected('conversation')}
                className="p-8 rounded-2xl border-2 border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 transition text-left relative"
              >
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-purple-500 text-xs font-semibold">
                  RECOMMENDED
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${GENERATION_APPROACH.conversation.color} flex items-center justify-center mb-4`}>
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-medium mb-2">{GENERATION_APPROACH.conversation.name}</h3>
                <p className="text-white/60 mb-4">{GENERATION_APPROACH.conversation.description}</p>
                <p className="text-sm text-white/40">{GENERATION_APPROACH.conversation.expectedResult}</p>
              </button>
            </div>

            {/* Info Box */}
            <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <h4 className="font-medium mb-2 text-purple-200">Why Strategy Session?</h4>
              <ul className="space-y-2 text-sm text-purple-100/80">
                <li>• Lex asks strategic questions about your motivation</li>
                <li>• You share your authentic story in your own words</li>
                <li>• Cover letter is based on what you actually said</li>
                <li>• No AI embellishment or fabrication</li>
                <li>• Conversation-verified content</li>
              </ul>
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {(viewMode === 'processing' || viewMode === 'extracting') && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full border-4 border-[#9333EA]/20 border-t-[#9333EA] animate-spin mb-6" />
            <h2 className="text-xl font-medium mb-2">
              {viewMode === 'processing' ? 'Generating Cover Letter...' : 'Extracting Insights...'}
            </h2>
            <p className="text-white/60">
              {viewMode === 'processing' 
                ? 'Analyzing your resume and the job posting'
                : 'Converting your conversation with Lex into a cover letter'}
            </p>
          </div>
        )}

        {/* REVIEW */}
        {viewMode === 'review' && coverLetter && (
          <div className="space-y-6">
            {/* Conversation-Verified Badge */}
            {coverLetter.metadata.conversationBased && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-medium text-emerald-200">Conversation-Verified</div>
                  <div className="text-sm text-emerald-100/70">
                    Generated from your authentic story with Lex
                  </div>
                </div>
              </div>
            )}

            {/* Scores */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-sm text-white/60 mb-1">Voice Match</div>
                <div className="text-2xl font-semibold text-[#9333EA]">
                  {coverLetter.scores.voiceMatch}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-sm text-white/60 mb-1">Job Alignment</div>
                <div className="text-2xl font-semibold text-[#9333EA]">
                  {coverLetter.scores.jobAlignment}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-sm text-white/60 mb-1">Overall Quality</div>
                <div className="text-2xl font-semibold text-[#9333EA]">
                  {coverLetter.scores.overall}%
                </div>
              </div>
            </div>

            {/* Lex Commentary */}
            {coverLetter.lexCommentary && (
              <div className="p-6 rounded-xl bg-[#9333EA]/10 border border-[#9333EA]/30">
                <h3 className="font-semibold mb-2 text-[#9333EA]">Lex's Assessment</h3>
                <p className="text-white/80 mb-4">{coverLetter.lexCommentary.overallAssessment}</p>
                
                {coverLetter.lexCommentary.strengths.length > 0 && (
                  <div className="mb-3">
                    <div className="text-sm font-medium text-emerald-300 mb-2">Strengths:</div>
                    <ul className="space-y-1">
                      {coverLetter.lexCommentary.strengths.map((strength, i) => (
                        <li key={i} className="text-sm text-white/70">• {strength}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {coverLetter.lexCommentary.improvements.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-violet-300 mb-2">Improvements:</div>
                    <ul className="space-y-1">
                      {coverLetter.lexCommentary.improvements.map((improvement, i) => (
                        <li key={i} className="text-sm text-white/70">• {improvement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Cover Letter Content */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap font-serif text-white/90 leading-relaxed">
                  {coverLetter.content}
                </div>
              </div>
            </div>
            {voiceMetadata?.usedVoiceProfile && (
              <VoiceFeedbackPrompt
                contentType="cover_letter"
                studioType="career"
                originalContent={coverLetter.content}
                confidenceLevel={voiceMetadata.confidenceLevel}
                className="mt-4"
              />
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleCopyToClipboard}
                className="flex-1 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handleFinalize}
                className="flex-1 py-3 rounded-xl bg-[#9333EA] text-white font-semibold hover:bg-[#7E22CE] transition"
              >
                Finalize
              </button>
            </div>
          </div>
        )}

        {/* FINALIZED */}
        {viewMode === 'finalized' && coverLetter && (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-medium mb-2">Cover Letter Complete!</h2>
            <p className="text-white/60 mb-8">
              Your cover letter for {coverLetter.metadata.jobTitle} at {coverLetter.metadata.companyName} is ready.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={startOver}
                className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition"
              >
                Create Another
              </button>
              <button
                onClick={() => router.push('/career-studio')}
                className="px-6 py-3 rounded-xl bg-[#9333EA] text-white font-semibold hover:bg-[#7E22CE] transition"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
