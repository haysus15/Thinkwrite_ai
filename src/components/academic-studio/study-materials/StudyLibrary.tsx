// src/components/academic-studio/study-materials/StudyLibrary.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, RefreshCw } from "lucide-react";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { QuizQuestionType } from "@/types/academic-studio";

interface MaterialItem {
  id: string;
  title: string;
  class_name: string | null;
  topic: string | null;
  source_type: string | null;
  created_at?: string;
}

interface MaterialDetail {
  id: string;
  title: string;
  class_name: string | null;
  topic: string | null;
  source_type: string | null;
  content: string;
  file_type: string | null;
  created_at: string;
}

interface QuizItem {
  id: string;
  title: string;
  study_material_id: string | null;
  created_at: string;
}

interface AttemptItem {
  id: string;
  quiz_id: string;
  score: number | null;
  correct_count: number | null;
  total_questions: number | null;
  completed_at: string | null;
}

interface ParsedSection {
  title: string;
  lines: string[];
}

const resolvedPdfVfs =
  (pdfFonts as any)?.pdfMake?.vfs || (pdfFonts as any)?.vfs || null;
if (resolvedPdfVfs) {
  (pdfMake as any).vfs = resolvedPdfVfs;
}

function stripMarkdownDecorators(text: string) {
  return text
    .replace(/^#{1,6}\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
}

function parseStudySections(content: string): ParsedSection[] {
  const normalized = content.replace(/\r/g, "").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

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

function parseQuizQA(lines: string[]) {
  const qa: Array<{ q: string; a: string }> = [];
  let currentQuestion: string | null = null;

  for (const raw of lines) {
    const line = stripMarkdownDecorators(raw);
    const qMatch = line.match(/^Q\d+\s*:\s*(.*)$/i);
    const aMatch = line.match(/^A\d+\s*:\s*(.*)$/i);
    if (qMatch) {
      currentQuestion = qMatch[1]?.trim() || "";
      continue;
    }
    if (aMatch && currentQuestion) {
      qa.push({ q: currentQuestion, a: aMatch[1]?.trim() || "" });
      currentQuestion = null;
    }
  }

  return qa;
}

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

export default function StudyLibrary({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialDetail | null>(
    null
  );
  const [printingGuide, setPrintingGuide] = useState(false);
  const [exportingGuidePdf, setExportingGuidePdf] = useState(false);

  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState(3);
  const [questionTypes, setQuestionTypes] = useState<QuizQuestionType[]>([
    "multiple_choice",
    "short_answer",
  ]);

  useEffect(() => {
    const loadLibrary = async () => {
      setLoading(true);
      setError(null);
      try {
        const [materialsRes, historyRes] = await Promise.all([
          fetch("/api/study/materials"),
          fetch("/api/quiz/history"),
        ]);
        const materialsData = await materialsRes.json();
        const historyData = await historyRes.json();

        if (!materialsRes.ok) {
          throw new Error(materialsData.error || "Failed to load materials.");
        }
        if (!historyRes.ok) {
          throw new Error(historyData.error || "Failed to load quiz history.");
        }

        setMaterials(materialsData.materials || []);
        setQuizzes(historyData.quizzes || []);
        setAttempts(historyData.attempts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load library.");
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, []);

  const latestAttemptByQuiz = useMemo(() => {
    const map = new Map<string, AttemptItem>();
    attempts.forEach((attempt) => {
      if (!map.has(attempt.quiz_id)) {
        map.set(attempt.quiz_id, attempt);
      }
    });
    return map;
  }, [attempts]);
  const selectedSections = useMemo(
    () =>
      selectedMaterial?.content
        ? parseStudySections(selectedMaterial.content)
        : ([] as ParsedSection[]),
    [selectedMaterial]
  );

  const toggleType = (type: QuizQuestionType) => {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const openMaterialViewer = async (materialId: string) => {
    setViewerLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/study/materials/${materialId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load study material.");
      }
      setSelectedMaterial(data.material || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load study material."
      );
    } finally {
      setViewerLoading(false);
    }
  };

  const buildPrintHtml = (material: MaterialDetail, sections: ParsedSection[]) => {
    const renderedSections = sections
      .map((section) => {
        const isQuizSection = /quick self-check quiz/i.test(section.title);
        const qa = isQuizSection ? parseQuizQA(section.lines) : [];
        const body = isQuizSection && qa.length > 0
          ? qa
              .map(
                (item, index) => `<div class="qa-card">
  <p class="qa-label">Question ${index + 1}</p>
  <p class="qa-q">${item.q}</p>
  <p class="qa-a"><strong>Answer:</strong> ${item.a}</p>
</div>`
              )
              .join("")
          : section.lines
              .map((line) => {
                const clean = stripMarkdownDecorators(line);
                if (!clean) return "";
                if (/^\d+\.\s+/.test(clean)) {
                  return `<p class="line"><span class="num">${clean.match(
                    /^\d+\./
                  )?.[0]}</span> ${clean.replace(/^\d+\.\s+/, "")}</p>`;
                }
                if (/^[-*]\s+/.test(clean)) {
                  return `<p class="line"><span class="bullet">•</span> ${clean.replace(
                    /^[-*]\s+/,
                    ""
                  )}</p>`;
                }
                return `<p class="line">${clean}</p>`;
              })
              .join("");

        return `<section class="section">
  <h2>${section.title}</h2>
  ${body}
</section>`;
      })
      .join("");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${material.title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; margin: 24px; }
      h1 { margin: 0 0 4px; font-size: 24px; }
      .meta { color: #475569; margin-bottom: 16px; font-size: 12px; }
      .section { border: 1px solid #dbe3ee; border-radius: 12px; padding: 12px; margin: 0 0 12px; break-inside: avoid; }
      .section h2 { margin: 0 0 8px; font-size: 16px; color: #0f172a; }
      .line { margin: 6px 0; line-height: 1.45; font-size: 13px; }
      .num { color: #0b6aa4; margin-right: 6px; font-weight: 600; }
      .bullet { color: #0b6aa4; margin-right: 6px; }
      .qa-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; margin: 8px 0; }
      .qa-label { margin: 0; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
      .qa-q { margin: 6px 0 2px; font-size: 13px; }
      .qa-a { margin: 4px 0 0; font-size: 13px; color: #14532d; }
    </style>
  </head>
  <body>
    <h1>${material.title}</h1>
    <p class="meta">${material.class_name || "No class"} · ${
      material.topic || "No topic"
    }</p>
    ${renderedSections}
  </body>
</html>`;
  };

  const handlePrintGuide = () => {
    if (!selectedMaterial) return;
    const sections = parseStudySections(selectedMaterial.content || "");
    setPrintingGuide(true);
    try {
      const printWindow = window.open("", "_blank", "width=1024,height=768");
      if (!printWindow) {
        throw new Error("Popup blocked. Allow popups to print the study guide.");
      }
      printWindow.document.open();
      printWindow.document.write(buildPrintHtml(selectedMaterial, sections));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Print failed.");
    } finally {
      setPrintingGuide(false);
    }
  };

  const handleExportGuidePdf = async () => {
    if (!selectedMaterial) return;
    setExportingGuidePdf(true);
    setError(null);
    try {
      if (!(pdfMake as any)?.vfs) {
        throw new Error("PDF font bundle failed to load. Please refresh and try again.");
      }
      const sections = parseStudySections(selectedMaterial.content || "");

      const contentBlocks: any[] = [
        { text: selectedMaterial.title, style: "title" },
        {
          text: `${selectedMaterial.class_name || "No class"} · ${
            selectedMaterial.topic || "No topic"
          }`,
          style: "meta",
          margin: [0, 0, 0, 10],
        },
      ];

      sections.forEach((section) => {
        const isQuizSection = /quick self-check quiz/i.test(section.title);
        const qa = isQuizSection ? parseQuizQA(section.lines) : [];
        contentBlocks.push({ text: section.title, style: "sectionHeader" });

        if (isQuizSection && qa.length > 0) {
          qa.forEach((item, index) => {
            contentBlocks.push({
              stack: [
                { text: `Question ${index + 1}`, style: "quizLabel" },
                { text: item.q, style: "body" },
                { text: `Answer: ${item.a}`, style: "answer" },
              ],
              margin: [0, 0, 0, 8],
            });
          });
          return;
        }

        section.lines.forEach((line) => {
          const clean = stripMarkdownDecorators(line);
          if (!clean) return;
          if (/^\d+\.\s+/.test(clean)) {
            contentBlocks.push({
              text: clean,
              style: "body",
              margin: [0, 0, 0, 4],
            });
            return;
          }
          if (/^[-*]\s+/.test(clean)) {
            contentBlocks.push({
              ul: [clean.replace(/^[-*]\s+/, "")],
              style: "body",
              margin: [0, 0, 0, 4],
            });
            return;
          }
          contentBlocks.push({ text: clean, style: "body", margin: [0, 0, 0, 4] });
        });
      });

      const filename = `${selectedMaterial.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "study-guide"}.pdf`;

      await new Promise<void>((resolve, reject) => {
        try {
          (pdfMake as any)
            .createPdf({
              content: contentBlocks,
              pageMargins: [36, 36, 36, 36],
              styles: {
                title: { fontSize: 18, bold: true, color: "#0f172a" },
                meta: { fontSize: 10, color: "#475569" },
                sectionHeader: {
                  fontSize: 13,
                  bold: true,
                  color: "#0b6aa4",
                  margin: [0, 8, 0, 6],
                },
                quizLabel: {
                  fontSize: 9,
                  bold: true,
                  color: "#64748b",
                  margin: [0, 0, 0, 2],
                },
                body: { fontSize: 11, color: "#111827", lineHeight: 1.35 },
                answer: { fontSize: 11, color: "#14532d", margin: [0, 2, 0, 0] },
              },
              defaultStyle: { fontSize: 11 },
            })
            .download(filename, () => resolve());
        } catch (error) {
          reject(error);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export PDF failed.");
    } finally {
      setExportingGuidePdf(false);
    }
  };

  return (
    <div
      className={
        embedded
          ? "w-full space-y-8"
          : "min-h-screen bg-[#0B1220] text-white px-6 py-10"
      }
    >
      <div className={embedded ? "w-full space-y-8" : "mx-auto w-full max-w-5xl space-y-8"}>
        {!embedded && (
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Academic Studio
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-100">
                Study materials library
              </h1>
            </div>
            <button
              type="button"
              onClick={() => router.push("/academic-studio/dashboard")}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300"
            >
              Back to studio
            </button>
          </header>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-sky-300" />
            <p className="text-sm font-semibold text-slate-100">
              Quiz configuration
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-400">
              Questions
              <input
                type="number"
                min={5}
                max={50}
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="text-xs text-slate-400">
              Difficulty (1-5)
              <input
                type="number"
                min={1}
                max={5}
                value={difficulty}
                onChange={(event) => setDifficulty(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <div className="text-xs text-slate-400">
              Types
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
                    onClick={() => toggleType(type.id as QuizQuestionType)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      questionTypes.includes(type.id as QuizQuestionType)
                        ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                        : "border-white/10 bg-white/5 text-slate-300"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <p className="text-sm text-slate-500">Loading library...</p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}

        {!loading && !error && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-slate-100">
              Materials
            </h2>
            <div className="mt-4 space-y-3">
              {materials.length === 0 && (
                <p className="text-sm text-slate-500">
                  Upload study materials in Study Mode first.
                </p>
              )}
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
                >
                  <div>
                    <p className="font-semibold">{material.title}</p>
                    <p className="text-xs text-slate-500">
                      {material.class_name || "No class"} ·{" "}
                      {material.topic || "No topic"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openMaterialViewer(material.id)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200"
                    >
                      View material
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await fetch("/api/quiz/generate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              studyMaterialId: material.id,
                              questionCount,
                              difficulty,
                              questionTypes,
                            }),
                          });
                          const data = await response.json();
                          if (!response.ok) {
                            throw new Error(
                              data.error || "Quiz generation failed."
                            );
                          }
                          router.push(`/academic-studio/quiz/${data.quizId}`);
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Quiz generation failed."
                          );
                        }
                      }}
                      className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-200"
                    >
                      Generate quiz
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await fetch(
                            `/api/study/materials/${material.id}`,
                            {
                              method: "DELETE",
                            }
                          );
                          const data = await response.json();
                          if (!response.ok) {
                            throw new Error(data.error || "Delete failed.");
                          }
                          setMaterials((prev) =>
                            prev.filter((item) => item.id !== material.id)
                          );
                          if (selectedMaterial?.id === material.id) {
                            setSelectedMaterial(null);
                          }
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : "Delete failed."
                          );
                        }
                      }}
                      className="rounded-full border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && !error && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-slate-100">
              Quiz history
            </h2>
            <div className="mt-4 space-y-3">
              {quizzes.length === 0 && (
                <p className="text-sm text-slate-500">
                  No quizzes yet. Generate one from your materials.
                </p>
              )}
              {quizzes.map((quiz) => {
                const attempt = latestAttemptByQuiz.get(quiz.id);
                return (
                  <div
                    key={quiz.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
                  >
                    <div>
                      <p className="font-semibold">{quiz.title}</p>
                      <p className="text-xs text-slate-500">
                        {attempt
                          ? `Latest score: ${attempt.score ?? 0}%`
                          : "No attempts yet"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/academic-studio/quiz/${quiz.id}`)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retake
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
      {viewerLoading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0B1220] p-6 text-sm text-slate-200">
            Loading study material...
          </div>
        </div>
      )}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-[#0B1220] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-100">
                  {selectedMaterial.title}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedMaterial.class_name || "No class"} ·{" "}
                  {selectedMaterial.topic || "No topic"} ·{" "}
                  {selectedMaterial.source_type || "uploaded"}
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrintGuide}
                disabled={printingGuide || exportingGuidePdf}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 disabled:opacity-60"
              >
                {printingGuide ? "Printing..." : "Print study guide"}
              </button>
              <button
                type="button"
                onClick={handleExportGuidePdf}
                disabled={printingGuide || exportingGuidePdf}
                className="rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1 text-xs text-sky-200 disabled:opacity-60"
              >
                {exportingGuidePdf ? "Exporting..." : "Export to PDF"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedMaterial(null)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
              >
                Close
              </button>
            </div>
            <div className="mt-4 max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              {selectedSections.length === 0 ? (
                <p className="text-sm text-slate-400">No content.</p>
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
                        <h3 className="text-sm font-semibold text-sky-200">
                          {section.title}
                        </h3>
                        {isQuizSection && qa.length > 0 ? (
                          <div className="mt-3 grid gap-3">
                            {qa.map((item, qaIndex) => (
                              <div
                                key={`${item.q}-${qaIndex}`}
                                className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
                              >
                                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                                  Question {qaIndex + 1}
                                </p>
                                <p className="mt-1 text-sm text-slate-100">{item.q}</p>
                                <p className="mt-2 text-sm text-emerald-200">
                                  Answer: {item.a}
                                </p>
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
    </div>
  );
}
