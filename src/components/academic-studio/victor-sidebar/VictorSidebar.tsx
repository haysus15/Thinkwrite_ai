// src/components/academic-studio/victor-sidebar/VictorSidebar.tsx
"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Calculator,
  Compass,
  Flame,
  Shield,
} from "lucide-react";
import type { VictorMode } from "@/types/academic-studio";
import { useVictorChat } from "../victor-chat/VictorChatContext";
import VictorChatContainer from "../victor-chat/VictorChatContainer";

const modes: Array<{
  id: VictorMode;
  label: string;
  icon: typeof BookOpen;
}> = [
  {
    id: "default",
    label: "Default",
    icon: BookOpen,
  },
  {
    id: "idea_expansion",
    label: "Idea Expansion",
    icon: Compass,
  },
  {
    id: "challenge",
    label: "Challenge",
    icon: Flame,
  },
  {
    id: "study",
    label: "Study",
    icon: Shield,
  },
  {
    id: "math",
    label: "Math Mode",
    icon: Calculator,
  },
];

export default function VictorSidebar({
  workspaceContext,
  onWorkspaceSwitch,
}: {
  workspaceContext?: string;
  onWorkspaceSwitch?: (view: "math-mode" | "dashboard") => void;
}) {
  const {
    mode,
    setMode,
    conversationId,
    refreshSavedSessions,
    savedSessions,
    loadSession,
  } = useVictorChat();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshSavedSessions();
  }, [refreshSavedSessions]);

  useEffect(() => {
    if (mode === "math") {
      onWorkspaceSwitch?.("math-mode");
    }
  }, [mode, onWorkspaceSwitch]);

  const handleModeSwitch = async (nextMode: VictorMode) => {
    setMode(nextMode);
    setError(null);

    if (!conversationId) return;
    try {
      await fetch("/api/victor/mode-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, toMode: nextMode }),
      });
    } catch (err) {
      setError("Mode switch failed.");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Victor header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-sky-400/30 bg-gradient-to-br from-sky-500/40 to-blue-700/40 shadow-[0_0_15px_rgba(14,165,233,0.3)]" />
          <div>
            <p className="text-sm font-semibold text-slate-100">Victor</p>
            <p className="text-xs text-slate-400">Socratic rigor</p>
          </div>
        </div>
        {workspaceContext && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Active
            </span>
            <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">
              {workspaceContext}
            </span>
          </div>
        )}
      </div>

      {/* Mode selection */}
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          Modes
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
              Guidance
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {modes
                .filter((modeOption) =>
                  ["default", "idea_expansion", "challenge"].includes(
                    modeOption.id
                  )
                )
                .map((modeOption, index, list) => {
                  const isActive = mode === modeOption.id;
                  return (
                    <div key={modeOption.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleModeSwitch(modeOption.id)}
                        className={`transition ${
                          isActive ? "text-sky-200" : "text-slate-300"
                        }`}
                      >
                        {modeOption.label}
                      </button>
                      {index < list.length - 1 && (
                        <span className="text-slate-600">|</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
              Study
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {modes
                .filter((modeOption) => ["study", "math"].includes(modeOption.id))
                .map((modeOption, index, list) => {
                  const isActive = mode === modeOption.id;
                  return (
                    <div key={modeOption.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleModeSwitch(modeOption.id)}
                        className={`transition ${
                          isActive ? "text-sky-200" : "text-slate-300"
                        }`}
                      >
                        {modeOption.label}
                      </button>
                      {index < list.length - 1 && (
                        <span className="text-slate-600">|</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {mode === "math" ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-300">
            Math mode active in the workspace. Use the center panel for step-by-step verification.
          </div>
        ) : (
          <VictorChatContainer
            workspaceContext={workspaceContext}
            showStudyPanel={false}
            variant="sidebar"
          />
        )}
      </div>

      {/* Saved sessions */}
      <div className="mt-4 border-t border-white/8 pt-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          Saved sessions
        </p>
        <div className="mt-3 max-h-32 space-y-2 overflow-y-auto text-xs text-slate-300">
          {savedSessions.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-400">
              No saved sessions yet.
            </div>
          )}
          {savedSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => loadSession(session.id)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.06]"
            >
              <p className="text-xs font-semibold text-slate-100">
                {session.title}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {session.mode} mode
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
