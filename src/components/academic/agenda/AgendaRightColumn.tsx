"use client";

import { useTranslations } from "next-intl";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import shared from "../shared/academic.module.css";
import type { AgendaRightColumnProps } from "./hooks/useAcademicAgendaShell";

export default function AgendaRightColumn(props: AgendaRightColumnProps) {
  const t = useTranslations("academic.agendaUi.right");
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
        <p className="text-base font-semibold text-slate-100">{t("title")}</p>
        <p className="text-xs text-slate-400">{t("subtitle")}</p>
        {pendingTravisAction && (
          <p className="mt-1 text-[11px] text-amber-200">
            {t("waiting")}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-red-100">
            {t("atRisk", { count: atRiskCount })}
          </span>
          <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-sky-100">
            {t("plannedThisWeek", { count: plannedThisWeekCount })}
          </span>
          <span className="rounded-full border border-teal-400/30 bg-teal-500/10 px-2 py-1 text-teal-100">
            {t("tasksDueToday", { count: tasksDueTodayCount })}
          </span>
        </div>

        {nextBestAction && (
          <div className="mt-3 rounded-lg border border-teal-400/25 bg-teal-500/10 px-3 py-3 text-xs">
            <p className="text-[10px] uppercase tracking-[0.2em] text-teal-200">{t("rightNow")}</p>
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
              {t("letTravisHelp")}
            </button>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void sendTravisMessage(t("prompts.planMyWeek"))}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            {t("planMyWeek")}
          </button>
          <button
            type="button"
            onClick={() => void sendTravisMessage(t("prompts.whatsAtRisk"))}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            {t("whatsAtRisk")}
          </button>
          <button
            type="button"
            onClick={() => void sendTravisMessage(t("prompts.rebalance"))}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            {t("rebalance")}
          </button>
          <button
            type="button"
            onClick={() => void sendTravisMessage(t("prompts.showProgress"))}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            {t("showMyProgress")}
          </button>
        </div>

      </div>

      <div className={shared.surfacePanel}>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/25 p-2 text-xs">
          {travisChatMessages.length === 0 ? (
            <AcademicEmptyState
              title={t("empty")}
              description={t("subtitle")}
              className="!min-h-0 border-0 bg-transparent py-3"
            />
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
            <p>{pendingTravisAction.summary || t("pendingSummary")}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void confirmPendingTravisAction()}
                className={`${shared.buttonBase} ${shared.buttonPrimary}`}
              >
                {t("confirm")}
              </button>
              <button
                type="button"
                onClick={rejectPendingTravisAction}
                className={`${shared.buttonBase} ${shared.buttonSecondary}`}
              >
                {t("adjust")}
              </button>
            </div>
          </div>
        )}

        <div className="mt-3">
          <input
            value={travisChatInput}
            onChange={(event) => setTravisChatInput(event.target.value)}
            placeholder={t("placeholder")}
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
            {travisChatLoading ? t("sending") : t("send")}
          </button>
        </div>
      </div>
    </aside>
  );
}
