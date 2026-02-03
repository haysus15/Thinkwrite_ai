"use client";

import React, { useState } from 'react';
import type { HiddenInsights } from '../../../types/job-analysis';

interface HiddenInsightsProps {
  hiddenInsights: HiddenInsights;
  jobTitle: string;
}

export default function HiddenInsights({ hiddenInsights, jobTitle }: HiddenInsightsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const totalConcerns = 
    (hiddenInsights.phraseTranslations?.length || 0) +
    (hiddenInsights.cultureClues?.length || 0) + 
    (hiddenInsights.compensationSignals?.length || 0);

  const concernLevel = totalConcerns >= 4 ? 'high' : totalConcerns >= 2 ? 'medium' : 'low';
  
  const concernColor = {
    low: 'text-emerald-400',
    medium: 'text-violet-400', 
    high: 'text-orange-400'
  }[concernLevel];

  const concernIcon = {
    low: '',
    medium: '️',
    high: ''
  }[concernLevel];

  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 shadow-2xl">
      <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-3">
        <span className="text-2xl"></span>
        <span>Hidden Insights - What This Job Really Means</span>
      </h3>

      {/* Overall Assessment */}
      <div className="mb-6 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium">Overall Assessment</h4>
          <div className={`flex items-center space-x-2 ${concernColor}`}>
            <span className="text-lg">{concernIcon}</span>
            <span className="font-semibold capitalize">{concernLevel} Concern</span>
          </div>
        </div>
        
        <p className="text-white/80 text-sm leading-relaxed">
          {concernLevel === 'low' && `This ${jobTitle} posting looks relatively clean with ${totalConcerns} minor concern${totalConcerns !== 1 ? 's' : ''}. The language suggests a fairly straightforward opportunity.`}
          {concernLevel === 'medium' && `This ${jobTitle} role has mixed signals with ${totalConcerns} potential concerns. Not necessarily a deal-breaker, but worth investigating during interviews.`}
          {concernLevel === 'high' && `This ${jobTitle} posting raises ${totalConcerns} red flags. Proceed with caution and ask targeted questions to address these concerns.`}
        </p>
      </div>

      {/* Phrase Translations - The Core Feature */}
      {hiddenInsights.phraseTranslations && hiddenInsights.phraseTranslations.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('phrases')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-orange-400"></span>
                <span>Red Flag Phrases Decoded</span>
                <span className="bg-orange-400/20 text-orange-400 px-2 py-1 rounded-full text-xs">
                  {hiddenInsights.phraseTranslations.length}
                </span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'phrases' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'phrases' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <p className="text-white/70 text-sm mb-4 italic">
                These phrases have hidden meanings that most job seekers miss:
              </p>
              <div className="space-y-4">
                {hiddenInsights.phraseTranslations.map((translation, index) => (
                  <div key={index} className="border border-orange-400/20 rounded-lg p-4 bg-orange-400/5">
                    <div className="mb-3">
                      <span className="text-orange-400 text-xs font-medium uppercase tracking-wide">They wrote:</span>
                      <p className="text-white font-medium mt-1">
                        "{translation.original}"
                      </p>
                    </div>
                    <div>
                      <span className="text-white/70 text-xs font-medium uppercase tracking-wide">What it really means:</span>
                      <p className="text-white/90 text-sm mt-1 leading-relaxed">
                        {translation.meaning}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Urgency Indicators */}
      {hiddenInsights.urgencyIndicators && hiddenInsights.urgencyIndicators.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('urgency')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-blue-400">⏰</span>
                <span>Hiring Urgency Signals</span>
                <span className="bg-blue-400/20 text-blue-400 px-2 py-1 rounded-full text-xs">
                  {hiddenInsights.urgencyIndicators.length}
                </span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'urgency' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'urgency' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <ul className="space-y-2">
                {hiddenInsights.urgencyIndicators.map((indicator, index) => (
                  <li key={index} className="flex items-start space-x-3 text-sm text-white/90">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>{indicator}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Culture Clues */}
      {hiddenInsights.cultureClues && hiddenInsights.cultureClues.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('culture')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-purple-400"></span>
                <span>Culture Warning Signs</span>
                <span className="bg-purple-400/20 text-purple-400 px-2 py-1 rounded-full text-xs">
                  {hiddenInsights.cultureClues.length}
                </span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'culture' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'culture' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <ul className="space-y-2">
                {hiddenInsights.cultureClues.map((clue, index) => (
                  <li key={index} className="flex items-start space-x-3 text-sm text-white/90">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span>{clue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Compensation Signals */}
      {hiddenInsights.compensationSignals && hiddenInsights.compensationSignals.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('compensation')}
            className="w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-5 border border-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold flex items-center space-x-3">
                <span className="text-green-400"></span>
                <span>Compensation Red Flags</span>
                <span className="bg-green-400/20 text-green-400 px-2 py-1 rounded-full text-xs">
                  {hiddenInsights.compensationSignals.length}
                </span>
              </h4>
              <svg 
                className={`w-5 h-5 text-white/60 transition-transform ${expandedSection === 'compensation' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedSection === 'compensation' && (
            <div className="mt-3 bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
              <ul className="space-y-2">
                {hiddenInsights.compensationSignals.map((signal, index) => (
                  <li key={index} className="flex items-start space-x-3 text-sm text-white/90">
                    <span className="text-green-400 mt-0.5">•</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* No Concerns Found */}
      {totalConcerns === 0 && (
        <div className="bg-emerald-500/10 rounded-xl p-5 border border-emerald-500/20">
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-2xl"></span>
            <h4 className="text-emerald-400 font-semibold">Clean Job Posting</h4>
          </div>
          <p className="text-white/90 text-sm">
            This job posting is remarkably clean! No major red flag phrases detected. 
            While this doesn't guarantee a perfect workplace, it suggests they're being 
            straightforward about expectations.
          </p>
        </div>
      )}

      {/* Bottom Action Note */}
      {totalConcerns > 0 && (
        <div className="mt-6 bg-gradient-to-r from-[#9333EA]/10 to-violet-700/10 rounded-xl p-4 border border-[#9333EA]/20">
          <p className="text-[#9333EA] text-sm font-medium mb-2"> Pro Tip:</p>
          <p className="text-white/90 text-sm">
            These insights aren't automatic deal-breakers - they're interview questions waiting to happen. 
            Use them to ask targeted questions that reveal if these concerns are real.
          </p>
        </div>
      )}
    </div>
  );
}