// src/components/academic-studio/paper-workflow/PaperLibrary.tsx
"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";

type PaperStatus = "locked" | "passed" | "skipped";

interface PaperRow {
  id: string;
  topic: string;
  created_at: string;
  word_count: number | null;
  citation_style: string | null;
  checkpoint_passed: boolean;
  emergency_skip_used: boolean;
}

interface PaperItem {
  id: string;
  title: string;
  createdAt: string;
  wordCount: number | null;
  citationStyle: string | null;
  status: PaperStatus;
}

export default function PaperLibrary() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const response = await fetch("/api/academic/papers/user");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load library.");
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
            title: paper.topic,
            createdAt: paper.created_at,
            wordCount: paper.word_count ?? null,
            citationStyle: paper.citation_style ?? null,
            status,
          };
        });

        setPapers(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load library.");
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-slate-200" />
        <p className="text-sm font-semibold text-slate-100">Paper library</p>
      </div>
      <p className="mt-3 text-sm text-slate-400">
        Checkpoint pass or emergency skip unlocks downloads.
      </p>
      {loading && (
        <p className="mt-4 text-sm text-slate-500">Loading papers...</p>
      )}
      {error && (
        <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {!loading && !error && (
        <div className="mt-4 space-y-3">
          {papers.length === 0 && (
            <p className="text-sm text-slate-500">
              No papers yet. Generate a draft to get started.
            </p>
          )}
        {papers.map((paper) => {
            const locked = paper.status === "locked";
            const statusLabel =
              paper.status === "passed"
                ? "Passed"
                : paper.status === "skipped"
                  ? "Skipped"
                  : "Pending";

            return (
              <div
                key={paper.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
              >
                <div>
                  <p className="font-semibold">{paper.title}</p>
                  <p className="text-xs text-slate-500">
                    {paper.wordCount ? `${paper.wordCount} words` : "Word count pending"}
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
                        Emergency skip used
                      </span>
                    )}
                  </div>
                  {locked && (
                    <p className="mt-2 text-xs text-slate-500">
                      Complete checkpoint to unlock download.
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
                        throw new Error(data.error || "Download failed.");
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
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Download failed."
                      );
                    } finally {
                      setExportingId(null);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exportingId === paper.id ? "Exporting..." : "Export"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
