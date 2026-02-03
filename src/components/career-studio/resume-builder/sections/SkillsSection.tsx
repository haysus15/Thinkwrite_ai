// Skills Section Component
// src/components/career-studio/resume-builder/sections/SkillsSection.tsx

"use client";

import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { SkillGroup } from '@/types/resume-builder';
import { generateId } from '@/types/resume-builder';

interface SkillsSectionProps {
  data: SkillGroup[];
  targetRole?: string;
  onChange: (data: SkillGroup[]) => void;
}

const SUGGESTED_CATEGORIES = [
  'Technical Skills',
  'Programming Languages',
  'Tools & Software',
  'Frameworks & Libraries',
  'Soft Skills',
  'Languages',
  'Certifications',
  'Industry Knowledge'
];

export default function SkillsSection({ data, targetRole, onChange }: SkillsSectionProps) {
  const [newSkillInputs, setNewSkillInputs] = useState<Record<string, string>>({});

  const addSkillGroup = (category?: string) => {
    const newGroup: SkillGroup = {
      id: generateId(),
      category: category || '',
      skills: []
    };
    onChange([...data, newGroup]);
  };

  const updateCategory = (id: string, category: string) => {
    onChange(data.map(group => 
      group.id === id ? { ...group, category } : group
    ));
  };

  const removeSkillGroup = (id: string) => {
    onChange(data.filter(group => group.id !== id));
  };

  const addSkill = (groupId: string) => {
    const skillText = newSkillInputs[groupId]?.trim();
    if (!skillText) return;

    onChange(data.map(group => 
      group.id === groupId 
        ? { ...group, skills: [...group.skills, skillText] }
        : group
    ));
    setNewSkillInputs(prev => ({ ...prev, [groupId]: '' }));
  };

  const removeSkill = (groupId: string, skillIndex: number) => {
    onChange(data.map(group => 
      group.id === groupId 
        ? { ...group, skills: group.skills.filter((_, i) => i !== skillIndex) }
        : group
    ));
  };

  const handleKeyPress = (e: React.KeyboardEvent, groupId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill(groupId);
    }
  };

  // Get unused suggested categories
  const usedCategories = data.map(g => g.category.toLowerCase());
  const availableCategories = SUGGESTED_CATEGORIES.filter(
    cat => !usedCategories.includes(cat.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Skill Groups */}
      {data.map((group) => (
        <div 
          key={group.id}
          className="bg-white/5 border border-white/10 rounded-xl p-5"
        >
          {/* Category Header */}
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              value={group.category}
              onChange={(e) => updateCategory(group.id, e.target.value)}
              placeholder="Category name (e.g., Technical Skills)"
              className="flex-1 bg-transparent border-b border-white/20 pb-1 text-white font-medium placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
            />
            <button
              onClick={() => removeSkillGroup(group.id)}
              className="p-2 text-white/40 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Skills Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {group.skills.map((skill, index) => (
              <span
                key={index}
                className="px-3 py-1.5 bg-[#9333EA]/20 text-[#9333EA] rounded-full text-sm flex items-center gap-2 group"
              >
                {skill}
                <button
                  onClick={() => removeSkill(group.id, index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Add Skill Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSkillInputs[group.id] || ''}
              onChange={(e) => setNewSkillInputs(prev => ({ 
                ...prev, 
                [group.id]: e.target.value 
              }))}
              onKeyPress={(e) => handleKeyPress(e, group.id)}
              placeholder="Type a skill and press Enter..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
            />
            <button
              onClick={() => addSkill(group.id)}
              className="px-4 py-2 bg-[#9333EA]/20 text-[#9333EA] rounded-lg text-sm hover:bg-[#9333EA]/30 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      ))}

      {/* Quick Add Category Buttons */}
      {availableCategories.length > 0 && (
        <div>
          <p className="text-sm text-white/60 mb-3">Quick add a category:</p>
          <div className="flex flex-wrap gap-2">
            {availableCategories.slice(0, 6).map((category) => (
              <button
                key={category}
                onClick={() => addSkillGroup(category)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-white/60 hover:text-white hover:border-[#9333EA] transition-colors"
              >
                + {category}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Custom Category Button */}
      <button
        onClick={() => addSkillGroup()}
        className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl text-white/60 hover:text-white hover:border-[#9333EA] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Custom Category
      </button>

      {/* Target Role Tips */}
      {targetRole && data.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 font-medium mb-2">
             Skills for {targetRole}
          </p>
          <p className="text-sm text-white/70">
            Make sure to include both technical skills specific to the role and soft skills 
            like communication, problem-solving, and teamwork that employers value.
          </p>
        </div>
      )}

      {/* Empty State */}
      {data.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-white/60 mb-2">Organize your skills into categories.</p>
          <p className="text-white/40 text-sm">
            Group related skills together (e.g., Programming Languages, Tools, Soft Skills) 
            to make your resume scannable.
          </p>
        </div>
      )}
    </div>
  );
}