// src/components/academic/victor-sidebar/VictorSidebar.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Calculator,
  Compass,
  Flame,
  Shield,
  Code2,
  GraduationCap,
} from "lucide-react";
import type { VictorMode } from "@/types/academic";
import type { VictorContext } from "@/lib/academic/victor/victorTypes";
import type { CoachingProfile } from "@/lib/academic/victor/coachingProfiles";
import { useVictorChat } from "../victor-chat/VictorChatContext";
import VictorChatContainer from "../victor-chat/VictorChatContainer";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";

const modes: Array<{
  id: VictorMode;
  icon: typeof BookOpen;
}> = [
  {
    id: "default",
    icon: BookOpen,
  },
  {
    id: "idea_expansion",
    icon: Compass,
  },
  {
    id: "challenge",
    icon: Flame,
  },
  {
    id: "study",
    icon: Shield,
  },
  {
    id: "math",
    icon: Calculator,
  },
  {
    id: "coding_review",
    icon: Code2,
  },
  {
    id: "teaching",
    icon: GraduationCap,
  },
];

export default function VictorSidebar({
  workspaceContext,
  onWorkspaceSwitch,
}: {
  workspaceContext?: string;
  onWorkspaceSwitch?: (view: "math-mode" | "dashboard") => void;
}) {
  const t = useTranslations("academic.victorUi.sidebar");
  const {
    mode,
    setMode,
    conversationId,
    refreshSavedSessions,
    savedSessions,
    loadSession,
  } = useVictorChat();
  const [error, setError] = useState<string | null>(null);
  const [guardrails, setGuardrails] = useState<{
    sufficientData: boolean;
    warnings: string[];
    blendRequired?: boolean;
    blendDenied?: string[];
    primaryChamber?: string;
  } | null>(null);
  const [showBlendConsent, setShowBlendConsent] = useState(false);
  const [voiceSources, setVoiceSources] = useState<string[]>([]);
  const [paperVictorContext, setPaperVictorContext] = useState<
    Partial<VictorContext> | undefined
  >(undefined);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [defaultCoachingProfile, setDefaultCoachingProfile] =
    useState<CoachingProfile>("tutor");

  useEffect(() => {
    refreshSavedSessions();
  }, [refreshSavedSessions]);

  useEffect(() => {
    if (mode === "math") {
      onWorkspaceSwitch?.("math-mode");
    }
  }, [mode, onWorkspaceSwitch]);

  const fetchGuardrails = useCallback(async () => {
      try {
        const response = await fetch("/api/voice-profile/gatekeeper", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requesting_studio: "academic",
            context: workspaceContext || "victor_chat",
            requested_chambers: ["academic", "general", "overall"],
          }),
        });
        const data = await response.json();
        if (data?.warnings && data?.sufficient_data !== undefined) {
          setGuardrails({
            sufficientData: Boolean(data.sufficient_data),
            warnings: data.warnings || [],
            blendRequired: Boolean(data?.blend?.required),
            blendDenied: data?.blend?.denied || [],
            primaryChamber: data?.voice_profile?.primary_chamber || null,
          });
          const sources: string[] = [];
          const primaryLabel = data?.voice_profile?.primary_chamber;
          if (primaryLabel) sources.push(primaryLabel);
          if (data?.voice_profile?.general) sources.push("general");
          if (data?.voice_profile?.overall) sources.push("overall");
          setVoiceSources(sources);
        }
      } catch {
        setGuardrails(null);
        setVoiceSources([]);
      }
    }, [workspaceContext]);

  useEffect(() => {
    fetchGuardrails();
  }, [fetchGuardrails]);

  useEffect(() => {
    const match = workspaceContext?.match(/Assignment\s+([a-f0-9-]{8,})/i);
    const assignmentId = match?.[1];
    if (!workspaceContext?.toLowerCase().includes("paper") || !assignmentId) {
      setActiveAssignmentId(null);
      setDefaultCoachingProfile("tutor");
      setPaperVictorContext(undefined);
      return;
    }
    setActiveAssignmentId(assignmentId);

    let active = true;
    fetch(`/api/travis/assignment/${assignmentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const assignment = data?.assignment;
        if (!assignment) {
          setPaperVictorContext(undefined);
          return;
        }
        setPaperVictorContext({
          assignmentName: assignment.assignment_name || "",
          className: assignment.class_name || "",
          paperType: assignment.assignment_type || null,
          assignmentRequirements:
            assignment.requirements && typeof assignment.requirements === "object"
              ? assignment.requirements
              : null,
          sectionTitle: t("currentPaperSection"),
          sectionBody: null,
        });
        const nextProfile =
          assignment.victor_coaching_profile === "critic" ||
          assignment.victor_coaching_profile === "exam_prep" ||
          assignment.victor_coaching_profile === "fast_review"
            ? assignment.victor_coaching_profile
            : "tutor";
        setDefaultCoachingProfile(nextProfile);
      })
      .catch(() => {
        if (!active) return;
        setDefaultCoachingProfile("tutor");
        setPaperVictorContext(undefined);
      });

    return () => {
      active = false;
    };
  }, [workspaceContext]);

  const handleApproveBlend = async () => {
    if (!guardrails?.blendDenied?.length || !guardrails.primaryChamber) return;
    try {
      await Promise.all(
        guardrails.blendDenied.map((from) =>
          fetch("/api/mirror-mode/consent/blending", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              from_chamber: from,
              to_chamber: guardrails.primaryChamber,
              scope: "session",
              expires_in_days: 1,
            }),
          })
        )
      );
      setGuardrails((prev) =>
        prev
          ? {
              ...prev,
              blendRequired: false,
              blendDenied: [],
            }
          : prev
      );
      fetchGuardrails();
    } catch {
      // Silent fail
    }
  };

  const handleModeSwitch = async (nextMode: VictorMode) => {
    setMode(nextMode);
    setError(null);

    if (!conversationId) return;
    try {
      await fetch("/api/victor/mode-switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, toMode: nextMode }),
      });
    } catch (err) {
      setError(t("errors.modeSwitch"));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Victor header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-sky-400/30 bg-gradient-to-br from-sky-500/40 to-blue-700/40 shadow-[0_0_15px_rgba(14,165,233,0.3)]" />
          <div>
            <p className="text-sm font-semibold text-slate-100">{t("title")}</p>
            <p className="text-xs text-slate-400">{t("subtitle")}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">{t("voiceSources")}</span>
          {(voiceSources.length > 0 ? voiceSources : [t("standard")]).map((source) => (
            <span
              key={source}
              className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-300"
            >
              {source}
            </span>
          ))}
        </div>
        {guardrails && guardrails.blendRequired && (
          <div className="mt-2 rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-2 text-[11px] text-purple-100">
            {t("blend.title")}
            <div className="mt-1 text-[10px] text-purple-100/80">
              {t("blend.body")}
            </div>
            <a
              href="/mirror-mode"
              className="mt-2 inline-flex text-[10px] uppercase tracking-[0.2em] text-purple-100/80 underline underline-offset-4"
            >
              {t("blend.openMirrorMode")}
            </a>
            <button
              type="button"
              onClick={() => setShowBlendConsent(true)}
              className="mt-2 w-full rounded-md border border-purple-300/40 bg-purple-500/20 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-purple-100 hover:bg-purple-500/30"
            >
              {t("blend.reviewConsent")}
            </button>
          </div>
        )}
        {workspaceContext && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {t("active")}
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
          {t("modes")}
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
              {t("guidance")}
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
                        {t(`modeLabels.${modeOption.id}`)}
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
              {t("studyHub")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {modes
                .filter((modeOption) =>
                  ["study", "math", "coding_review", "teaching"].includes(modeOption.id)
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
                        {t(`modeLabels.${modeOption.id}`)}
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
        {error && <AcademicErrorState message={error} className="mt-2 !min-h-0 py-2" />}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {mode === "math" ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-300">
            {t("mathActive")}
          </div>
        ) : mode === "coding_review" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-100">
              {t("codingReviewActive")}
            </div>
            <div className="min-h-0 flex-1">
              <VictorChatContainer
                workspaceContext={workspaceContext}
                showStudyPanel={false}
                variant="sidebar"
                victorContext={paperVictorContext}
                assignmentId={activeAssignmentId}
                defaultCoachingProfile={defaultCoachingProfile}
                showProfileSelector={
                  workspaceContext?.toLowerCase().includes("paper")
                }
              />
            </div>
          </div>
        ) : (
          <VictorChatContainer
            workspaceContext={workspaceContext}
            showStudyPanel={false}
            variant="sidebar"
            victorContext={paperVictorContext}
            assignmentId={activeAssignmentId}
            defaultCoachingProfile={defaultCoachingProfile}
            showProfileSelector={
              workspaceContext?.toLowerCase().includes("paper") || mode === "study"
            }
          />
        )}
      </div>

      {/* Voice features connect when Mirror Mode standalone is integrated */}

      {/* Saved sessions */}
      <div className="mt-4 border-t border-white/8 pt-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          {t("savedSessions")}
        </p>
        <div className="mt-3 max-h-32 space-y-2 overflow-y-auto text-xs text-slate-300">
          {savedSessions.length === 0 && (
            <AcademicEmptyState
              title={t("emptySavedTitle")}
              description={t("emptySavedDescription")}
              className="!min-h-0 py-2"
            />
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
                {t("savedMode", { mode: t(`modeLabels.${session.mode}`) })}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
