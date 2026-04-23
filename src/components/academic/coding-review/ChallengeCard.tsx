"use client";

import { useTranslations } from "next-intl";

type ChallengeSession = {
  id: string;
  set_order: number | null;
  language: string;
  code_snapshot: string | null;
  is_complete: boolean;
  victor_context: unknown;
};

function challengeDescription(victorContext: unknown) {
  if (!victorContext || typeof victorContext !== "object") return "";
  const row = victorContext as Record<string, unknown>;
  return String(row.challenge_description || "");
}

function challengeType(victorContext: unknown) {
  if (!victorContext || typeof victorContext !== "object") return "other";
  const row = victorContext as Record<string, unknown>;
  return String(row.challenge_type || "other");
}

export default function ChallengeCard({
  session,
  onOpen,
}: {
  session: ChallengeSession;
  onOpen: (session: ChallengeSession) => void;
}) {
  const t = useTranslations("academic.codeReviewMode.card");
  const description =
    challengeDescription(session.victor_context) || t("untitledChallenge");
  const type = challengeType(session.victor_context);
  const hasCode = String(session.code_snapshot || "").trim().length > 0;
  const status = session.is_complete ? "complete" : hasCode ? "inProgress" : "notStarted";

  const statusClasses =
    status === "complete"
      ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100"
      : status === "inProgress"
      ? "border-amber-300/35 bg-amber-500/15 text-amber-100"
      : "border-white/20 bg-white/5 text-slate-300";

  return (
    <button
      type="button"
      onClick={() => onOpen(session)}
      className="w-full rounded-xl border border-white/10 bg-slate-900/30 p-3 text-left hover:border-sky-300/35"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-100">{t("challengeNumber", { number: session.set_order || "-" })}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClasses}`}>
          {t(`statuses.${status}`)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-slate-300">{description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">{type}</span>
        <span>{session.language || t("languageNotSet")}</span>
      </div>
    </button>
  );
}
