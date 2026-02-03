"use client";

import React, { useState } from 'react';
import type { IndustryIntelligence } from '../../../types/job-analysis';

interface IndustryIntelligenceProps {
  industryIntelligence: IndustryIntelligence;
}

export default function IndustryIntelligence({ industryIntelligence }: IndustryIntelligenceProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('patterns');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 shadow-2xl">
      <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-3">
        <span className="text-2xl"></span>
        <span>Industry Intelligence - {industryIntelligence.sector}</span>
      </h3>

      {/* Hiring Patterns */}
      {industryIntelligence.hiringPatterns && industryIntelligence.hiringPatterns.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('patterns')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-blue-400"></span>
                <span>Hiring Patterns & Timing</span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'patterns' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'patterns' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <p className="text-white/70 text-sm mb-4 italic">
                Understanding how {industryIntelligence.sector.toLowerCase()} companies typically hire:
              </p>
              <ul className="space-y-3">
                {industryIntelligence.hiringPatterns.map((pattern, index) => (
                  <li key={index} className="flex items-start space-x-3 text-sm text-white/90">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Buzzword Meanings */}
      {industryIntelligence.buzzwordMeanings && industryIntelligence.buzzwordMeanings.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('buzzwords')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-purple-400">️</span>
                <span>Industry Buzzwords Decoded</span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'buzzwords' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'buzzwords' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <p className="text-white/70 text-sm mb-4 italic">
                Industry-specific terms and what they really mean:
              </p>
              <ul className="space-y-3">
                {industryIntelligence.buzzwordMeanings.map((meaning, index) => (
                  <li key={index} className="flex items-start space-x-3 text-sm text-white/90">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span>{meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Application Tips */}
      {industryIntelligence.applicationTips && industryIntelligence.applicationTips.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('tips')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-emerald-400"></span>
                <span>Application Strategy Tips</span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'tips' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'tips' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <p className="text-white/70 text-sm mb-4 italic">
                Insider tips for applying to {industryIntelligence.sector.toLowerCase()} roles:
              </p>
              <ul className="space-y-3">
                {industryIntelligence.applicationTips.map((tip, index) => (
                  <li key={index} className="flex items-start space-x-3 text-sm text-white/90">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Industry Summary */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 rounded-xl p-5 border border-blue-500/20">
        <h4 className="text-blue-400 font-semibold mb-3 flex items-center space-x-2">
          <span></span>
          <span>Key Takeaway for {industryIntelligence.sector}</span>
        </h4>
        <p className="text-white/90 text-sm leading-relaxed">
          {industryIntelligence.sector === 'Technology' && 
            "Tech hiring moves fast but values cultural fit highly. Portfolio and live demos often matter more than formal credentials. Remote work is more accepted, but competition is fierce."
          }
          {industryIntelligence.sector === 'Financial Services' && 
            "Finance hiring is relationship-driven with thorough background checks. Quantifiable results and regulatory experience are crucial. Timing often correlates with fiscal cycles."
          }
          {industryIntelligence.sector === 'Healthcare' && 
            "Healthcare hiring prioritizes compliance and patient safety. Certifications and continuing education are essential. Expect rigorous screening processes."
          }
          {industryIntelligence.sector === 'Marketing' && 
            "Marketing hiring focuses on creativity balanced with data skills. Portfolio of campaigns and measurable results are key. Industry experience often trumps general skills."
          }
          {!['Technology', 'Financial Services', 'Healthcare', 'Marketing'].includes(industryIntelligence.sector) &&
            "Understanding industry-specific hiring patterns and expectations will give you a significant advantage in your application strategy."
          }
        </p>
      </div>
    </div>
  );
}