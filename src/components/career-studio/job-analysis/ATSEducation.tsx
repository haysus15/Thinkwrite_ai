"use client";

import React, { useState } from 'react';

interface ATSEducationProps {
  className?: string;
}

export default function ATSEducation({ className = '' }: ATSEducationProps) {
  const [expandedSection, setExpandedSection] = useState<string>('');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  return (
    <div className={`bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 shadow-2xl ${className}`}>
      <div className="flex items-center space-x-3 mb-6">
        <span className="text-2xl"></span>
        <h3 className="text-xl font-semibold text-white">Understanding ATS & Why Keywords Matter</h3>
      </div>

      {/* What is ATS? */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('what-is-ats')}
          className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-4 border border-white/[0.05] transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold flex items-center space-x-3">
              <span className="text-blue-400"></span>
              <span>What is an ATS (Applicant Tracking System)?</span>
            </h4>
            <svg 
              className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'what-is-ats' ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expandedSection === 'what-is-ats' && (
          <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
            <div className="space-y-4 text-white/90">
              <p className="text-sm leading-relaxed">
                An <strong>Applicant Tracking System (ATS)</strong> is software that companies use to automatically filter and rank job applications before human recruiters ever see them.
              </p>
              
              <div className="bg-blue-400/10 rounded-lg p-4 border border-blue-400/20">
                <h5 className="text-blue-400 font-medium mb-2 flex items-center space-x-2">
                  <span></span>
                  <span>The Reality:</span>
                </h5>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span><strong>75% of large companies</strong> use ATS systems to screen applications</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span><strong>98% of Fortune 500</strong> companies rely on ATS for initial screening</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span><strong>60-70% of resumes</strong> are automatically rejected before human review</span>
                  </li>
                </ul>
              </div>

              <div className="text-sm text-white/80 italic">
                 <strong>Bottom line:</strong> Your resume needs to "speak ATS" to even reach human eyes. ThinkWrite's keyword extraction ensures you're not filtered out by robots.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* How ATS Works */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('how-ats-works')}
          className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-4 border border-white/[0.05] transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold flex items-center space-x-3">
              <span className="text-purple-400">️</span>
              <span>How Does ATS Screening Work?</span>
            </h4>
            <svg 
              className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'how-ats-works' ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expandedSection === 'how-ats-works' && (
          <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
            <div className="space-y-4">
              <p className="text-white/90 text-sm">
                ATS systems scan your resume and assign it a compatibility score based on how well it matches the job posting. Here's the process:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-white/[0.02] rounded-lg">
                  <span className="bg-purple-400/20 text-purple-400 px-2 py-1 rounded text-xs font-bold">1</span>
                  <div>
                    <h6 className="text-white font-medium text-sm">Keyword Matching</h6>
                    <p className="text-white/70 text-xs mt-1">Scans for exact skills, technologies, and buzzwords from the job description</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-white/[0.02] rounded-lg">
                  <span className="bg-purple-400/20 text-purple-400 px-2 py-1 rounded text-xs font-bold">2</span>
                  <div>
                    <h6 className="text-white font-medium text-sm">Format Parsing</h6>
                    <p className="text-white/70 text-xs mt-1">Attempts to extract contact info, work history, education, and skills</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-white/[0.02] rounded-lg">
                  <span className="bg-purple-400/20 text-purple-400 px-2 py-1 rounded text-xs font-bold">3</span>
                  <div>
                    <h6 className="text-white font-medium text-sm">Score Assignment</h6>
                    <p className="text-white/70 text-xs mt-1">Assigns a numerical score (usually 0-100) based on keyword density and relevance</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-white/[0.02] rounded-lg">
                  <span className="bg-purple-400/20 text-purple-400 px-2 py-1 rounded text-xs font-bold">4</span>
                  <div>
                    <h6 className="text-white font-medium text-sm">Ranking & Filtering</h6>
                    <p className="text-white/70 text-xs mt-1">Only top-scoring resumes (typically 60+ score) reach human recruiters</p>
                  </div>
                </div>
              </div>

              <div className="bg-red-400/10 rounded-lg p-4 border border-red-400/20">
                <h5 className="text-red-400 font-medium mb-2 flex items-center space-x-2">
                  <span>️</span>
                  <span>Common ATS Mistakes:</span>
                </h5>
                <ul className="space-y-1 text-sm text-white/80">
                  <li className="flex items-start space-x-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>Using different terms than job posting ("JS" vs "JavaScript")</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>Complex formatting that confuses parsing</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>Missing industry buzzwords and required skills</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Why Keywords Matter */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('why-keywords')}
          className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-4 border border-white/[0.05] transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold flex items-center space-x-3">
              <span className="text-emerald-400"></span>
              <span>Why Exact Keywords Are Critical</span>
            </h4>
            <svg 
              className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'why-keywords' ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expandedSection === 'why-keywords' && (
          <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
            <div className="space-y-4">
              <p className="text-white/90 text-sm">
                ATS systems look for <strong>exact matches</strong> between job postings and resumes. Small differences can mean the difference between getting an interview or being automatically rejected.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-400/10 rounded-lg p-4 border border-red-400/20">
                  <h5 className="text-red-400 font-medium mb-2 flex items-center space-x-2">
                    <span></span>
                    <span>ATS Rejects:</span>
                  </h5>
                  <ul className="space-y-1 text-xs text-white/80">
                    <li>"JS" (when posting says "JavaScript")</li>
                    <li>"Project Manager" (when posting says "Product Manager")</li>
                    <li>"AI" (when posting says "Artificial Intelligence")</li>
                    <li>"Leadership" (when posting emphasizes "Team Leadership")</li>
                  </ul>
                </div>

                <div className="bg-emerald-400/10 rounded-lg p-4 border border-emerald-400/20">
                  <h5 className="text-emerald-400 font-medium mb-2 flex items-center space-x-2">
                    <span></span>
                    <span>ATS Accepts:</span>
                  </h5>
                  <ul className="space-y-1 text-xs text-white/80">
                    <li>"JavaScript" (exact match)</li>
                    <li>"Product Manager" (exact match)</li>
                    <li>"Artificial Intelligence" (exact match)</li>
                    <li>"Team Leadership" (exact match)</li>
                  </ul>
                </div>
              </div>

              <div className="bg-emerald-400/10 rounded-lg p-4 border border-emerald-400/20">
                <h5 className="text-emerald-400 font-medium mb-2 flex items-center space-x-2">
                  <span></span>
                  <span>ThinkWrite's Advantage:</span>
                </h5>
                <p className="text-sm text-white/90">
                  Our keyword extraction finds the <strong>exact terms</strong> used in job postings, ranked by importance. 
                  Instead of guessing, you get the precise vocabulary that will maximize your ATS score.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ATS Optimization Best Practices */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('best-practices')}
          className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-4 border border-white/[0.05] transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold flex items-center space-x-3">
              <span className="text-violet-400"></span>
              <span>ATS Optimization Best Practices</span>
            </h4>
            <svg 
              className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'best-practices' ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expandedSection === 'best-practices' && (
          <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-violet-400 font-medium mb-3 flex items-center space-x-2">
                    <span></span>
                    <span>Do This:</span>
                  </h5>
                  <ul className="space-y-2 text-sm text-white/90">
                    <li className="flex items-start space-x-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>Use exact keywords from job posting</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>Include both full names and acronyms (AI and Artificial Intelligence)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>Use standard section headers (Experience, Skills, Education)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>Include high-priority keywords 2-3 times naturally</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>Save as .docx for best ATS compatibility</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h5 className="text-red-400 font-medium mb-3 flex items-center space-x-2">
                    <span></span>
                    <span>Avoid This:</span>
                  </h5>
                  <ul className="space-y-2 text-sm text-white/90">
                    <li className="flex items-start space-x-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Complex tables or columns that break parsing</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Graphics, images, or text boxes</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Creative fonts or unusual formatting</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Keyword stuffing (repeating words unnaturally)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Headers and footers (often ignored by ATS)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-[#9333EA]/10 to-violet-700/10 rounded-xl p-5 border border-[#9333EA]/20">
        <h4 className="text-[#9333EA] font-semibold mb-3 flex items-center space-x-2">
          <span></span>
          <span>The Bottom Line</span>
        </h4>
        <div className="space-y-2 text-sm text-white/90">
          <p>
            <strong>ATS systems are gatekeepers</strong> that determine whether your resume reaches human recruiters. 
            Without proper keyword optimization, even the most qualified candidates get automatically filtered out.
          </p>
          <p className="text-[#9333EA] font-medium">
            ThinkWrite's keyword extraction gives you the insider advantage - the exact terms and phrases 
            that will maximize your ATS score and get your resume in front of real people.
          </p>
        </div>
      </div>
    </div>
  );
}