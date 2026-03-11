// src/components/mirror-mode/ConsentPlaywrightHarness.tsx

"use client";

import React, { useState } from "react";
import BlendConsentModal from "@/components/mirror-mode/BlendConsentModal";

export default function ConsentPlaywrightHarness() {
  const [showBlendModal, setShowBlendModal] = useState(false);
  const [blendApproved, setBlendApproved] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-semibold">Consent UI Harness</h1>

      <div
        data-testid="consent-banner"
        className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80"
      >
        Cross-chamber blending needs explicit consent.
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          data-testid="open-blend-modal"
          onClick={() => setShowBlendModal(true)}
          className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors"
        >
          Review consent
        </button>
        {blendApproved && (
          <span data-testid="blend-approved" className="text-xs text-emerald-300">
            Blend consent recorded
          </span>
        )}
      </div>

      {showBlendModal ? (
        <BlendConsentModal
          testId="blend-consent-modal"
          fromChambers={["creative", "general"]}
          toChamber="career"
          onClose={() => setShowBlendModal(false)}
          onApprove={() => {
            setBlendApproved(true);
            setShowBlendModal(false);
          }}
        />
      ) : null}
    </div>
  );
}
