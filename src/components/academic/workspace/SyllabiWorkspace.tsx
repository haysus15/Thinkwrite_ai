"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import SyllabusReviewWorkspace from "./SyllabusReviewWorkspace";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import shared from "../shared/academic.module.css";

type SyllabusListItem = {
  id: string;
  class_name: string;
  status: "draft" | "approved" | "archived" | string;
  uploaded_at: string | null;
  reviewed_at: string | null;
  confirmed: boolean;
  parse_confidence: number | null;
  term: string | null;
  section: string | null;
  counts: {
    drafts: {
      total: number;
      approved: number;
      rejected: number;
      published: number;
    };
    assignments: {
      total: number;
      active: number;
      completed: number;
      archived: number;
    };
  };
};

function confidencePct(value: number | null): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

export default function SyllabiWorkspace() {
  const t = useTranslations("academic.workspace.syllabi");
  const router = useRouter();
  const searchParams = useSearchParams();
  const syllabusIdFromUrl = searchParams.get("syllabus");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SyllabusListItem[]>([]);
  const [activeReviewSyllabusId, setActiveReviewSyllabusId] = useState<string | null>(
    syllabusIdFromUrl
  );
  const [uploading, setUploading] = useState(false);
  const [uploadDraft, setUploadDraft] = useState({
    class_name: "",
    term: "",
    section: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [historyOpenById, setHistoryOpenById] = useState<Record<string, boolean>>({});

  const loadSyllabi = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/travis/syllabi");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.load"));
      }
      setItems(data.syllabi || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSyllabi();
  }, []);

  useEffect(() => {
    if (!syllabusIdFromUrl) return;
    setActiveReviewSyllabusId(syllabusIdFromUrl);
  }, [syllabusIdFromUrl]);

  const uploadSyllabus = async () => {
    if (!uploadFile) {
      setError(t("errors.chooseFile"));
      return;
    }
    if (!uploadDraft.class_name.trim()) {
      setError(t("errors.classRequired"));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("class_name", uploadDraft.class_name.trim());
      if (uploadDraft.term.trim()) form.append("term", uploadDraft.term.trim());
      if (uploadDraft.section.trim()) form.append("section", uploadDraft.section.trim());

      const response = await fetch("/api/travis/syllabus/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.upload"));
      }
      setUploadFile(null);
      setUploadDraft({ class_name: "", term: "", section: "" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadSyllabi();
      if (data?.syllabus?.id) {
        setActiveReviewSyllabusId(data.syllabus.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.upload"));
    } finally {
      setUploading(false);
    }
  };

  const archiveSyllabus = async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/travis/syllabus/archive/${id}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.archive"));
      }
      await loadSyllabi();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.archive"));
    }
  };

  const confidenceWarningCount = useMemo(
    () => items.filter((item) => confidencePct(item.parse_confidence) < 80).length,
    [items]
  );

  return (
    <div className={`${shared.root} ${shared.page} mx-auto max-w-[980px] space-y-5`}>
      <div className={shared.surfacePanel}>
        <p className={shared.panelTitle}>{t("title")}</p>
        <p className={shared.panelBody}>
          {t("description")}
        </p>
        {confidenceWarningCount > 0 ? (
          <p className="mt-3 text-xs text-amber-200">
            {t("confidenceWarning", { count: confidenceWarningCount })}
          </p>
        ) : null}
      </div>

      <div className={shared.surfacePanel}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {t("uploadTitle")}
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            value={uploadDraft.class_name}
            onChange={(event) =>
              setUploadDraft((current) => ({ ...current, class_name: event.target.value }))
            }
            placeholder={t("placeholders.className")}
            className={shared.control}
          />
          <input
            value={uploadDraft.term}
            onChange={(event) =>
              setUploadDraft((current) => ({ ...current, term: event.target.value }))
            }
            placeholder={t("placeholders.term")}
            className={shared.control}
          />
          <input
            value={uploadDraft.section}
            onChange={(event) =>
              setUploadDraft((current) => ({ ...current, section: event.target.value }))
            }
            placeholder={t("placeholders.section")}
            className={shared.control}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            className="text-xs text-slate-300 file:mr-3 file:rounded-md file:border file:border-white/20 file:bg-white/5 file:px-2 file:py-1 file:text-xs file:text-slate-100"
          />
          <button
            type="button"
            onClick={() => void uploadSyllabus()}
            disabled={uploading}
            className={`${shared.buttonBase} ${shared.buttonPrimary}`}
          >
            {uploading ? t("readingSyllabus") : t("uploadAndParse")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={shared.surfacePanel}>
          <AcademicLoadingState message={t("loading")} className="!min-h-0 py-4" />
        </div>
      ) : items.length === 0 ? (
        <div className={shared.surfacePanel}>
          <AcademicEmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            className="!min-h-0 py-4"
            action={{
              label: t("uploadSyllabus"),
              onClick: () => fileInputRef.current?.click(),
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const confidence = confidencePct(item.parse_confidence);
            const lowConfidence = confidence < 80;
            return (
              <div key={item.id} className={shared.surfacePanelCompact}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{item.class_name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {t("uploadedMeta", {
                        uploadedAt: item.uploaded_at
                          ? new Date(item.uploaded_at).toLocaleString()
                          : t("unknown"),
                        assignments: item.counts.drafts.total,
                        confidence,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.term || t("termNotSet")}
                      {item.section ? ` · ${item.section}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] ${
                        item.status === "approved"
                          ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100"
                          : item.status === "archived"
                            ? "border-slate-300/25 bg-slate-500/10 text-slate-200"
                            : "border-amber-300/35 bg-amber-500/15 text-amber-100"
                      }`}
                    >
                      {item.status === "approved"
                        ? t("statuses.approved")
                        : item.status === "archived"
                          ? t("statuses.archived")
                          : t("statuses.draft")}
                    </span>
                    {lowConfidence ? (
                      <span className="rounded-full border border-amber-300/35 bg-amber-500/15 px-2 py-1 text-[11px] text-amber-100">
                        {t("reviewCarefully")}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReviewSyllabusId(item.id);
                        router.replace(`/academic/syllabi?syllabus=${item.id}`);
                      }}
                      className={`${shared.buttonBase} ${shared.buttonPrimary}`}
                    >
                      {t("review")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadDraft((current) => ({
                          ...current,
                          class_name: item.class_name,
                          term: item.term || "",
                          section: item.section || "",
                        }));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`${shared.buttonBase} ${shared.buttonSecondary}`}
                    >
                      {t("reupload")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setHistoryOpenById((current) => ({
                          ...current,
                          [item.id]: !current[item.id],
                        }))
                      }
                      className={`${shared.buttonBase} ${shared.buttonSecondary}`}
                    >
                      {t("history")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void archiveSyllabus(item.id)}
                      className={`${shared.buttonBase} ${shared.buttonDanger}`}
                    >
                      {t("archive")}
                    </button>
                  </div>
                </div>
                {historyOpenById[item.id] ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    <p>{t("historyStats.approvedDrafts", { count: item.counts.drafts.approved })}</p>
                    <p>{t("historyStats.rejectedDrafts", { count: item.counts.drafts.rejected })}</p>
                    <p>{t("historyStats.publishedDrafts", { count: item.counts.drafts.published })}</p>
                    <p>{t("historyStats.activeAssignments", { count: item.counts.assignments.active })}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {activeReviewSyllabusId ? (
        <div className={shared.surfacePanelCompact}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {t("reviewPanel")}
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveReviewSyllabusId(null);
                router.replace("/academic/syllabi");
              }}
              className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300"
            >
              {t("close")}
            </button>
          </div>
          <SyllabusReviewWorkspace
            syllabusIdOverride={activeReviewSyllabusId}
            embedded
            onPublished={(syllabusId) => {
              setActiveReviewSyllabusId(null);
              void loadSyllabi();
              router.push(`/academic/assignments?syllabusId=${syllabusId}`);
            }}
          />
        </div>
      ) : null}

      {error ? (
        <AcademicErrorState
          message={error}
          className="!min-h-0 border-red-500/40 bg-red-500/10 py-4"
          retry={() => {
            void loadSyllabi();
          }}
        />
      ) : null}
    </div>
  );
}
