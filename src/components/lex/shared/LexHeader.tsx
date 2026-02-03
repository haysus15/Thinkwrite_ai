// src/components/lex/shared/LexHeader.tsx
"use client";

import React from "react";

interface LexHeaderProps {
  title: string;
  subtitle: string;
  messageCount: number;
  onSave?: () => void;
  onLoad?: () => void;
  onNew?: () => void;
  onClear?: () => void;
  showControls?: boolean;
}

export default function LexHeader({
  title,
  subtitle,
  messageCount,
  onSave,
  onLoad,
  onNew,
  onClear,
  showControls = true,
}: LexHeaderProps) {
  return (
    <div className="border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="px-6 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#EAAA00] to-amber-500 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.7)]">
              <span className="text-black font-bold text-xl">L</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-[2px] border-black" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-lg sm:text-xl font-light tracking-tight">
              Chat with <span className="font-normal text-white">Lex</span>
            </h1>
            <p className="text-[11px] text-white/50">{subtitle}</p>
          </div>
        </div>

        {showControls && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EAAA00]" />
              <span>{messageCount} messages</span>
            </div>

            {onLoad && (
              <button
                onClick={onLoad}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-[11px] text-white hover:bg-white/10 transition-colors"
              >
                <span className="hidden sm:inline">Load</span>
                <span className="sm:hidden">📂</span>
              </button>
            )}

            {onSave && (
              <button
                onClick={onSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAAA00] text-[11px] text-black font-medium hover:bg-[#d89b00] transition-colors shadow-lg"
              >
                <span>Save</span>
              </button>
            )}

            {onNew && (
              <button
                onClick={onNew}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-[11px] text-white hover:bg-white/10 transition-colors"
                title="Start fresh conversation"
              >
                <span className="hidden sm:inline">New</span>
                <span className="sm:hidden">+</span>
              </button>
            )}

            {onClear && messageCount > 1 && (
              <button
                onClick={onClear}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5 text-[11px] text-red-300 hover:bg-red-500/15 transition-colors"
                title="Clear conversation"
              >
                <span>Clear</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}