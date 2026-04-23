"use client";

import { useTranslations } from "next-intl";

export default function VictorDebriefOffer({
  hadErrors,
  onAccept,
  onDismiss,
  dismissed,
}: {
  hadErrors: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  dismissed?: boolean;
}) {
  const t = useTranslations();
  if (dismissed) return null;

  return (
    <section className="space-y-3 rounded-xl border border-violet-300/30 bg-violet-500/10 p-3">
      <h4 className="text-sm font-medium text-violet-100">
        {hadErrors ? t("academic.mathMode.debrief.review") : t("academic.mathMode.debrief.goDeeper")}
      </h4>
      <p className="text-xs text-violet-100/85">
        {hadErrors
          ? t("academic.mathMode.debrief.reviewBody")
          : t("academic.mathMode.debrief.goDeeperBody")}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="rounded-full border border-violet-300/45 bg-violet-400/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-violet-50"
        >
          {t("academic.mathMode.openVictor")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-200"
        >
          {t("global.close")}
        </button>
      </div>
    </section>
  );
}
