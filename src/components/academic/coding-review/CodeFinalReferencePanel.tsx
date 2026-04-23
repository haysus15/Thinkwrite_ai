"use client";

import { useTranslations } from "next-intl";

type ChallengeSession = {
  id: string;
  set_order: number | null;
  victor_context: unknown;
};

function challengeDescription(victorContext: unknown) {
  if (!victorContext || typeof victorContext !== "object") return "";
  const row = victorContext as Record<string, unknown>;
  return String(row.challenge_description || "");
}

export default function CodeFinalReferencePanel({
  sessions,
}: {
  sessions: ChallengeSession[];
}) {
  const t = useTranslations("academic.codeReviewMode.finalReference");
  const getDescription = (victorContext: unknown) =>
    challengeDescription(victorContext) || t("untitledChallenge");
  return (
    <section className="space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h3 className="text-sm font-medium text-slate-100">{t("title")}</h3>
      {sessions.map((session) => (
        <div key={session.id} className="rounded-lg border border-white/10 bg-slate-950/30 p-2">
          <p className="text-xs text-slate-200">{t("challengeNumber", { number: session.set_order || "-" })}</p>
          <p className="mt-1 text-xs text-slate-400">{getDescription(session.victor_context)}</p>
        </div>
      ))}
    </section>
  );
}
