"use client";

import React from 'react';
import type { JobAnalysisResult } from '../../../types/job-analysis';
import JobOverview from './JobOverview';
import HiddenInsights from './HiddenInsights';
import IndustryIntelligence from './IndustryIntelligence';
import ActionButtons from './ActionButtons';
import ATSKeywords from './ATSKeywords';

interface AnalysisResultsProps {
  analysis: JobAnalysisResult;
  onSave: (analysisId: string) => Promise<void>;
  onDiscussWithLex: (analysisId: string) => void;
  onSendToTailor?: (analysisId: string) => void;
  onSendToCoverLetter?: (analysisId: string) => void;
}

export default function AnalysisResults({ 
  analysis,
  onSave, 
  onDiscussWithLex,
  onSendToTailor,
  onSendToCoverLetter,
}: AnalysisResultsProps) {
  if (!analysis?.jobDetails) {
    return (
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8 shadow-2xl">
        <div className="text-center text-white/60">
          <span className="text-2xl">️</span>
          <p className="mt-2">Analysis data incomplete</p>
        </div>
      </div>
    );
  }

  const analysisId = analysis.id || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="space-y-6">
      {/* Job Overview */}
      <JobOverview 
        jobDetails={analysis.jobDetails}
        analysisId={analysisId}
      />

      {/* Action Buttons - Place prominently after overview */}
      <ActionButtons
        analysisId={analysisId}
        jobTitle={analysis.jobDetails.title}
        company={analysis.jobDetails.company}
        hasApplicationEmail={!!analysis.jobDetails.applicationEmail}
        onSave={() => onSave(analysisId)}
        onDiscussWithLex={() => onDiscussWithLex(analysisId)}
        onSendToTailor={onSendToTailor ? () => onSendToTailor(analysisId) : undefined}
        onSendToCoverLetter={onSendToCoverLetter ? () => onSendToCoverLetter(analysisId) : undefined}
      />

      {/* ATS Keywords & Resume Tailoring - Enhanced with integrated education */}
      <ATSKeywords 
        atsKeywords={analysis.atsKeywords}
        jobTitle={analysis.jobDetails.title}
      />

      {/* Hidden Insights - The Core Value Proposition */}
      <HiddenInsights 
        hiddenInsights={analysis.hiddenInsights}
        jobTitle={analysis.jobDetails.title}
      />

      {/* Industry Intelligence */}
      <IndustryIntelligence 
        industryIntelligence={analysis.industryIntelligence}
      />

      {/* Strategic Analysis Summary - Simplified without company intel */}
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
          <span className="text-[#9333EA]"></span>
          <span>Analysis Summary & Next Steps</span>
        </h3>

        <div className="space-y-4">
          {/* Key Takeaways */}
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.05]">
            <h4 className="text-white font-medium mb-3">Key Findings:</h4>
            <div className="space-y-2 text-sm text-white/80">
              <div className="flex items-start space-x-2">
                <span className="text-blue-400"></span>
                <span>
                  <strong>Job Posting Quality Score: {analysis.atsKeywords?.atsScore || 0}/100</strong> - 
                  {analysis.atsKeywords?.atsScore >= 70 
                    ? ' This posting is clear and specific - easy to tailor your application'
                    : analysis.atsKeywords?.atsScore >= 50
                      ? ' This posting has some vague areas - focus on the specific requirements'
                      : ' This posting is vague - consider researching the company more'}
                </span>
              </div>
              
              {analysis.hiddenInsights?.phraseTranslations?.length > 0 && (
                <div className="flex items-start space-x-2">
                  <span className="text-orange-400">️</span>
                  <span>
                    <strong>{analysis.hiddenInsights.phraseTranslations.length} phrase(s) decoded</strong> - 
                    Review these to understand what the employer really means
                  </span>
                </div>
              )}
              
              {analysis.jobDetails.applicationEmail && (
                <div className="flex items-start space-x-2">
                  <span className="text-emerald-400"></span>
                  <span>
                    <strong>Direct application email found</strong> - 
                    You can apply directly via {analysis.jobDetails.applicationEmail}
                  </span>
                </div>
              )}

              <div className="flex items-start space-x-2">
                <span className="text-purple-400">️</span>
                <span>
                  <strong>{analysis.atsKeywords?.hardSkills?.length || 0} skills identified</strong> - 
                  {analysis.atsKeywords?.hardSkills?.filter(s => s.importance === 'high').length || 0} are high priority
                </span>
              </div>
            </div>
          </div>

          {/* What To Do Next */}
          <div className="bg-gradient-to-r from-[#9333EA]/10 to-violet-700/10 rounded-xl p-4 border border-[#9333EA]/20">
            <h4 className="text-[#9333EA] font-medium mb-3">What To Do Next:</h4>
            <div className="space-y-2 text-sm text-white/90">
              <div className="flex items-start space-x-2">
                <span className="text-[#9333EA] font-bold">1.</span>
                <span>
                  <strong>Save this analysis</strong> if you&apos;re interested in this position
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#9333EA] font-bold">2.</span>
                <span>
                  <strong>Chat with Lex</strong> to compare this job against your resume and get personalized advice
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#9333EA] font-bold">3.</span>
                <span>
                  <strong>Tailor your resume</strong> using the extracted keywords for this position
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#9333EA] font-bold">4.</span>
                <span>
                  <strong>Generate a cover letter</strong> written in the company&apos;s tone
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#9333EA] font-bold">5.</span>
                <span>
                  <strong>Review red flags</strong> and prepare questions to ask in the interview
                </span>
              </div>
            </div>
          </div>

          {/* Important Note */}
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
            <p className="text-blue-400 text-sm">
              <strong> Note:</strong> This analysis shows what the job posting contains - not how your resume matches. 
              To compare against your resume and get tailored recommendations, click &quot;Discuss with Lex&quot; above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
