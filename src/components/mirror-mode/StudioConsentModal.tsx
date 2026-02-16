// src/components/mirror-mode/StudioConsentModal.tsx

"use client";

import React from "react";

interface StudioConsentModalProps {
  studioLabel: string;
  onAcknowledge: () => void;
}

export default function StudioConsentModal({
  studioLabel,
  onAcknowledge,
}: StudioConsentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl mx-4 mb-6 sm:mb-0 rounded-2xl border border-white/15 bg-black/80 p-6 text-white shadow-2xl">
        <div className="text-sm uppercase tracking-[0.2em] text-white/40">
          Mirror Mode Notice
        </div>
        <h2 className="mt-2 text-xl font-semibold">I am listening in {studioLabel}.</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Your writing in this studio will be captured and classified into your voice archive.
          That is how I learn you. I will not interrupt the session, but I will remember.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onAcknowledge}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
