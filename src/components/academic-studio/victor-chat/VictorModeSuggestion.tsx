"use client";

import type { VictorMode } from "@/types/academic-studio";

type VictorModeSuggestionProps = {
  suggestedMode: VictorMode;
  conversationId: string | null;
  setMode: (mode: VictorMode) => void;
  setSuggestedMode: (mode: VictorMode | null) => void;
  compact?: boolean;
};

export default function VictorModeSuggestion({
  suggestedMode,
  conversationId,
  setMode,
  setSuggestedMode,
  compact = false,
}: VictorModeSuggestionProps) {
  const handleSwitch = async () => {
    setMode(suggestedMode);
    setSuggestedMode(null);
    if (!conversationId) return;
    await fetch("/api/victor/mode-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        toMode: suggestedMode,
      }),
    });
  };

  return (
    <div
      className={
        compact
          ? "mx-4 mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          : "mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      }
    >
      <p>
        Victor suggests switching to <span className="font-semibold">{suggestedMode}</span> mode.
      </p>
      <div className={compact ? "mt-2 flex gap-2" : "mt-3 flex gap-2"}>
        <button
          type="button"
          onClick={() => void handleSwitch()}
          className={
            compact
              ? "rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-[11px] transition hover:bg-amber-500/30"
              : "rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-xs transition hover:bg-amber-500/30"
          }
        >
          Switch
        </button>
        <button
          type="button"
          onClick={() => setSuggestedMode(null)}
          className={
            compact
              ? "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] transition hover:bg-white/8"
              : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition hover:bg-white/8"
          }
        >
          Stay
        </button>
      </div>
    </div>
  );
}
