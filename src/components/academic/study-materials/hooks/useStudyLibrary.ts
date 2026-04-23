"use client";
// Deprecated: use Study Hub data loading at /academic/study-hub.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { QuizQuestionType } from "@/types/academic";

export interface MaterialItem {
  id: string;
  title: string;
  class_name: string | null;
  topic: string | null;
  source_type: string | null;
  created_at?: string;
}

export interface MaterialDetail {
  id: string;
  title: string;
  class_name: string | null;
  topic: string | null;
  source_type: string | null;
  content: string;
  file_type: string | null;
  created_at: string;
}

export interface QuizItem {
  id: string;
  title: string;
  study_material_id: string | null;
  created_at: string;
}

export interface AttemptItem {
  id: string;
  quiz_id: string;
  score: number | null;
  correct_count: number | null;
  total_questions: number | null;
  completed_at: string | null;
}

export interface ParsedSection {
  title: string;
  lines: string[];
}

type PdfMakeLike = {
  vfs?: unknown;
  createPdf: (docDefinition: unknown) => {
    download: (filename: string, callback?: () => void) => void;
  };
};

const pdfFontsRecord = pdfFonts as { pdfMake?: { vfs?: unknown }; vfs?: unknown };
const resolvedPdfVfs = pdfFontsRecord.pdfMake?.vfs || pdfFontsRecord.vfs || null;
if (resolvedPdfVfs) {
  (pdfMake as PdfMakeLike).vfs = resolvedPdfVfs;
}

export function stripMarkdownDecorators(text: string) {
  return text
    .replace(/^#{1,6}\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
}

export function parseStudySections(content: string): ParsedSection[] {
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

export function parseQuizQA(lines: string[]) {
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

function buildPrintHtml(material: MaterialDetail, sections: ParsedSection[]) {
  const renderedSections = sections
    .map((section) => {
      const isQuizSection = /quick self-check quiz/i.test(section.title);
      const qa = isQuizSection ? parseQuizQA(section.lines) : [];
      const body =
        isQuizSection && qa.length > 0
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
    <p class="meta">${material.class_name || "No class"} · ${material.topic || "No topic"}</p>
    ${renderedSections}
  </body>
</html>`;
}

export function useStudyLibrary(router: AppRouterInstance) {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialDetail | null>(null);
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

  const toggleType = useCallback((type: QuizQuestionType) => {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const openMaterialViewer = useCallback(async (materialId: string) => {
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
      setError(err instanceof Error ? err.message : "Failed to load study material.");
    } finally {
      setViewerLoading(false);
    }
  }, []);

  const generateQuiz = useCallback(
    async (materialId: string) => {
      try {
        const response = await fetch("/api/quiz/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studyMaterialId: materialId,
            questionCount,
            difficulty,
            questionTypes,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Quiz generation failed.");
        }
        router.push(`/academic/quiz/${data.quizId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Quiz generation failed.");
      }
    },
    [difficulty, questionCount, questionTypes, router]
  );

  const deleteMaterial = useCallback(
    async (materialId: string) => {
      try {
        const response = await fetch(`/api/study/materials/${materialId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Delete failed.");
        }
        setMaterials((prev) => prev.filter((item) => item.id !== materialId));
        if (selectedMaterial?.id === materialId) {
          setSelectedMaterial(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
      }
    },
    [selectedMaterial?.id]
  );

  const handlePrintGuide = useCallback(() => {
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
  }, [selectedMaterial]);

  const handleExportGuidePdf = useCallback(async () => {
    if (!selectedMaterial) return;
    setExportingGuidePdf(true);
    setError(null);
    try {
      const pdfMakeClient = pdfMake as PdfMakeLike;
      if (!pdfMakeClient?.vfs) {
        throw new Error("PDF font bundle failed to load. Please refresh and try again.");
      }
      const sections = parseStudySections(selectedMaterial.content || "");

      const contentBlocks: Array<Record<string, unknown>> = [
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
            contentBlocks.push({ text: clean, style: "body", margin: [0, 0, 0, 4] });
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
          pdfMakeClient
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
  }, [selectedMaterial]);

  return {
    materials,
    quizzes,
    loading,
    error,
    viewerLoading,
    selectedMaterial,
    printingGuide,
    exportingGuidePdf,
    questionCount,
    difficulty,
    questionTypes,
    latestAttemptByQuiz,
    selectedSections,
    setError,
    setQuestionCount,
    setDifficulty,
    setSelectedMaterial,
    toggleType,
    openMaterialViewer,
    generateQuiz,
    deleteMaterial,
    handlePrintGuide,
    handleExportGuidePdf,
  };
}
