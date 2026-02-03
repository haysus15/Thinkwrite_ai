// Experience Section Component
// src/components/career-studio/resume-builder/sections/ExperienceSection.tsx

"use client";

import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import type { ExperienceEntry } from '@/types/resume-builder';
import { generateId } from '@/types/resume-builder';

interface ExperienceSectionProps {
  data: ExperienceEntry[];
  onChange: (data: ExperienceEntry[]) => void;
}

export default function ExperienceSection({ data, onChange }: ExperienceSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(data[0]?.id || null);
  const [showBulletTips, setShowBulletTips] = useState(false);

  const addExperience = () => {
    const newEntry: ExperienceEntry = {
      id: generateId(),
      jobTitle: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      bullets: ['']
    };
    onChange([...data, newEntry]);
    setExpandedId(newEntry.id);
  };

  const updateExperience = (id: string, updates: Partial<ExperienceEntry>) => {
    onChange(data.map(exp => 
      exp.id === id ? { ...exp, ...updates } : exp
    ));
  };

  const removeExperience = (id: string) => {
    onChange(data.filter(exp => exp.id !== id));
  };

  const addBullet = (expId: string) => {
    const exp = data.find(e => e.id === expId);
    if (exp) {
      updateExperience(expId, { bullets: [...exp.bullets, ''] });
    }
  };

  const updateBullet = (expId: string, bulletIndex: number, value: string) => {
    const exp = data.find(e => e.id === expId);
    if (exp) {
      const newBullets = [...exp.bullets];
      newBullets[bulletIndex] = value;
      updateExperience(expId, { bullets: newBullets });
    }
  };

  const removeBullet = (expId: string, bulletIndex: number) => {
    const exp = data.find(e => e.id === expId);
    if (exp && exp.bullets.length > 1) {
      const newBullets = exp.bullets.filter((_, i) => i !== bulletIndex);
      updateExperience(expId, { bullets: newBullets });
    }
  };

  return (
    <div className="space-y-6">
      {/* Experience List */}
      {data.map((exp, index) => (
        <div 
          key={exp.id}
          className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
        >
          {/* Header - Always Visible */}
          <div 
            className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/5"
            onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
          >
            <GripVertical className="w-5 h-5 text-white/20" />
            
            <div className="flex-1">
              <h3 className="text-white font-medium">
                {exp.jobTitle || 'New Position'}
                {exp.company && <span className="text-white/60"> at {exp.company}</span>}
              </h3>
              <p className="text-sm text-white/40">
                {exp.startDate && (
                  <>
                    {exp.startDate} - {exp.isCurrent ? 'Present' : (exp.endDate || 'Present')}
                  </>
                )}
                {!exp.startDate && 'Click to add details'}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeExperience(exp.id);
              }}
              className="p-2 text-white/40 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {expandedId === exp.id ? (
              <ChevronUp className="w-5 h-5 text-white/40" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/40" />
            )}
          </div>

          {/* Expanded Content */}
          {expandedId === exp.id && (
            <div className="px-5 pb-5 border-t border-white/10 pt-5 space-y-4">
              {/* Job Title & Company */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Job Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={exp.jobTitle}
                    onChange={(e) => updateExperience(exp.id, { jobTitle: e.target.value })}
                    placeholder="e.g., Senior Data Analyst"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Company <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={exp.company}
                    onChange={(e) => updateExperience(exp.id, { company: e.target.value })}
                    placeholder="e.g., Acme Corporation"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={exp.location || ''}
                  onChange={(e) => updateExperience(exp.id, { location: e.target.value })}
                  placeholder="e.g., New York, NY or Remote"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
              </div>

              {/* Dates */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Start Date
                  </label>
                  <input
                    type="text"
                    value={exp.startDate}
                    onChange={(e) => updateExperience(exp.id, { startDate: e.target.value })}
                    placeholder="e.g., Jan 2022 or 01/2022"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    End Date
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={exp.isCurrent ? '' : exp.endDate}
                      onChange={(e) => updateExperience(exp.id, { endDate: e.target.value })}
                      placeholder={exp.isCurrent ? 'Current' : 'e.g., Dec 2023'}
                      disabled={exp.isCurrent}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] disabled:opacity-50"
                    />
                    <label className="flex items-center gap-2 text-sm text-white/60">
                      <input
                        type="checkbox"
                        checked={exp.isCurrent}
                        onChange={(e) => updateExperience(exp.id, { 
                          isCurrent: e.target.checked,
                          endDate: e.target.checked ? '' : exp.endDate
                        })}
                        className="rounded bg-white/10 border-white/20 text-[#9333EA] focus:ring-[#9333EA]"
                      />
                      I currently work here
                    </label>
                  </div>
                </div>
              </div>

              {/* Bullets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-white/80">
                    Responsibilities & Achievements
                  </label>
                  <button
                    onClick={() => setShowBulletTips(!showBulletTips)}
                    className="text-xs text-[#9333EA] hover:underline flex items-center gap-1"
                  >
                    <Lightbulb className="w-3 h-3" />
                    {showBulletTips ? 'Hide tips' : 'Show tips'}
                  </button>
                </div>

                {showBulletTips && (
                  <div className="bg-[#9333EA]/10 border border-[#9333EA]/30 rounded-lg p-3 mb-3 text-sm">
                    <p className="text-white/80 font-medium mb-2">Write stronger bullets:</p>
                    <ul className="text-white/60 space-y-1 text-xs">
                      <li>• Start with strong action verbs (Led, Developed, Increased, Reduced)</li>
                      <li>• Include numbers and metrics when possible</li>
                      <li>• Focus on impact and results, not just duties</li>
                      <li>• Use the formula: Action + Task + Result</li>
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  {exp.bullets.map((bullet, bulletIndex) => (
                    <div key={bulletIndex} className="flex items-start gap-2">
                      <span className="text-[#9333EA] mt-3">•</span>
                      <textarea
                        value={bullet}
                        onChange={(e) => updateBullet(exp.id, bulletIndex, e.target.value)}
                        placeholder="Describe what you did and the impact it had..."
                        rows={2}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] resize-none text-sm"
                      />
                      {exp.bullets.length > 1 && (
                        <button
                          onClick={() => removeBullet(exp.id, bulletIndex)}
                          className="mt-2 p-1 text-white/30 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => addBullet(exp.id)}
                  className="mt-2 text-sm text-[#9333EA] hover:text-[#A855F7] flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Bullet Point
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add Experience Button */}
      <button
        onClick={addExperience}
        className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl text-white/60 hover:text-white hover:border-[#9333EA] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Work Experience
      </button>

      {/* Empty State Tips */}
      {data.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-white/60 mb-2">Start by adding your most recent position first.</p>
          <p className="text-white/40 text-sm">
            Employers typically scan the top of your resume, so lead with your strongest experience.
          </p>
        </div>
      )}
    </div>
  );
}