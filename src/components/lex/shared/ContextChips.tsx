// src/components/lex/shared/ContextChips.tsx
"use client";

import React from "react";

interface ContextChipProps {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  tone?: "primary" | "accent" | "danger" | "neutral";
}

export default function ContextChip({
  icon,
  label,
  value,
  tone = "neutral",
}: ContextChipProps) {
  const toneClasses =
    tone === "primary"
      ? "border-[#EAAA00]/60 bg-[#EAAA00]/10 text-[#FDE68A]"
      : tone === "accent"
      ? "border-purple-400/50 bg-purple-500/10 text-purple-100"
      : tone === "danger"
      ? "border-pink-400/60 bg-pink-500/10 text-pink-100"
      : "border-white/15 bg-white/5 text-white/70";

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] ${toneClasses}`}
    >
      {icon && <span className="text-xs">{icon}</span>}
      <span className="uppercase tracking-[0.16em] text-[9px] opacity-70">
        {label}
      </span>
      {value && (
        <span className="font-medium truncate max-w-[180px] sm:max-w-[240px]">
          {value}
        </span>
      )}
    </div>
  );
}