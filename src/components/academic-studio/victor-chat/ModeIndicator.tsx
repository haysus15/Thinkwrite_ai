// src/components/academic-studio/victor-chat/ModeIndicator.tsx
"use client";

import { BookOpen, Calculator, Compass, Flame, Shield } from "lucide-react";
import type { VictorMode } from "@/types/academic-studio";

const MODE_META: Record<
  VictorMode,
  { label: string; icon: typeof BookOpen; color: string }
> = {
  default: { label: "Default", icon: BookOpen, color: "text-slate-300" },
  idea_expansion: { label: "Idea Expansion", icon: Compass, color: "text-violet-200" },
  challenge: { label: "Challenge", icon: Flame, color: "text-red-200" },
  study: { label: "Study", icon: Shield, color: "text-emerald-200" },
  math: { label: "Math Mode", icon: Calculator, color: "text-sky-200" },
};

export default function ModeIndicator({ mode }: { mode: VictorMode }) {
  const meta = MODE_META[mode];
  const Icon = meta.icon;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
      <Icon className={`h-4 w-4 ${meta.color}`} />
      <span className="text-slate-200">{meta.label}</span>
    </div>
  );
}
