"use client";

import React, { useState } from 'react';

interface MatchBreakdown {
  score: number;
  matched?: string[];
  missing?: string[];
}

interface MatchResult {
  matchScore: number;
  skillsMatch: MatchBreakdown;
  experienceMatch: {
    score: number;
    resumeYears: number;
    requiredYears: number;
    relevantExperience: string[];
    missingExperience: string[];
  };
  educationMatch: {
    score: number;
    matched: boolean;
    resumeEducation: string[];
    requiredEducation: string[];
    details: string;
  };
  technologiesMatch: MatchBreakdown;
  gaps: string[];
  strengths: string[];
  recommendation: string;
}

interface MatchScoreDisplayProps {
  match: MatchResult;
  resumeName: string;
  jobTitle: string;
  company: string;
  onClose: () => void;
  onDiscussWithLex: () => void;
}

export default function MatchScoreDisplay({
  match,
  resumeName,
  jobTitle,
  company,
  onClose,
  onDiscussWithLex
}: MatchScoreDisplayProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-violet-400';
    if (score >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/20 border-emerald-500/30';
    if (score >= 50) return 'bg-violet-500/20 border-violet-500/30';
    if (score >= 30) return 'bg-orange-500/20 border-orange-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent Match';
    if (score >= 70) return 'Strong Match';
    if (score >= 50) return 'Moderate Match';
    if (score >= 30) return 'Weak Match';
    return 'Low Match';
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 shadow-2xl mt-4 animate-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Resume Match Analysis</h3>
            <p className="text-white/60 text-sm">
              {resumeName} → {jobTitle} at {company}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Score */}
      <div className={`rounded-2xl p-6 border mb-6 ${getScoreBg(match.matchScore)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm mb-1">Overall Match Score</p>
            <p className={`text-5xl font-bold ${getScoreColor(match.matchScore)}`}>
              {match.matchScore}
              <span className="text-2xl text-white/50">/100</span>
            </p>
            <p className={`text-sm mt-1 ${getScoreColor(match.matchScore)}`}>
              {getScoreLabel(match.matchScore)}
            </p>
          </div>
          
          {/* Score Breakdown Mini */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <p className={`text-2xl font-bold ${getScoreColor(match.skillsMatch.score)}`}>
                {match.skillsMatch.score}%
              </p>
              <p className="text-white/50 text-xs">Skills</p>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <p className={`text-2xl font-bold ${getScoreColor(match.experienceMatch.score)}`}>
                {match.experienceMatch.score}%
              </p>
              <p className="text-white/50 text-xs">Experience</p>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <p className={`text-2xl font-bold ${getScoreColor(match.educationMatch.score)}`}>
                {match.educationMatch.score}%
              </p>
              <p className="text-white/50 text-xs">Education</p>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-xl">
              <p className={`text-2xl font-bold ${getScoreColor(match.technologiesMatch.score)}`}>
                {match.technologiesMatch.score}%
              </p>
              <p className="text-white/50 text-xs">Tech</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gaps & Strengths */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Gaps */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <h4 className="text-red-400 font-medium mb-3 flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Gaps to Address ({match.gaps.length})</span>
          </h4>
          <ul className="space-y-2">
            {match.gaps.length > 0 ? (
              match.gaps.map((gap, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-white/80">
                  <span className="text-red-400 mt-0.5"></span>
                  <span>{gap}</span>
                </li>
              ))
            ) : (
              <li className="text-white/60 text-sm">No significant gaps identified!</li>
            )}
          </ul>
        </div>

        {/* Strengths */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <h4 className="text-emerald-400 font-medium mb-3 flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Strengths ({match.strengths.length})</span>
          </h4>
          <ul className="space-y-2">
            {match.strengths.length > 0 ? (
              match.strengths.map((strength, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-white/80">
                  <span className="text-emerald-400 mt-0.5"></span>
                  <span>{strength}</span>
                </li>
              ))
            ) : (
              <li className="text-white/60 text-sm">Building your match...</li>
            )}
          </ul>
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="space-y-3 mb-6">
        {/* Skills Breakdown */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('skills')}
            className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-blue-400">️</span>
              <span className="text-white font-medium">Skills Match</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${getScoreBg(match.skillsMatch.score)} ${getScoreColor(match.skillsMatch.score)}`}>
                {match.skillsMatch.score}%
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-white/50 transition-transform ${expandedSection === 'skills' ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSection === 'skills' && (
            <div className="px-4 pb-4 space-y-3">
              {match.skillsMatch.matched && match.skillsMatch.matched.length > 0 && (
                <div>
                  <p className="text-emerald-400 text-xs font-medium mb-2"> Matched Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {match.skillsMatch.matched.map((skill, i) => (
                      <span key={i} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {match.skillsMatch.missing && match.skillsMatch.missing.length > 0 && (
                <div>
                  <p className="text-red-400 text-xs font-medium mb-2"> Missing Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {match.skillsMatch.missing.map((skill, i) => (
                      <span key={i} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Technologies Breakdown */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('tech')}
            className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-purple-400"></span>
              <span className="text-white font-medium">Technologies Match</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${getScoreBg(match.technologiesMatch.score)} ${getScoreColor(match.technologiesMatch.score)}`}>
                {match.technologiesMatch.score}%
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-white/50 transition-transform ${expandedSection === 'tech' ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSection === 'tech' && (
            <div className="px-4 pb-4 space-y-3">
              {match.technologiesMatch.matched && match.technologiesMatch.matched.length > 0 && (
                <div>
                  <p className="text-emerald-400 text-xs font-medium mb-2"> Technologies You Have</p>
                  <div className="flex flex-wrap gap-2">
                    {match.technologiesMatch.matched.map((tech, i) => (
                      <span key={i} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {match.technologiesMatch.missing && match.technologiesMatch.missing.length > 0 && (
                <div>
                  <p className="text-red-400 text-xs font-medium mb-2"> Technologies to Learn</p>
                  <div className="flex flex-wrap gap-2">
                    {match.technologiesMatch.missing.map((tech, i) => (
                      <span key={i} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Experience Breakdown */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('experience')}
            className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-violet-400"></span>
              <span className="text-white font-medium">Experience Match</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${getScoreBg(match.experienceMatch.score)} ${getScoreColor(match.experienceMatch.score)}`}>
                {match.experienceMatch.score}%
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-white/50 transition-transform ${expandedSection === 'experience' ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSection === 'experience' && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-white/60 text-xs">Your Experience</p>
                  <p className="text-white font-medium">{match.experienceMatch.resumeYears} years</p>
                </div>
                <div className="text-2xl">→</div>
                <div>
                  <p className="text-white/60 text-xs">Required</p>
                  <p className="text-white font-medium">{match.experienceMatch.requiredYears}+ years</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-gradient-to-r from-[#9333EA]/10 to-violet-700/10 rounded-xl p-4 border border-[#9333EA]/20 mb-6">
        <h4 className="text-[#9333EA] font-medium mb-2 flex items-center space-x-2">
          <span></span>
          <span>Recommendation</span>
        </h4>
        <p className="text-white/90 text-sm">{match.recommendation}</p>
      </div>

      {/* Action Button */}
      <button
        onClick={onDiscussWithLex}
        className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-pink-400 transition-all flex items-center justify-center space-x-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span>Discuss This Match with Lex</span>
      </button>
    </div>
  );
}