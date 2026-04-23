"use client";

import { useTranslations } from "next-intl";
import {
  parseQuizQA,
  stripMarkdownDecorators,
  type MaterialDetail,
  type ParsedSection,
} from "../hooks/useStudyLibrary";

function renderStudyLine(line: string, key: string) {
  const clean = stripMarkdownDecorators(line);
  if (!clean) return null;

  if (/^\d+\.\s+/.test(clean)) {
    return (
      <p key={key} className="text-sm leading-6 text-slate-200">
        <span className="mr-2 text-sky-300">{clean.match(/^\d+\./)?.[0]}</span>
        {clean.replace(/^\d+\.\s+/, "")}
      </p>
    );
  }

  if (/^[-*]\s+/.test(clean)) {
    return (
      <p key={key} className="text-sm leading-6 text-slate-200">
        <span className="mr-2 text-sky-300">•</span>
        {clean.replace(/^[-*]\s+/, "")}
      </p>
    );
  }

  return (
    <p key={key} className="text-sm leading-6 text-slate-200">
      {clean}
    </p>
  );
}

type MaterialViewerProps = {
  viewerLoading: boolean;
  selectedMaterial: MaterialDetail | null;
  selectedSections: ParsedSection[];
  printingGuide: boolean;
  exportingGuidePdf: boolean;
  onClose: () => void;
  onPrintGuide: () => void;
  onExportGuidePdf: () => void;
};

export default function MaterialViewer({
  viewerLoading,
  selectedMaterial,
  selectedSections,
  printingGuide,
  exportingGuidePdf,
  onClose,
  onPrintGuide,
  onExportGuidePdf,
}: MaterialViewerProps) {
  const t = useTranslations("academic.studyMaterials");
  return (
    <>
      {viewerLoading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0B1220] p-6 text-sm text-slate-200">
            {t("loadingMaterial")}
          </div>
        </div>
      )}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-[#0B1220] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-100">{selectedMaterial.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedMaterial.class_name || t("noClass")} · {selectedMaterial.topic || t("noTopic")} · {" "}
                  {selectedMaterial.source_type || t("uploaded")}
                </p>
              </div>
              <button
                type="button"
                onClick={onPrintGuide}
                disabled={printingGuide || exportingGuidePdf}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 disabled:opacity-60"
              >
                {printingGuide ? t("printing") : t("printStudyGuide")}
              </button>
              <button
                type="button"
                onClick={onExportGuidePdf}
                disabled={printingGuide || exportingGuidePdf}
                className="rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1 text-xs text-sky-200 disabled:opacity-60"
              >
                {exportingGuidePdf ? t("exporting") : t("exportPdf")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
              >
                {t("close")}
              </button>
            </div>
            <div className="mt-4 max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              {selectedSections.length === 0 ? (
                <p className="text-sm text-slate-400">{t("noContent")}</p>
              ) : (
                <div className="space-y-4">
                  {selectedSections.map((section, index) => {
                    const isQuizSection = /quick self-check quiz/i.test(section.title);
                    const qa = isQuizSection ? parseQuizQA(section.lines) : [];
                    return (
                      <section
                        key={`${section.title}-${index}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <h3 className="text-sm font-semibold text-sky-200">{section.title}</h3>
                        {isQuizSection && qa.length > 0 ? (
                          <div className="mt-3 grid gap-3">
                            {qa.map((item, qaIndex) => (
                              <div
                                key={`${item.q}-${qaIndex}`}
                                className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
                              >
                                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                                  {t("questionNumber", { count: qaIndex + 1 })}
                                </p>
                                <p className="mt-1 text-sm text-slate-100">{item.q}</p>
                                <p className="mt-2 text-sm text-emerald-200">{t("answerLabel", { answer: item.a })}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {section.lines.map((line, lineIndex) =>
                              renderStudyLine(line, `${section.title}-${lineIndex}`)
                            )}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
