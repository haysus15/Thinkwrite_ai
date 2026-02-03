// Education Section Component
// src/components/career-studio/resume-builder/sections/EducationSection.tsx

"use client";

import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { EducationEntry } from '@/types/resume-builder';
import { generateId } from '@/types/resume-builder';

interface EducationSectionProps {
  data: EducationEntry[];
  onChange: (data: EducationEntry[]) => void;
}

export default function EducationSection({ data, onChange }: EducationSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(data[0]?.id || null);

  const addEducation = () => {
    const newEntry: EducationEntry = {
      id: generateId(),
      degree: '',
      institution: '',
      location: '',
      graduationDate: '',
      gpa: '',
      honors: [],
      relevantCoursework: []
    };
    onChange([...data, newEntry]);
    setExpandedId(newEntry.id);
  };

  const updateEducation = (id: string, updates: Partial<EducationEntry>) => {
    onChange(data.map(edu => 
      edu.id === id ? { ...edu, ...updates } : edu
    ));
  };

  const removeEducation = (id: string) => {
    onChange(data.filter(edu => edu.id !== id));
  };

  const handleHonorsChange = (id: string, value: string) => {
    const honors = value.split(',').map(h => h.trim()).filter(h => h.length > 0);
    updateEducation(id, { honors });
  };

  const handleCourseworkChange = (id: string, value: string) => {
    const coursework = value.split(',').map(c => c.trim()).filter(c => c.length > 0);
    updateEducation(id, { relevantCoursework: coursework });
  };

  return (
    <div className="space-y-6">
      {/* Education List */}
      {data.map((edu) => (
        <div 
          key={edu.id}
          className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
        >
          {/* Header */}
          <div 
            className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/5"
            onClick={() => setExpandedId(expandedId === edu.id ? null : edu.id)}
          >
            <div className="flex-1">
              <h3 className="text-white font-medium">
                {edu.degree || 'New Education'}
              </h3>
              <p className="text-sm text-white/40">
                {edu.institution || 'Click to add details'}
                {edu.graduationDate && ` • ${edu.graduationDate}`}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeEducation(edu.id);
              }}
              className="p-2 text-white/40 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {expandedId === edu.id ? (
              <ChevronUp className="w-5 h-5 text-white/40" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/40" />
            )}
          </div>

          {/* Expanded Content */}
          {expandedId === edu.id && (
            <div className="px-5 pb-5 border-t border-white/10 pt-5 space-y-4">
              {/* Degree */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Degree <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) => updateEducation(edu.id, { degree: e.target.value })}
                  placeholder="e.g., Bachelor of Science in Computer Science"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
              </div>

              {/* Institution & Location */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Institution <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={edu.institution}
                    onChange={(e) => updateEducation(edu.id, { institution: e.target.value })}
                    placeholder="e.g., University of California"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={edu.location || ''}
                    onChange={(e) => updateEducation(edu.id, { location: e.target.value })}
                    placeholder="e.g., Berkeley, CA"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                  />
                </div>
              </div>

              {/* Graduation Date & GPA */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Graduation Date
                  </label>
                  <input
                    type="text"
                    value={edu.graduationDate || ''}
                    onChange={(e) => updateEducation(edu.id, { graduationDate: e.target.value })}
                    placeholder="e.g., May 2023 or Expected Dec 2024"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    GPA (optional)
                  </label>
                  <input
                    type="text"
                    value={edu.gpa || ''}
                    onChange={(e) => updateEducation(edu.id, { gpa: e.target.value })}
                    placeholder="e.g., 3.8/4.0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                  />
                  <p className="mt-1 text-xs text-white/40">
                    Include if 3.5+ or if you're a recent graduate
                  </p>
                </div>
              </div>

              {/* Honors */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Honors & Awards (optional)
                </label>
                <input
                  type="text"
                  value={edu.honors?.join(', ') || ''}
                  onChange={(e) => handleHonorsChange(edu.id, e.target.value)}
                  placeholder="e.g., Magna Cum Laude, Dean's List, Phi Beta Kappa"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
                <p className="mt-1 text-xs text-white/40">
                  Separate multiple honors with commas
                </p>
              </div>

              {/* Relevant Coursework */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Relevant Coursework (optional)
                </label>
                <input
                  type="text"
                  value={edu.relevantCoursework?.join(', ') || ''}
                  onChange={(e) => handleCourseworkChange(edu.id, e.target.value)}
                  placeholder="e.g., Data Structures, Machine Learning, Statistics"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
                <p className="mt-1 text-xs text-white/40">
                  Include courses relevant to your target role (separate with commas)
                </p>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add Education Button */}
      <button
        onClick={addEducation}
        className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl text-white/60 hover:text-white hover:border-[#9333EA] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Education
      </button>

      {/* Tips */}
      {data.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-white/60 mb-2">Add your highest level of education first.</p>
          <p className="text-white/40 text-sm">
            Include degrees, certifications, bootcamps, or relevant training programs.
          </p>
        </div>
      )}
    </div>
  );
}