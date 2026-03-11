// src/components/mirror-mode/BlendConsentModal.tsx

"use client";

import React from "react";
import Link from "next/link";

interface BlendConsentModalProps {
  fromChambers: string[];
  toChamber: string;
  onApprove: () => void;
  onClose: () => void;
  testId?: string;
}

export default function BlendConsentModal({
  fromChambers,
  toChamber,
  onApprove,
  onClose,
  testId,
}: BlendConsentModalProps) {
  const fromLabel = fromChambers.join(", ");
  return (
    <div
      data-testid={testId}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full sm:max-w-xl mx-4 mb-6 sm:mb-0 rounded-2xl border border-white/15 bg-black/80 p-6 text-white shadow-2xl">
        <div className="text-sm uppercase tracking-[0.2em] text-white/40">
          Ursie — Consent Required
        </div>
        <h2 className="mt-2 text-xl font-semibold">Blending voices across chambers.</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          You asked to pull {fromLabel} into {toChamber}. That crosses chamber lines.
          I can do it, but I need your consent first.
        </p>
        <div className="mt-3 text-xs text-white/60">
          <Link href="/mirror-mode" className="underline underline-offset-4 text-white/80 hover:text-white">
            Open Mirror Mode
          </Link>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/20 transition-colors"
          >
            Not now
          </button>
          <button
            onClick={onApprove}
            className="rounded-lg bg-purple-500/20 border border-purple-300/40 px-4 py-2 text-sm font-medium text-purple-100 hover:bg-purple-500/30 transition-colors"
          >
            Approve Blend
          </button>
        </div>
      </div>
    </div>
  );
}
