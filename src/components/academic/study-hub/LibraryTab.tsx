"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Search } from "lucide-react";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicErrorState from "@/components/academic-studio/shared/AcademicErrorState";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import type { QuizQuestionType } from "@/types/academic-studio";
import StudyVictorDock from "./StudyVictorDock";
import {
  materialKindLabel,
  materialKindToUiType,
  parseMaterialMetadata,
  serializeMaterialMetadata,
  truncateLabel,
  uiTypeToMaterialKind,
} from "./metadata";
import type { AttemptItem, MaterialDetail, MaterialItem, QuizItem } from "./types";

type PdfMakeLike = {
  vfs?: unknown;
  createPdf: (docDefinition: unknown) => { download: (filename: string) => void };
};

const pdfFontsRecord = pdfFonts as { pdfMake?: { vfs?: unknown }; vfs?: unknown };
const resolvedPdfVfs = pdfFontsRecord.pdfMake?.vfs || pdfFontsRecord.vfs || null;
if (resolvedPdfVfs) {
  (pdfMake as PdfMakeLike).vfs = resolvedPdfVfs;
}

function stripMarkdownDecorators(text: string) {
  return text
    .replace(/^#{1,6}\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
}

function parseSections(content: string) {
  const normalized = content.replace(/\r/g, "").trim();
  if (!normalized) return [] as Array<{ title: string; lines: string[] }>;

  const lines = normalized.split("\n");
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    const headingMatch = line.match(/^##\s+(.*)$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = {
        title: stripMarkdownDecorators(headingMatch[1] || "Section"),
        lines: [],
      };
      continue;
    }
    if (!current) {
      current = { title: "Overview", lines: [] };
    }
    current.lines.push(line.trim());
  }

  if (current) sections.push(current);
  return sections;
}

