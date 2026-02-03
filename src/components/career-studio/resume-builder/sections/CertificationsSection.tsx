// Certifications Section Component
// src/components/career-studio/resume-builder/sections/CertificationsSection.tsx

"use client";

import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Award } from 'lucide-react';
import type { CertificationEntry } from '@/types/resume-builder';
import { generateId } from '@/types/resume-builder';

interface CertificationsSectionProps {
  data: CertificationEntry[];
  onChange: (data: CertificationEntry[]) => void;
}

export default function CertificationsSection({ data, onChange }: CertificationsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(data[0]?.id || null);

  const addCertification = () => {
    const newEntry: CertificationEntry = {
      id: generateId(),
      name: '',
      issuer: '',
      date: '',
      expirationDate: '',
      credentialId: ''
    };
    onChange([...data, newEntry]);
    setExpandedId(newEntry.id);
  };

  const updateCertification = (id: string, updates: Partial<CertificationEntry>) => {
    onChange(data.map(cert => 
      cert.id === id ? { ...cert, ...updates } : cert
    ));
  };

  const removeCertification = (id: string) => {
    onChange(data.filter(cert => cert.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Certifications List */}
      {data.map((cert) => (
        <div 
          key={cert.id}
          className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
        >
          {/* Header */}
          <div 
            className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/5"
            onClick={() => setExpandedId(expandedId === cert.id ? null : cert.id)}
          >
            <Award className="w-5 h-5 text-[#9333EA]" />
            <div className="flex-1">
              <h3 className="text-white font-medium">
                {cert.name || 'New Certification'}
              </h3>
              <p className="text-sm text-white/40">
                {cert.issuer || 'Click to add details'}
                {cert.date && ` • ${cert.date}`}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeCertification(cert.id);
              }}
              className="p-2 text-white/40 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {expandedId === cert.id ? (
              <ChevronUp className="w-5 h-5 text-white/40" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/40" />
            )}
          </div>

          {/* Expanded Content */}
          {expandedId === cert.id && (
            <div className="px-5 pb-5 border-t border-white/10 pt-5 space-y-4">
              {/* Certification Name */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Certification Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={cert.name}
                  onChange={(e) => updateCertification(cert.id, { name: e.target.value })}
                  placeholder="e.g., AWS Solutions Architect, PMP, Google Analytics"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
              </div>

              {/* Issuing Organization */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Issuing Organization <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={cert.issuer}
                  onChange={(e) => updateCertification(cert.id, { issuer: e.target.value })}
                  placeholder="e.g., Amazon Web Services, PMI, Google"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
              </div>

              {/* Dates */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Issue Date
                  </label>
                  <input
                    type="text"
                    value={cert.date || ''}
                    onChange={(e) => updateCertification(cert.id, { date: e.target.value })}
                    placeholder="e.g., Jan 2023"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Expiration Date (if applicable)
                  </label>
                  <input
                    type="text"
                    value={cert.expirationDate || ''}
                    onChange={(e) => updateCertification(cert.id, { expirationDate: e.target.value })}
                    placeholder="e.g., Jan 2026 or No Expiration"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                  />
                </div>
              </div>

              {/* Credential ID */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Credential ID (optional)
                </label>
                <input
                  type="text"
                  value={cert.credentialId || ''}
                  onChange={(e) => updateCertification(cert.id, { credentialId: e.target.value })}
                  placeholder="e.g., ABC123XYZ"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA]"
                />
                <p className="mt-1 text-xs text-white/40">
                  Include if it helps verify the certification
                </p>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add Certification Button */}
      <button
        onClick={addCertification}
        className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl text-white/60 hover:text-white hover:border-[#9333EA] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Certification
      </button>

      {/* Tips */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h4 className="text-white font-medium mb-2"> Certification Tips</h4>
        <ul className="text-sm text-white/60 space-y-1">
          <li>• Include industry-recognized certifications relevant to your target role</li>
          <li>• List currently valid certifications first</li>
          <li>• Include bootcamp certificates if they're from reputable programs</li>
          <li>• Online course certificates (Coursera, LinkedIn Learning) can be valuable for junior roles</li>
        </ul>
      </div>

      {/* Empty State */}
      {data.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <Award className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/60 mb-2">No certifications yet</p>
          <p className="text-white/40 text-sm">
            Add professional certifications, licenses, or credentials that validate your expertise.
          </p>
        </div>
      )}
    </div>
  );
}