// Projects Section Component
// src/components/career-studio/resume-builder/sections/ProjectsSection.tsx

"use client";

import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { ProjectEntry } from '@/types/resume-builder';
import { generateId } from '@/types/resume-builder';

interface ProjectsSectionProps {
  data: ProjectEntry[];
  onChange: (data: ProjectEntry[]) => void;
}

export default function ProjectsSection({ data, onChange }: ProjectsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(data[0]?.id || null);

  const addProject = () => {
    const newEntry: ProjectEntry = {
      id: generateId(),
      name: '',
      description: '',
      technologies: [],
      url: '',
      bullets: ['']
    };
    onChange([...data, newEntry]);
    setExpandedId(newEntry.id);
  };

  const updateProject = (id: string, updates: Partial<ProjectEntry>) => {
    onChange(data.map(proj => 
      proj.id === id ? { ...proj, ...updates } : proj
    ));
  };

  const removeProject = (id: string) => {
    onChange(data.filter(proj => proj.id !== id));
  };

  const handleTechnologiesChange = (id: string, value: string) => {
    const technologies = value.split(',').map(t => t.trim()).filter(t => t.length > 0);
    updateProject(id, { technologies });
  };

  const addBullet = (projectId: string) => {
    const project = data.find(p => p.id === projectId);
    if (project) {
      updateProject(projectId, { bullets: [...(project.bullets || []), ''] });
    }
  };

  const updateBullet = (projectId: string, bulletIndex: number, value: string) => {
    const project = data.find(p => p.id === projectId);
    if (project && project.bullets) {
      const newBullets = [...project.bullets];
      newBullets[bulletIndex] = value;
      updateProject(projectId, { bullets: newBullets });
    }
  };

  const removeBullet = (projectId: string, bulletIndex: number) => {
    const project = data.find(p => p.id === projectId);
    if (project && project.bullets && project.bullets.length > 1) {
      const newBullets = project.bullets.filter((_, i) => i !== bulletIndex);
      updateProject(projectId, { bullets: newBullets });
    }
  };

  return (
    <div className="space-y-6">
      {data.map((project) => (
        <div 
          key={project.id}
          className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
        >
          <div 
            className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/5"
            onClick={() => setExpandedId(expandedId === project.id ? null : project.id)}
          >
            <div className="flex-1">
              <h3 className="text-white font-medium">
                {project.name || 'New Project'}
              </h3>
              <p className="text-sm text-white/40">
                {project.technologies?.slice(0, 3).join(', ') || 'Click to add details'}
              </p>
            </div>

            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-white/40 hover:text-[#9333EA]"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); removeProject(project.id); }}
              className="p-2 text-white/40 hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {expandedId === project.id ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
          </div>

          {expandedId === project.id && (
            <div className="px-5 pb-5 border-t border-white/10 pt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Project Name *</label>
                <input
                  type="text"
                  value={project.name}
                  onChange={(e) => updateProject(project.id, { name: e.target.value })}
                  placeholder="e.g., E-Commerce Dashboard"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Description</label>
                <textarea
                  value={project.description}
                  onChange={(e) => updateProject(project.id, { description: e.target.value })}
                  placeholder="Briefly describe what the project does..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Technologies</label>
                <input
                  type="text"
                  value={project.technologies?.join(', ') || ''}
                  onChange={(e) => handleTechnologiesChange(project.id, e.target.value)}
                  placeholder="e.g., React, Node.js, PostgreSQL"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Project URL</label>
                <input
                  type="url"
                  value={project.url || ''}
                  onChange={(e) => updateProject(project.id, { url: e.target.value })}
                  placeholder="github.com/username/project"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Key Features</label>
                {project.bullets?.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-2 mb-2">
                    <span className="text-[#9333EA] mt-3">•</span>
                    <textarea
                      value={bullet}
                      onChange={(e) => updateBullet(project.id, idx, e.target.value)}
                      placeholder="Describe a key feature..."
                      rows={2}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] resize-none text-sm"
                    />
                    {(project.bullets?.length || 0) > 1 && (
                      <button onClick={() => removeBullet(project.id, idx)} className="mt-2 p-1 text-white/30 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => addBullet(project.id)} className="text-sm text-[#9333EA] hover:text-[#A855F7] flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add Point
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addProject}
        className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl text-white/60 hover:text-white hover:border-[#9333EA] flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" /> Add Project
      </button>
    </div>
  );
}