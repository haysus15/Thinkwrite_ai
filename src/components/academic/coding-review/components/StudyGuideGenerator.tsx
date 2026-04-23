"use client";

import { useTranslations } from "next-intl";

type StudyGuideGeneratorProps = {
  creatingStudyGuide: boolean;
  onGenerate: () => void;
  onOpenLibrary: () => void;
};

export default function StudyGuideGenerator({
  creatingStudyGuide,
  onGenerate,
  onOpenLibrary,
}: StudyGuideGeneratorProps) {
  const t = useTranslations("academic.codeReviewMode.studyGuide");
  return (
    <>
      <button
        type="button"
        onClick={onGenerate}
        disabled={creatingStudyGuide}
        className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
      >
        {creatingStudyGuide ? t("creating") : t("generate")}
      </button>
      <button
        type="button"
        onClick={onOpenLibrary}
        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
      >
        {t("openStudyHub")}
      </button>
    </>
  );
}
