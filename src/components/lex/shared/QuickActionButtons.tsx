// src/components/lex/shared/QuickActionButtons.tsx
"use client";

import React from "react";
import { QuickAction } from "../types/lex.types";

interface QuickActionButtonsProps {
  actions: QuickAction[];
  onActionClick: (actionText: string) => void;
  variant?: "general" | "assessment" | "cover-letter" | "resume" | "match";
}

export default function QuickActionButtons({
  actions,
  onActionClick,
  variant = "general",
}: QuickActionButtonsProps) {
  const variantClasses = {
    general: "bg-white/10 border border-white/20 text-white hover:bg-white/20",
    assessment:
      "bg-blue-500/15 border border-blue-400/30 text-blue-100 hover:bg-blue-500/25",
    "cover-letter":
      "bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25",
    resume:
      "bg-purple-500/15 border border-purple-400/30 text-purple-100 hover:bg-purple-500/25",
    match:
      "bg-pink-500/15 border border-pink-400/30 text-pink-100 hover:bg-pink-500/25",
  };

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={() => onActionClick(action.action)}
          className={`px-3 py-2 rounded-xl text-xs transition-all ${variantClasses[variant]}`}
        >
          {action.text}
        </button>
      ))}
    </div>
  );
}