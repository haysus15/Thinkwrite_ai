"use client";

import React, { useState } from 'react';
import type { ATSKeywords } from '../../../types/job-analysis';

interface ATSKeywordsProps {
  atsKeywords: ATSKeywords;
  jobTitle: string;
}

// ATS Education Content
const ATS_EDUCATION = {
  whatIsATS: {
    title: "What is an ATS?",
    content: "An Applicant Tracking System (ATS) is software that companies use to manage job applications. It scans resumes for keywords, qualifications, and formatting to rank candidates. About 75% of resumes are rejected by ATS before a human ever sees them."
  },
  whatWeAnalyze: {
    title: "What We're Analyzing",
    content: "We analyze the JOB POSTING itself (not your resume) to help you understand what the employer is looking for. This score reflects how clear and keyword-rich the posting is - making it easier or harder for you to tailor your application."
  },
  scoreExplanation: {
    high: "This posting is clear and specific with lots of keywords. You can easily identify what to emphasize in your resume.",
    medium: "This posting has some clear requirements but also vague areas. Focus on the specific skills mentioned.",
    low: "This posting is vague or poorly structured. You may need to research the company more to understand what they really want."
  }
};

export default function ATSKeywords({ atsKeywords, jobTitle }: ATSKeywordsProps) {
  const [expandedSection, setExpandedSection] = useState<string>('hardSkills');
  const [showEducation, setShowEducation] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  const getImportanceColor = (importance: 'high' | 'medium' | 'low') => {
    switch (importance) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'medium': return 'text-violet-400 bg-violet-400/10 border-violet-400/30';
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/30';
    }
  };

  const getATSScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400 bg-emerald-400/20 border-emerald-400/30';
    if (score >= 50) return 'text-violet-400 bg-violet-400/20 border-violet-400/30';
    return 'text-orange-400 bg-orange-400/20 border-orange-400/30';
  };

  const getScoreExplanation = (score: number) => {
    if (score >= 70) return ATS_EDUCATION.scoreExplanation.high;
    if (score >= 50) return ATS_EDUCATION.scoreExplanation.medium;
    return ATS_EDUCATION.scoreExplanation.low;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Review';
  };

  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 shadow-2xl">
      {/* Header with Score */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white flex items-center space-x-3">
          <span className="text-2xl"></span>
          <span>Job Posting Analysis</span>
        </h3>
        
        {/* ATS Score Badge */}
        <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl border ${getATSScoreColor(atsKeywords.atsScore)}`}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <div className="text-right">
            <span className="font-bold text-lg">{atsKeywords.atsScore}/100</span>
            <span className="text-xs ml-2 opacity-80">{getScoreLabel(atsKeywords.atsScore)}</span>
          </div>
        </div>
      </div>

      {/* Education Toggle */}
      <button
        onClick={() => setShowEducation(!showEducation)}
        className="w-full mb-4 flex items-center justify-between p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 hover:bg-blue-500/15 transition-colors"
      >
        <span className="text-blue-400 text-sm flex items-center space-x-2">
          <span></span>
          <span>What does this score mean?</span>
        </span>
        <svg 
          className={`w-4 h-4 text-blue-400 transition-transform ${showEducation ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Education Panel */}
      {showEducation && (
        <div className="mb-6 space-y-3">
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
            <h4 className="text-blue-400 font-medium mb-2">{ATS_EDUCATION.whatIsATS.title}</h4>
            <p className="text-white/70 text-sm">{ATS_EDUCATION.whatIsATS.content}</p>
          </div>
          
          <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
            <h4 className="text-purple-400 font-medium mb-2">{ATS_EDUCATION.whatWeAnalyze.title}</h4>
            <p className="text-white/70 text-sm">{ATS_EDUCATION.whatWeAnalyze.content}</p>
          </div>

          <div className={`rounded-xl p-4 border ${getATSScoreColor(atsKeywords.atsScore)}`}>
            <h4 className="font-medium mb-2">Your Score: {atsKeywords.atsScore}/100</h4>
            <p className="text-white/70 text-sm">{getScoreExplanation(atsKeywords.atsScore)}</p>
          </div>
        </div>
      )}

      {/* Score Explanation - Always Visible */}
      <div className="mb-6 p-4 bg-white/[0.02] rounded-xl border border-white/[0.05]">
        <p className="text-white/80 text-sm">
          <strong className="text-[#9333EA]">What this means:</strong> {getScoreExplanation(atsKeywords.atsScore)}
        </p>
        <p className="text-white/60 text-xs mt-2">
           This score reflects the job posting's clarity, not your resume match. Chat with Lex to compare against your resume.
        </p>
      </div>

      {/* Hard Skills */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('hardSkills')}
          className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold flex items-center space-x-3">
              <span className="text-blue-400">️</span>
              <span>Required Skills & Qualifications</span>
              <span className="bg-blue-400/20 text-blue-400 px-2 py-1 rounded-full text-xs">
                {atsKeywords.hardSkills.length}
              </span>
            </h4>
            <svg 
              className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'hardSkills' ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expandedSection === 'hardSkills' && (
          <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
            <p className="text-white/70 text-sm mb-4 italic">
               These are the skills mentioned in the job posting for {jobTitle}:
            </p>
            {atsKeywords.hardSkills.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {atsKeywords.hardSkills.map((skill, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                    <div className="flex-1">
                      <span className="text-white font-medium">{skill.skill}</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-white/50 text-xs">{skill.category}</span>
                        {skill.frequency > 1 && (
                          <>
                            <div className="w-1 h-1 bg-white/30 rounded-full"></div>
                            <span className="text-white/50 text-xs">{skill.frequency}x mentioned</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded border text-xs font-medium ${getImportanceColor(skill.importance)}`}>
                      {skill.importance}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/50 text-sm">No specific hard skills identified in this posting.</p>
            )}
          </div>
        )}
      </div>

      {/* Technologies */}
      {atsKeywords.technologies.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('technologies')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-purple-400"></span>
                <span>Technologies & Tools</span>
                <span className="bg-purple-400/20 text-purple-400 px-2 py-1 rounded-full text-xs">
                  {atsKeywords.technologies.length}
                </span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'technologies' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'technologies' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <div className="flex flex-wrap gap-3">
                {atsKeywords.technologies.map((tech, index) => (
                  <div key={index} className="flex items-center space-x-2 px-3 py-2 bg-purple-400/10 border border-purple-400/30 rounded-lg">
                    <span className="text-white font-medium">{tech.technology}</span>
                    {tech.frequency > 1 && (
                      <span className="text-purple-400 text-xs">({tech.frequency}x)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Soft Skills */}
      {atsKeywords.softSkills.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('softSkills')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-emerald-400"></span>
                <span>Soft Skills & Traits</span>
                <span className="bg-emerald-400/20 text-emerald-400 px-2 py-1 rounded-full text-xs">
                  {atsKeywords.softSkills.length}
                </span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'softSkills' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'softSkills' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <div className="flex flex-wrap gap-3">
                {atsKeywords.softSkills.map((skill, index) => (
                  <div key={index} className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${getImportanceColor(skill.importance)}`}>
                    <span className="font-medium">{skill.skill}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Education Requirements */}
      {atsKeywords.educationRequirements && atsKeywords.educationRequirements.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('education')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-cyan-400"></span>
                <span>Education Requirements</span>
                <span className="bg-cyan-400/20 text-cyan-400 px-2 py-1 rounded-full text-xs">
                  {atsKeywords.educationRequirements.length}
                </span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'education' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'education' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <div className="space-y-2">
                {atsKeywords.educationRequirements.map((req, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 bg-cyan-400/10 border border-cyan-400/30 rounded-lg">
                    <span className="text-cyan-400">•</span>
                    <span className="text-white">{req}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Words for Resume */}
      {atsKeywords.actionWords.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('actionWords')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-violet-400"></span>
                <span>Action Words from Posting</span>
                <span className="bg-violet-400/20 text-violet-400 px-2 py-1 rounded-full text-xs">
                  {atsKeywords.actionWords.length}
                </span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'actionWords' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'actionWords' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <p className="text-white/70 text-sm mb-4 italic">
                 Using these verbs in your resume can help match the posting's language:
              </p>
              <div className="flex flex-wrap gap-2">
                {atsKeywords.actionWords.map((word, index) => (
                  <span key={index} className="px-3 py-1 bg-violet-400/10 text-violet-400 rounded border border-violet-400/30 text-sm">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Summary */}
      <div className="bg-gradient-to-r from-[#9333EA]/10 to-violet-700/10 rounded-xl p-5 border border-[#9333EA]/20">
        <h4 className="text-[#9333EA] font-semibold mb-3 flex items-center space-x-2">
          <span></span>
          <span>Quick Summary</span>
        </h4>
        <div className="space-y-2 text-sm text-white/90">
          <div className="flex items-start space-x-2">
            <span className="text-[#9333EA]">•</span>
            <span>
              <strong>{atsKeywords.hardSkills.filter(s => s.importance === 'high').length} high-priority skills</strong> identified
            </span>
          </div>
          {atsKeywords.technologies.length > 0 && (
            <div className="flex items-start space-x-2">
              <span className="text-[#9333EA]">•</span>
              <span>
                <strong>Tech stack:</strong> {atsKeywords.technologies.slice(0, 4).map(t => t.technology).join(', ')}
                {atsKeywords.technologies.length > 4 && ` +${atsKeywords.technologies.length - 4} more`}
              </span>
            </div>
          )}
          {atsKeywords.experienceKeywords.length > 0 && atsKeywords.experienceKeywords[0]?.keyword && (
            <div className="flex items-start space-x-2">
              <span className="text-[#9333EA]">•</span>
              <span>
                <strong>Experience:</strong> {atsKeywords.experienceKeywords[0].keyword}
              </span>
            </div>
          )}
          {atsKeywords.certifications.length > 0 && (
            <div className="flex items-start space-x-2">
              <span className="text-[#9333EA]">•</span>
              <span>
                <strong>Certifications mentioned:</strong> {atsKeywords.certifications.slice(0, 2).join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}