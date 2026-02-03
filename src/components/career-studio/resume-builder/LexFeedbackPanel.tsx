// Lex Feedback Panel Component
// src/components/career-studio/resume-builder/LexFeedbackPanel.tsx

"use client";

import React from 'react';
import { X, Check, ThumbsUp, AlertTriangle, Lightbulb, ArrowRight, Sparkles } from 'lucide-react';
import type { SectionFeedback } from '@/types/resume-builder';

interface LexFeedbackPanelProps {
  feedback: SectionFeedback;
  section: string;
  onClose: () => void;
  onApplyRewrite: (original: string, suggested: string) => void;
  onMarkPolished: () => void;
}

export default function LexFeedbackPanel({ 
  feedback, 
  section, 
  onClose, 
  onApplyRewrite,
  onMarkPolished 
}: LexFeedbackPanelProps) {
  const getSectionTitle = (key: string) => {
    const titles: Record<string, string> = {
      contact: 'Contact Info',
      summary: 'Summary',
      experience: 'Experience',
      education: 'Education',
      skills: 'Skills',
      projects: 'Projects',
      certifications: 'Certifications'
    };
    return titles[key] || key;
  };

  return (
    <aside className="w-96 border-l border-white/10 bg-black/40 backdrop-blur-sm flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#9333EA] flex items-center justify-center text-white font-bold">
            L
          </div>
          <div>
            <h3 className="text-white font-semibold">Lex's Feedback</h3>
            <p className="text-sm text-white/60">{getSectionTitle(section)}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Score (if available) */}
        {feedback.score !== undefined && (
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <div className="text-4xl font-bold text-[#9333EA] mb-1">
              {feedback.score}/100
            </div>
            <p className="text-sm text-white/60">Section Score</p>
          </div>
        )}

        {/* Strengths */}
        {feedback.strengths.length > 0 && (
          <div>
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-green-400" />
              What's Working
            </h4>
            <ul className="space-y-2">
              {feedback.strengths.map((strength, i) => (
                <li 
                  key={i}
                  className="text-sm text-white/80 bg-green-500/10 border border-green-500/20 rounded-lg p-3"
                >
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {feedback.improvements.length > 0 && (
          <div>
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-violet-400" />
              Areas to Improve
            </h4>
            <ul className="space-y-3">
              {feedback.improvements.map((improvement, i) => (
                <li 
                  key={i}
                  className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3"
                >
                  <p className="text-sm text-white/80 font-medium mb-1">
                    {improvement.issue}
                  </p>
                  <p className="text-sm text-white/60">
                    {improvement.suggestion}
                  </p>
                  {improvement.example && (
                    <p className="text-xs text-[#9333EA] mt-2 italic">
                      Example: "{improvement.example}"
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rewrites */}
        {feedback.rewrites && feedback.rewrites.length > 0 && (
          <div>
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#9333EA]" />
              Suggested Rewrites
            </h4>
            <ul className="space-y-4">
              {feedback.rewrites.map((rewrite, i) => (
                <li 
                  key={i}
                  className="bg-white/5 border border-white/10 rounded-lg p-4"
                >
                  {/* Original */}
                  <div className="mb-3">
                    <p className="text-xs text-white/40 mb-1">Original:</p>
                    <p className="text-sm text-white/60 line-through">
                      {rewrite.original}
                    </p>
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex justify-center my-2">
                    <ArrowRight className="w-4 h-4 text-[#9333EA]" />
                  </div>
                  
                  {/* Suggested */}
                  <div className="mb-3">
                    <p className="text-xs text-[#9333EA] mb-1">Suggested:</p>
                    <p className="text-sm text-white">
                      {rewrite.suggested}
                    </p>
                  </div>
                  
                  {/* Reason */}
                  <p className="text-xs text-white/50 mb-3">
                    Why: {rewrite.reason}
                  </p>
                  
                  {/* Apply Button */}
                  <button
                    onClick={() => onApplyRewrite(rewrite.original, rewrite.suggested)}
                    className="w-full py-2 bg-[#9333EA]/20 text-[#9333EA] rounded-lg text-sm hover:bg-[#9333EA]/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Apply This Change
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Overall Tip */}
        <div className="bg-[#9333EA]/10 border border-[#9333EA]/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-[#9333EA] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-white/80">
                {feedback.overallTip}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-5 border-t border-white/10 space-y-3">
        <button
          onClick={onMarkPolished}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-500 transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Mark as Polished
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 bg-white/10 text-white/80 rounded-xl font-medium hover:bg-white/20 transition-colors"
        >
          Keep Editing
        </button>
      </div>
    </aside>
  );
}