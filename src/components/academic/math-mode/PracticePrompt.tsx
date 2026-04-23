"use client";

import { useTranslations } from "next-intl";

export default function PracticePrompt({
  visible,
  conceptLabel,
  onGenerate,
  onDismiss,
  isLoading = false,
  isDismissed = false,
}: {
  visible: boolean;
  conceptLabel: string;
  onGenerate: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
  isDismissed?: boolean;
}) {
  const t = useTranslations();
  if (!visible || isDismissed) return null;

  return (
    <section className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-3">
      <h4 className="text-sm font-medium text-amber-100">
        {t("academic.mathMode.practice.title")}
      </h4>
      <p className="text-xs text-amber-100/90">
        {t("academic.mathMode.practice.body", { concept: conceptLabel })}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={onGenerate}
          className="rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? t("academic.mathMode.practice.generating") : t("academic.mathMode.practice.generate")}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={onDismiss}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("academic.mathMode.practice.dismiss")}
        </button>
      </div>
    </section>
  );
}
