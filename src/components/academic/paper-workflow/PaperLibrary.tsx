// src/components/academic/paper-workflow/PaperLibrary.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileText } from "lucide-react";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";

type PaperStatus = "locked" | "passed" | "skipped";

interface PaperRow {
  id: string;
  assignment_id: string | null;
  topic: string;
  created_at: string;
  word_count: number | null;
  citation_style: string | null;
  checkpoint_passed: boolean;
  emergency_skip_used: boolean;
}

interface PaperItem {
  id: string;
  assignmentId: string | null;
  title: string;
  createdAt: string;
  wordCount: number | null;
  citationStyle: string | null;
  status: PaperStatus;
}

export default function PaperLibrary({
  onPaperExport,
}: {
  onPaperExport?: (assignmentId: string | null) => void;
}) {
  const t = useTranslations("academic.paperWorkflow.library");
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const loadLibrary = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/academic/papers/user");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.load"));
      }

      const mapped = (data.papers as PaperRow[]).map((paper) => {
        let status: PaperStatus = "locked";
        if (paper.checkpoint_passed) {
          status = "passed";
        } else if (paper.emergency_skip_used) {
          status = "skipped";
        }

        return {
          id: paper.id,
          assignmentId: paper.assignment_id || null,
          title: paper.topic,
          createdAt: paper.created_at,
          wordCount: paper.word_count ?? null,
          citationStyle: paper.citation_style ?? null,
          status,
        };
      });

      setPapers(mapped);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("errors.load")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLibrary();
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-slate-200" />
        <p className="text-sm font-semibold text-slate-100">{t("title")}</p>
      </div>
      <p className="mt-3 text-sm text-slate-400">
        {t("subtitle")}
      </p>
      {loading && (
        <AcademicLoadingState message={t("loading")} className="!min-h-0 py-4" />
      )}
      {error && (
        <AcademicErrorState
          message={error}
          retry={() => void loadLibrary()}
          className="!min-h-0 py-4"
        />
      )}
      {!loading && !error && (
        <div className="mt-4 space-y-3">
          {papers.length === 0 && (
            <AcademicEmptyState
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              className="!min-h-0 py-4"
            />
          )}
        {papers.map((paper) => {
            const locked = paper.status === "locked";
            const statusLabel =
              paper.status === "passed"
                ? t("statuses.passed")
                : paper.status === "skipped"
                  ? t("statuses.skipped")
                  : t("statuses.pending");

            return (
              <div
                key={paper.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
              >
                <div>
                  <p className="font-semibold">{paper.title}</p>
                  <p className="text-xs text-slate-500">
                    {paper.wordCount ? t("words", { count: paper.wordCount }) : t("wordCountPending")}
                    {paper.citationStyle ? ` · ${paper.citationStyle}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full border px-2.5 py-1 ${
                        paper.status === "passed"
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                          : paper.status === "skipped"
                            ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                            : "border-white/10 bg-white/5 text-slate-400"
                      }`}
                    >
                      {statusLabel}
                    </span>
                    {paper.status === "skipped" && (
                      <span className="text-amber-200/80">
                        {t("emergencySkipUsed")}
                      </span>
                    )}
                  </div>
                  {locked && (
                    <p className="mt-2 text-xs text-slate-500">
                      {t("unlockHint")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={locked}
                  onClick={async () => {
                    if (locked) return;
                    setExportingId(paper.id);
                    try {
                      const response = await fetch(
                        `/api/academic/paper/${paper.id}/download`
                      );
                      if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.error || t("errors.download"));
                      }
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `${paper.title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)+/g, "") || "academic-paper"}.docx`;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                      onPaperExport?.(paper.assignmentId);
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : t("errors.download")
                      );
                    } finally {
                      setExportingId(null);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exportingId === paper.id ? t("exporting") : t("export")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
