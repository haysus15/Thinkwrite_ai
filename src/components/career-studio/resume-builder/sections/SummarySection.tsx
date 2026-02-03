// Summary Section Component
// src/components/career-studio/resume-builder/sections/SummarySection.tsx

"use client";

import React, { useState } from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';

interface SummarySectionProps {
  data: string;
  targetRole?: string;
  onChange: (data: string) => void;
}

export default function SummarySection({ data, targetRole, onChange }: SummarySectionProps) {
  const [charCount, setCharCount] = useState(data.length);

  const handleChange = (value: string) => {
    setCharCount(value.length);
    onChange(value);
  };

  const getCharCountColor = () => {
    if (charCount === 0) return 'text-white/40';
    if (charCount < 100) return 'text-violet-400';
    if (charCount > 500) return 'text-orange-400';
    return 'text-green-400';
  };

  const prompts = [
    "What's your professional identity? (e.g., 'Data Analyst with 5 years of experience...')",
    "What's your biggest professional accomplishment?",
    "What makes you unique in your field?",
    "What value do you bring to employers?"
  ];

  return (
    <div className="space-y-6">
      {/* Main Text Area */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">
          Professional Summary
        </label>
        <textarea
          value={data}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Write a compelling 2-4 sentence summary that highlights your experience, key skills, and what you bring to the table..."
          rows={6}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] transition-colors resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-white/40">
            Aim for 100-300 characters. Be specific and impactful.
          </p>
          <span className={`text-xs font-medium ${getCharCountColor()}`}>
            {charCount} characters
          </span>
        </div>
      </div>

      {/* Writing Prompts */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-[#9333EA]" />
          Not sure what to write? Try answering these:
        </h4>
        <ul className="space-y-2">
          {prompts.map((prompt, i) => (
            <li key={i} className="text-sm text-white/60 flex items-start gap-2">
              <span className="text-[#9333EA]">{i + 1}.</span>
              {prompt}
            </li>
          ))}
        </ul>
      </div>

      {/* Target Role Context */}
      {targetRole && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <h4 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Targeting: {targetRole}
          </h4>
          <p className="text-sm text-white/70">
            Tailor your summary to highlight skills and experience relevant to {targetRole} positions. 
            Mention specific technologies, methodologies, or achievements that matter for this role.
          </p>
        </div>
      )}

      {/* Example */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h4 className="text-white font-medium mb-3">Example Summary</h4>
        <p className="text-white/70 text-sm italic">
          "Results-driven Data Analyst with 5+ years of experience transforming complex datasets 
          into actionable business insights. Proficient in SQL, Python, and Tableau, with a proven 
          track record of reducing reporting time by 40% and identifying $2M in cost savings. 
          Passionate about leveraging data to drive strategic decision-making."
        </p>
        <p className="text-xs text-white/40 mt-3">
          Notice: specific years, tools, quantified achievements, and clear value proposition.
        </p>
      </div>
    </div>
  );
}