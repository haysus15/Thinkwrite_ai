// Contact Section Component
// src/components/career-studio/resume-builder/sections/ContactSection.tsx

"use client";

import React from 'react';
import { Mail, Phone, MapPin, Linkedin, Globe } from 'lucide-react';
import type { ContactInfo } from '@/types/resume-builder';

interface ContactSectionProps {
  data: ContactInfo;
  onChange: (data: ContactInfo) => void;
}

export default function ContactSection({ data, onChange }: ContactSectionProps) {
  const safeData: ContactInfo = {
    name: data?.name ?? "",
    email: data?.email ?? "",
    phone: data?.phone ?? "",
    location: data?.location ?? "",
    linkedin: data?.linkedin ?? "",
    website: data?.website ?? "",
  };

  const updateField = (field: keyof ContactInfo, value: string) => {
    onChange({ ...safeData, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Name - Full Width */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">
          Full Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={safeData.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="John Doe"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg placeholder-white/30 focus:outline-none focus:border-[#9333EA] transition-colors"
        />
      </div>

      {/* Email & Phone */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#9333EA]" />
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={safeData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="john.doe@email.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#9333EA]" />
            Phone
          </label>
          <input
            type="tel"
            value={safeData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="(555) 123-4567"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] transition-colors"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#9333EA]" />
          Location
        </label>
        <input
          type="text"
          value={safeData.location}
          onChange={(e) => updateField('location', e.target.value)}
          placeholder="City, State or Remote"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] transition-colors"
        />
        <p className="mt-1 text-xs text-white/40">
          Tip: Use "City, State" format or "Remote" if you're open to remote work
        </p>
      </div>

      {/* LinkedIn & Website */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-[#9333EA]" />
            LinkedIn Profile
          </label>
          <input
            type="url"
            value={safeData.linkedin}
            onChange={(e) => updateField('linkedin', e.target.value)}
            placeholder="linkedin.com/in/johndoe"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#9333EA]" />
            Website / Portfolio
          </label>
          <input
            type="url"
            value={safeData.website}
            onChange={(e) => updateField('website', e.target.value)}
            placeholder="yourwebsite.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#9333EA] transition-colors"
          />
        </div>
      </div>

      {/* Tips */}
      <div className="bg-[#9333EA]/10 border border-[#9333EA]/30 rounded-xl p-4">
        <h4 className="text-[#9333EA] font-medium mb-2"> Quick Tips</h4>
        <ul className="text-sm text-white/70 space-y-1">
          <li>• Use a professional email address (avoid nicknames)</li>
          <li>• LinkedIn is highly recommended for professional roles</li>
          <li>• Include portfolio links if you're in a creative or technical field</li>
        </ul>
      </div>
    </div>
  );
}
