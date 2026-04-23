"use client";

import { useTranslations } from "next-intl";
import { Play, Trash2, Code2 } from "lucide-react";
import SectionHeader from "../../shared/SectionHeader";
import shared from "../../shared/academic.module.css";
import { LANGUAGE_LABELS, type CodingLanguage } from "../hooks/useCodingReview";

type CodingReviewHeaderBarProps = {
  language: CodingLanguage;
  setLanguage: (language: CodingLanguage) => void;
  running: boolean;
  canRun: boolean;
  onRun: () => void;
  onClear: () => void;
  toast: string | null;
};

export default function CodingReviewHeaderBar({
  language,
  setLanguage,
  running,
  canRun,
  onRun,
  onClear,
  toast,
}: CodingReviewHeaderBarProps) {
  const t = useTranslations("academic.codeReviewMode.header");
  return (
    <>
      <div className={`${shared.surfacePanelCompact} !rounded-none border-x-0 border-t-0 flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
        <SectionHeader
          title={t("title")}
          description={t("description")}
          actions={
            <span className="inline-flex items-center gap-2 text-xs text-slate-300">
              <Code2 className="h-4 w-4 text-amber-200" />
              {t("studioEditor")}
            </span>
          }
          className="mb-0"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as CodingLanguage)}
            className={shared.control}
          >
            {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t("editorLanguage")}</span>
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun || running}
            className={`${shared.buttonBase} ${shared.buttonPrimary} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Play className="h-3.5 w-3.5" />
            {running ? t("running") : t("run")}
          </button>
          <button
            type="button"
            onClick={onClear}
            className={`${shared.buttonBase} ${shared.buttonSecondary} inline-flex items-center gap-2`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("clear")}
          </button>
        </div>
      </div>
      {toast && (
        <div className={`${shared.surfacePanelCompact} !rounded-none border-x-0 border-t-0 px-5 py-2 text-xs text-emerald-100`}>
          {toast}
        </div>
      )}
    </>
  );
}