function relativeDate(input: string | null | undefined) {
  if (!input) return "Unknown";
  const target = new Date(input);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

type Props = {
  materials: MaterialItem[];
  quizzes: QuizItem[];
  attempts: AttemptItem[];
  pendingMaterialDeletes: Set<string>;
  onDeleteMaterial: (materialId: string) => void;
  onGenerateQuiz: (materialId: string) => Promise<void>;
  onUploadMaterial: () => void;
  victorRequest?: {
    materialId: string;
    initialPrompt: string;
    quizContext?: {
      questionText: string;
      studentAnswer: string;
      correctAnswer: string;
      questionLabel: string;
    } | null;
  } | null;
  onVictorRequestHandled?: () => void;
};

type SortValue = "recent" | "oldest" | "az" | "za";

export default function LibraryTab({
  materials,
  quizzes,
  attempts,
  pendingMaterialDeletes,
  onDeleteMaterial,
  onGenerateQuiz,
  onUploadMaterial,
  victorRequest,
  onVictorRequestHandled,
}: Props) {
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialDetail | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortValue, setSortValue] = useState<SortValue>("recent");
  const [isDesktop, setIsDesktop] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [openMenuMaterialId, setOpenMenuMaterialId] = useState<string | null>(null);
  const [settingsQuestionCount, setSettingsQuestionCount] = useState(10);
  const [settingsDifficulty, setSettingsDifficulty] = useState(3);
  const [settingsTypes, setSettingsTypes] = useState<QuizQuestionType[]>([
    "multiple_choice",
    "short_answer",
  ]);
  const [isWideDesktop, setIsWideDesktop] = useState(false);
  const [victorOpen, setVictorOpen] = useState(false);
  const [victorPrompt, setVictorPrompt] = useState<string | null>(null);
  const [victorQuizContext, setVictorQuizContext] = useState<{
    questionText: string;
    studentAnswer: string;
    correctAnswer: string;
    questionLabel: string;
  } | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateViewport = () => setIsDesktop(window.innerWidth >= 1024);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    const updateViewport = () => setIsWideDesktop(window.innerWidth >= 1280);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!menuRootRef.current) return;
      if (!menuRootRef.current.contains(event.target as Node)) {
        setOpenMenuMaterialId(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const classOptions = useMemo(
    () => Array.from(new Set(materials.map((item) => item.class_name || "").filter(Boolean))),
    [materials]
  );

  const quizCountByMaterial = useMemo(() => {
    const counts = new Map<string, number>();
    quizzes.forEach((quiz) => {
      if (!quiz.study_material_id) return;
      counts.set(quiz.study_material_id, (counts.get(quiz.study_material_id) || 0) + 1);
    });
    return counts;
  }, [quizzes]);

  const lastAttemptByQuiz = useMemo(() => {
    const map = new Map<string, AttemptItem>();
    attempts.forEach((attempt) => {
      if (!map.has(attempt.quiz_id)) map.set(attempt.quiz_id, attempt);
    });
    return map;
  }, [attempts]);

  const lastAccessByMaterial = useMemo(() => {
    const map = new Map<string, string>();
    quizzes.forEach((quiz) => {
      if (!quiz.study_material_id) return;
      const attempt = lastAttemptByQuiz.get(quiz.id);
      const candidate = attempt?.completed_at || quiz.created_at;
      const existing = map.get(quiz.study_material_id);
      if (!existing || new Date(candidate).getTime() > new Date(existing).getTime()) {
        map.set(quiz.study_material_id, candidate);
      }
    });
    return map;
  }, [quizzes, lastAttemptByQuiz]);

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = materials.filter((material) => {
      if (normalizedSearch) {
        const haystack = `${material.title} ${material.class_name || ""}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      if (classFilter !== "all" && material.class_name !== classFilter) return false;
      if (typeFilter !== "all") {
        const uiType = materialKindToUiType(material.material_kind);
        if (uiType !== typeFilter) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortValue === "az") return a.title.localeCompare(b.title);
      if (sortValue === "za") return b.title.localeCompare(a.title);
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      if (sortValue === "oldest") return aTime - bTime;
      return bTime - aTime;
    });
  }, [classFilter, materials, search, sortValue, typeFilter]);

  useEffect(() => {
    if (filteredMaterials.length === 0) {
      setSelectedMaterialId(null);
      setSelectedMaterial(null);
      return;
    }
    if (!selectedMaterialId || !filteredMaterials.some((item) => item.id === selectedMaterialId)) {
      setSelectedMaterialId(filteredMaterials[0].id);
    }
  }, [filteredMaterials, selectedMaterialId]);

  const openMaterial = async (materialId: string) => {
    setViewerLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/study/materials/${materialId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load material.");
      }
      setSelectedMaterial(data.material || null);
      setSelectedMaterialId(materialId);

      const source = data?.material?.source_id as string | null | undefined;
      const metadata = parseMaterialMetadata(source);
      metadata.lastAccessedAt = new Date().toISOString();
      await fetch(`/api/study/materials/${materialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialKind: data?.material?.material_kind || null,
          sourceMeta: serializeMaterialMetadata(metadata),
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load material.");
    } finally {
      setViewerLoading(false);
    }
  };

  useEffect(() => {
    if (!isDesktop || !selectedMaterialId) return;
    void openMaterial(selectedMaterialId);
  }, [isDesktop, selectedMaterialId]);

  useEffect(() => {
    if (!victorRequest?.materialId) return;
    setSelectedMaterialId(victorRequest.materialId);
    setVictorPrompt(victorRequest.initialPrompt || null);
    setVictorQuizContext(victorRequest.quizContext || null);
    setVictorOpen(true);
    if (onVictorRequestHandled) onVictorRequestHandled();
  }, [onVictorRequestHandled, victorRequest]);

  const handleGenerateQuiz = async (materialId: string) => {
    setError(null);
    try {
      await onGenerateQuiz(materialId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed.");
    }
  };

  const openVictor = () => {
    if (!selectedMaterialId) return;
    setVictorPrompt(null);
    setVictorQuizContext(null);
    setVictorOpen(true);
  };

  const activeMaterial = materials.find((item) => item.id === selectedMaterialId) || null;
  const selectedSections = useMemo(
    () => (selectedMaterial?.content ? parseSections(selectedMaterial.content) : []),
    [selectedMaterial]
  );

  const printGuide = () => {
    if (!selectedMaterial) return;
    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) {
      setError("Popup blocked. Allow popups to print the study guide.");
      return;
    }

    const body = selectedSections
      .map(
        (section) => `<section style="border:1px solid #dbe3ee;border-radius:12px;padding:12px;margin:0 0 12px;">
<h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">${section.title}</h2>
${section.lines.map((line) => `<p style="font-size:13px;line-height:1.4;">${stripMarkdownDecorators(line)}</p>`).join("")}
</section>`
      )
      .join("");

    printWindow.document.write(`<!doctype html><html><head><title>${selectedMaterial.title}</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">${body}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const exportPdf = async () => {
    if (!selectedMaterial) return;
    const pdfMakeClient = pdfMake as PdfMakeLike;
    if (!pdfMakeClient?.vfs) {
      setError("PDF font bundle failed to load. Refresh and try again.");
      return;
    }

    const contentBlocks: Array<Record<string, unknown>> = [{ text: selectedMaterial.title, style: "title" }];
    selectedSections.forEach((section) => {
      contentBlocks.push({ text: section.title, style: "sectionHeader" });
      section.lines.forEach((line) => {
        const clean = stripMarkdownDecorators(line);
        if (!clean) return;
        contentBlocks.push({ text: clean, style: "body", margin: [0, 0, 0, 4] });
      });
    });

    const filename = `${selectedMaterial.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "study-guide"}.pdf`;

    pdfMakeClient
      .createPdf({
        content: contentBlocks,
        pageMargins: [36, 36, 36, 36],
        styles: {
          title: { fontSize: 18, bold: true, color: "#0f172a" },
          sectionHeader: {
            fontSize: 13,
            bold: true,
            color: "#0b6aa4",
            margin: [0, 8, 0, 6],
          },
          body: { fontSize: 11, color: "#111827", lineHeight: 1.35 },
        },
      })
      .download(filename);
  };

  const exportMaterialPdf = async (materialId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/study/materials/${materialId}`);
      const data = await response.json();
      if (!response.ok || !data?.material) {
        throw new Error(data?.error || "Failed to load material for export.");
      }

      const material = data.material as MaterialDetail;
      const sections = parseSections(material.content || "");
      const pdfMakeClient = pdfMake as PdfMakeLike;
      if (!pdfMakeClient?.vfs) {
        throw new Error("PDF font bundle failed to load. Refresh and try again.");
      }

      const contentBlocks: Array<Record<string, unknown>> = [
        { text: material.title, style: "title" },
      ];
      sections.forEach((section) => {
        contentBlocks.push({ text: section.title, style: "sectionHeader" });
        section.lines.forEach((line) => {
          const clean = stripMarkdownDecorators(line);
          if (!clean) return;
          contentBlocks.push({ text: clean, style: "body", margin: [0, 0, 0, 4] });
        });
      });

      const filename = `${material.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "study-guide"}.pdf`;

      pdfMakeClient
        .createPdf({
          content: contentBlocks,
          pageMargins: [36, 36, 36, 36],
          styles: {
            title: { fontSize: 18, bold: true, color: "#0f172a" },
            sectionHeader: {
              fontSize: 13,
              bold: true,
              color: "#0b6aa4",
              margin: [0, 8, 0, 6],
            },
            body: { fontSize: 11, color: "#111827", lineHeight: 1.35 },
          },
        })
        .download(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    }
  };

  const beginEditSettings = (material: MaterialItem) => {
    const metadata = parseMaterialMetadata(material.source_id);
    setSettingsQuestionCount(metadata.quizDefaults.questionCount);
    setSettingsDifficulty(metadata.quizDefaults.difficulty);
    setSettingsTypes(metadata.quizDefaults.questionTypes);
    setEditingMaterialId(material.id);
  };

  const saveSettings = async () => {
    const target = materials.find((item) => item.id === editingMaterialId);
    if (!target) return;
    const metadata = parseMaterialMetadata(target.source_id);
    metadata.quizDefaults = {
      questionCount: Math.max(5, Math.min(50, settingsQuestionCount)),
      difficulty: Math.max(1, Math.min(5, settingsDifficulty)),
      questionTypes: settingsTypes.length > 0 ? settingsTypes : ["multiple_choice", "short_answer"],
    };
    try {
      const response = await fetch(`/api/study/materials/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialKind: target.material_kind || uiTypeToMaterialKind("other"),
          sourceMeta: serializeMaterialMetadata(metadata),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save settings.");
      }
      setEditingMaterialId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    }
  };

  const filtersActive =
    Boolean(search.trim()) || classFilter !== "all" || typeFilter !== "all" || sortValue !== "recent";

  return (
    <div className="space-y-4">
      {materials.length > 0 && quizzes.length === 0 && (
        <AcademicEmptyState
          title="You have not taken any quizzes yet"
          description="Generate a quiz from any material to start tracking your progress."
          className="!min-h-0 py-4"
        />
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-2 md:grid-cols-4">
          <label className="relative text-xs text-slate-400">
            <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-slate-500" />
            <span className="pl-0.5">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search materials..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs text-slate-400">
            Class
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">All classes</option>
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Type
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">All types</option>
              <option value="lecture_notes">Lecture notes</option>
              <option value="textbook">Textbook</option>
              <option value="article">Article</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Sort
            <select
              value={sortValue}
              onChange={(event) => setSortValue(event.target.value as SortValue)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest</option>
              <option value="az">A–Z</option>
              <option value="za">Z–A</option>
            </select>
          </label>
        </div>

        {filtersActive && (
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
              Filters active
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setClassFilter("all");
                setTypeFilter("all");
                setSortValue("recent");
              }}
              className="text-xs text-slate-300 underline underline-offset-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {materials.length === 0 && (
        <AcademicEmptyState
          title="No materials in your library"
          description="Upload a document to begin."
          action={{ label: "Upload material", onClick: onUploadMaterial }}
          className="rounded-2xl border border-white/10 bg-white/5 !min-h-0 py-8"
        />
      )}

      {materials.length > 0 && (
        <div
          className={`grid gap-4 ${
            isDesktop
              ? isWideDesktop && victorOpen
                ? "lg:grid-cols-[0.35fr_0.35fr_0.30fr]"
                : "lg:grid-cols-[0.42fr_0.58fr]"
              : ""
          }`}
        >
      <section ref={menuRootRef} className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Materials</h2>
            <div className="mt-3 space-y-2">
              {filteredMaterials.map((material) => {
                const metadata = parseMaterialMetadata(material.source_id);
                const quizzesTaken = quizCountByMaterial.get(material.id) || 0;
                const lastAccess = metadata.lastAccessedAt || lastAccessByMaterial.get(material.id) || null;
                const isSelected = selectedMaterialId === material.id;
                return (
                  <div
                    key={material.id}
                    className={`rounded-2xl border px-3 py-3 text-sm ${
                      isSelected
                        ? "border-sky-400/40 bg-sky-500/10"
                        : "border-white/10 bg-slate-950/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMaterialId(material.id);
                        if (!isDesktop) {
                          void openMaterial(material.id);
                        }
                      }}
                      className="w-full text-left"
                    >
                      <p className="font-semibold text-slate-100">{material.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-slate-300">
                          {material.class_name || "No class"}
                        </span>
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-slate-300">
                          {materialKindLabel(material.material_kind)}
                        </span>
                        <span className="text-slate-500">{new Date(material.created_at || "").toLocaleDateString()}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        {quizzesTaken} quizzes taken · Last accessed: {relativeDate(lastAccess)}
                      </p>
                    </button>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGenerateQuiz(material.id)}
                        className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-200"
                      >
                        Generate quiz
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleGenerateQuiz(material.id)}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
                      >
                        Quick Quiz
                      </button>
                      <button
                        type="button"
                        onClick={() => beginEditSettings(material)}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-300"
                      >
                        Edit settings
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMaterial(material.id)}
                        className="rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-xs text-red-200"
                      >
                        {pendingMaterialDeletes.has(material.id) ? "Delete pending..." : "Delete"}
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuMaterialId((prev) =>
                              prev === material.id ? null : material.id
                            )
                          }
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
                          aria-label="More actions"
                        >
                          ···
                        </button>
                        {openMenuMaterialId === material.id && (
                          <div className="absolute right-0 top-9 z-20 min-w-[150px] rounded-xl border border-white/10 bg-[#0B1220] p-1.5 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMaterialId(null);
                                setSelectedMaterialId(material.id);
                                void openMaterial(material.id);
                              }}
                              className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-white/5"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMaterialId(null);
                                void exportMaterialPdf(material.id);
                              }}
                              className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-white/5"
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMaterialId(null);
                                beginEditSettings(material);
                              }}
                              className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-white/5"
                            >
                              Edit settings
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMaterialId(null);
                                onDeleteMaterial(material.id);
                              }}
                              className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-red-200 hover:bg-white/5"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {isDesktop && (!victorOpen || isWideDesktop) && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
              {!activeMaterial && (
                <AcademicEmptyState
                  title="Select a material"
                  description="Select a material to preview it here."
                  className="!min-h-0 py-8"
                />
              )}
              {viewerLoading && (
                <AcademicLoadingState message="Loading study material..." className="!min-h-0 py-5" />
              )}
              {!viewerLoading && selectedMaterial && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold text-slate-100">{selectedMaterial.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {selectedMaterial.class_name || "No class"} · {materialKindLabel(selectedMaterial.material_kind)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGenerateQuiz(selectedMaterial.id)}
                        className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-xs text-sky-200"
                      >
                        Generate quiz
                      </button>
                      <button
                        type="button"
                        onClick={printGuide}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMaterial(selectedMaterial.id)}
                        className="rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1 text-xs text-red-200"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={openVictor}
                        className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-200"
                      >
                        Study with Victor →
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    {selectedSections.length === 0 ? (
                      <p className="text-sm text-slate-400">No content.</p>
                    ) : (
                      <div className="space-y-4">
                        {selectedSections.map((section, index) => (
                          <section
                            key={`${section.title}-${index}`}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                          >
                            <h3 className="text-sm font-semibold text-sky-200">{section.title}</h3>
                            <div className="mt-3 space-y-2">
                              {section.lines.map((line, lineIndex) => (
                                <p
                                  key={`${section.title}-${lineIndex}`}
                                  className="text-sm leading-6 text-slate-200"
                                >
                                  {stripMarkdownDecorators(line)}
                                </p>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {isDesktop && victorOpen && (
            <StudyVictorDock
              materialId={selectedMaterialId || ""}
              materialName={activeMaterial?.title || "Material"}
              initialPrompt={victorPrompt}
              initialQuizContext={victorQuizContext}
              onBackToDocument={!isWideDesktop ? () => setVictorOpen(false) : undefined}
              onClose={() => setVictorOpen(false)}
              compactHeader={!isWideDesktop}
            />
          )}
        </div>
      )}

      {editingMaterialId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B1220] p-5">
            <p className="text-sm font-semibold text-slate-100">Edit quiz settings</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-400">
                Questions
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={settingsQuestionCount}
                  onChange={(event) => setSettingsQuestionCount(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-400">
                Difficulty
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={settingsDifficulty}
                  onChange={(event) => setSettingsDifficulty(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>
            <div className="mt-3 text-xs text-slate-400">
              Question types
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { id: "multiple_choice", label: "MC" },
                  { id: "true_false", label: "T/F" },
                  { id: "short_answer", label: "Short" },
                  { id: "essay", label: "Essay" },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      const value = type.id as QuizQuestionType;
                      setSettingsTypes((prev) => {
                        if (prev.includes(value)) {
                          const next = prev.filter((item) => item !== value);
                          return next.length > 0 ? next : prev;
                        }
                        return [...prev, value];
                      });
                    }}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      settingsTypes.includes(type.id as QuizQuestionType)
                        ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                        : "border-white/10 bg-white/5 text-slate-300"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingMaterialId(null)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveSettings()}
                className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-200"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <AcademicErrorState message={error} className="!min-h-0 py-4" />}

      {!isDesktop && viewerLoading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <AcademicLoadingState
            message="Loading study material..."
            className="w-full max-w-2xl !min-h-0 rounded-3xl py-6"
          />
        </div>
      )}

      {!isDesktop && selectedMaterial && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-[#0B1220] p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-slate-100">{selectedMaterial.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedMaterial.class_name || "No class"} · {selectedMaterial.topic || "No topic"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleGenerateQuiz(selectedMaterial.id)}
                  className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-xs text-sky-200"
                >
                  Generate quiz
                </button>
                <button
                  type="button"
                  onClick={printGuide}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                >
                  Print study guide
                </button>
                <button
                  type="button"
                  onClick={() => void exportPdf()}
                  className="rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1 text-xs text-sky-200"
                >
                  Export to PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVictorPrompt(null);
                    setVictorQuizContext(null);
                    setVictorOpen(true);
                  }}
                  className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-200"
                >
                  Study with Victor →
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMaterial(null)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="mt-4 max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              {selectedSections.length === 0 ? (
                <p className="text-sm text-slate-400">No content.</p>
              ) : (
                <div className="space-y-4">
                  {selectedSections.map((section, index) => (
                    <section
                      key={`${section.title}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <h3 className="text-sm font-semibold text-sky-200">{section.title}</h3>
                      <div className="mt-3 space-y-2">
                        {section.lines.map((line, lineIndex) => (
                          <p
                            key={`${section.title}-${lineIndex}`}
                            className="text-sm leading-6 text-slate-200"
                          >
                            {stripMarkdownDecorators(line)}
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!isDesktop && victorOpen && selectedMaterialId && activeMaterial && (
        <div className="fixed inset-0 z-[60] bg-[#060a13] p-4">
          <StudyVictorDock
            materialId={selectedMaterialId}
            materialName={activeMaterial.title}
            initialPrompt={victorPrompt}
            initialQuizContext={victorQuizContext}
            onClose={() => setVictorOpen(false)}
          />
        </div>
      )}

      {activeMaterial && (
        <p className="inline-flex items-center gap-2 text-xs text-slate-500">
          <Clock3 className="h-3 w-3" />
          Active material: {truncateLabel(activeMaterial.title)}
        </p>
      )}
    </div>
  );
}
