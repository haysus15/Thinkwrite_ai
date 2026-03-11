"use client";

import shared from "../shared/academic-studio.module.css";
import type { AgendaRightColumnProps } from "./hooks/useAcademicAgendaShell";

export default function AgendaRightColumn(props: AgendaRightColumnProps) {
  const {
    atRiskCount,
    plannedThisWeekCount,
    tasksDueTodayCount,
    travisChatMessages,
    pendingTravisAction,
    travisChatInput,
    setTravisChatInput,
    travisChatLoading,
    sendTravisMessage,
    confirmPendingTravisAction,
    rejectPendingTravisAction,
    nextBestAction,
  } = props;

  return (
    <aside className="space-y-4 lg:col-span-2">
      <div className={shared.surfacePanel}>
        <p className="text-base font-semibold text-slate-100">Travis</p>
        <p className="text-xs text-slate-400">Academic Planner</p>
        {pendingTravisAction && (
          <p className="mt-1 text-[11px] text-amber-200">
            ● Waiting for your confirmation
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-red-100">
            {atRiskCount} at risk
          </span>
          <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-sky-100">
            {plannedThisWeekCount} planned this week
          </span>
          <span className="rounded-full border border-teal-400/30 bg-teal-500/10 px-2 py-1 text-teal-100">
            {tasksDueTodayCount} tasks due today
          </span>
        </div>

        {nextBestAction && (
          <div className="mt-3 rounded-lg border border-teal-400/25 bg-teal-500/10 px-3 py-3 text-xs">
            <p className="text-[10px] uppercase tracking-[0.2em] text-teal-200">Right now</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{nextBestAction.label}</p>
            <p className="mt-1 text-slate-300">{nextBestAction.rationale}</p>
            <button
              type="button"
              onClick={() => {
                const prompt = nextBestAction.toolTrigger
                  ? `Plan ${nextBestAction.label.replace(/^Ask Travis to plan\s+/i, "")}`
                  : `${nextBestAction.label}. ${nextBestAction.rationale}`;
                void sendTravisMessage(prompt, {
                  assignmentId: nextBestAction.assignmentId || undefined,
                });
              }}
              className={`${shared.buttonBase} ${shared.buttonPrimary} mt-2 w-full`}
            >
              Let Travis help →
            </button>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void sendTravisMessage("Plan my week")}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            Plan my week
          </button>
          <button
            type="button"
            onClick={() => void sendTravisMessage("What is at risk right now?")}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            What&apos;s at risk
          </button>
          <button
            type="button"
            onClick={() => void sendTravisMessage("I'm behind, rebalance my workload")}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            I&apos;m behind — rebalance
          </button>
          <button
            type="button"
            onClick={() => void sendTravisMessage("Show my progress")}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            Show my progress
          </button>
        </div>

      </div>

      <div className={shared.surfacePanel}>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/25 p-2 text-xs">
          {travisChatMessages.length === 0 ? (
            <p className="text-slate-400">Ask Travis to plan, schedule, or check your workload.</p>
          ) : (
            travisChatMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded px-2 py-1 ${
                  message.role === "user" ? "bg-teal-500/15 text-teal-100" : "bg-white/5 text-slate-200"
                }`}
              >
                {message.text}
              </div>
            ))
          )}
        </div>

        {pendingTravisAction && (
          <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-100">
            <p>{pendingTravisAction.summary || "Here is what I put together. Apply this plan?"}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void confirmPendingTravisAction()}
                className={`${shared.buttonBase} ${shared.buttonPrimary}`}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={rejectPendingTravisAction}
                className={`${shared.buttonBase} ${shared.buttonSecondary}`}
              >
                Adjust
              </button>
            </div>
          </div>
        )}

        <div className="mt-3">
          <input
            value={travisChatInput}
            onChange={(event) => setTravisChatInput(event.target.value)}
            placeholder="Ask Travis to plan, schedule, or check your workload."
            className={`w-full ${shared.control}`}
            disabled={Boolean(pendingTravisAction)}
          />
          <button
            type="button"
            disabled={travisChatLoading || !travisChatInput.trim() || Boolean(pendingTravisAction)}
            onClick={() => {
              const prompt = travisChatInput.trim();
              setTravisChatInput("");
              void sendTravisMessage(prompt);
            }}
            className={`mt-2 w-full ${shared.buttonBase} ${shared.buttonPrimary}`}
          >
            {travisChatLoading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </aside>
  );
}
