"use client";

import { useTranslations } from "next-intl";

export default function PaperSetVictorDebriefOffer({
  revisedPapers,
  papersTotal,
  onOpen,
}: {
  revisedPapers: number;
  papersTotal: number;
  onOpen: () => void;
}) {
  const t = useTranslations("academic.paperWorkflow.debrief");
  const revisedVariant = revisedPapers > 0;
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <p className="text-sm font-medium text-slate-100">
        {revisedVariant ? t("reviewTitle") : t("deeperTitle")}
      </p>
      <p className="mt-1 text-xs text-slate-300">
        {revisedVariant
          ? t("reviewBody", { total: papersTotal })
          : t("deeperBody")}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
      >
        {t("open")}
      </button>
    </section>
  );
}
