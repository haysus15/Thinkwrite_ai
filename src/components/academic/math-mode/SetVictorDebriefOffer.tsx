"use client";

import { useTranslations } from "next-intl";

export default function SetVictorDebriefOffer({
  hasRevisions,
  totalProblems,
  onOpen,
}: {
  hasRevisions: boolean;
  totalProblems: number;
  onOpen: () => void;
}) {
  const t = useTranslations();
  return (
    <section className="space-y-2 rounded-xl border border-violet-300/30 bg-violet-500/10 p-3">
      <h4 className="text-sm font-medium text-violet-100">
        {hasRevisions
          ? t("academic.mathMode.setDebrief.reviewFull")
          : t("academic.mathMode.setDebrief.goDeeper")}
      </h4>
      <p className="text-xs text-violet-100/85">
        {hasRevisions
          ? t("academic.mathMode.setDebrief.reviewBody", { count: totalProblems })
          : t("academic.mathMode.setDebrief.cleanBody")}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-full border border-violet-300/40 bg-violet-400/15 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-violet-50"
      >
        {t("academic.mathMode.openVictor")}
      </button>
    </section>
  );
}
