// src/components/academic/study-materials/StudyMaterialsPanel.tsx
"use client";
// Deprecated: use Study Hub tabs at /academic/study-hub instead of this standalone panel.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, FilePlus } from "lucide-react";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import type { QuizQuestionType } from "@/types/academic";

interface MaterialItem {
  id: string;
  title: string;
  class_name: string | null;
  topic: string | null;
  source_type: string | null;
}

export default function StudyMaterialsPanel() {
  const t = useTranslations("academic.studyMaterials");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pastedContent, setPastedContent] = useState("");
  const [title, setTitle] = useState("");
  const [className, setClassName] = useState("");
  const [topic, setTopic] = useState("");

  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState(3);
  const [questionTypes, setQuestionTypes] = useState<QuizQuestionType[]>([
    "multiple_choice",
    "short_answer",
  ]);

  useEffect(() => {
    const loadMaterials = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/study/materials");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || t("errors.loadMaterials"));
        }
        setMaterials(data.materials || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.load"));
      } finally {
        setLoading(false);
      }
    };

    loadMaterials();
  }, []);

  const handleUpload = async () => {
    if (!file && !pastedContent.trim()) {
      setError(t("errors.selectFileOrPaste"));
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);

    try {
      const form = new FormData();
      if (file) {
        form.append("file", file);
      }
      if (pastedContent.trim()) {
        form.append("content", pastedContent.trim());
      }
      form.append("title", title);
      form.append("className", className);
      form.append("topic", topic);
      form.append("sourceType", "quiz_source");

      const response = await fetch("/api/study/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.upload"));
      }
      setMaterials((prev) => [data.material, ...prev]);
      setFile(null);
      setPastedContent("");
      setTitle("");
      setClassName("");
      setTopic("");
      if (data?.mirror?.captured) {
        setNotice(t("mirrorUpdated"));
      }
      if (data.warning) {
        setError(data.warning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.upload"));
    } finally {
      setUploading(false);
    }
  };

  const toggleType = (type: QuizQuestionType) => {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-sky-300" />
        <p className="text-sm font-semibold text-slate-100">
          {t("title")}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t("fileUpload")}
          </p>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            <span className="flex-1 truncate">
              {file ? file.name : t("noFileSelected")}
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
            >
              {t("chooseFile")}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="hidden"
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t("pasteStudyText")}
          </p>
          <textarea
            value={pastedContent}
            onChange={(event) => setPastedContent(event.target.value)}
            placeholder={t("pastePlaceholder")}
            rows={8}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-3">
          <label className="text-xs text-slate-400">
            {t("fields.title")}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("fields.title")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t("fields.class")}
            <input
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder={t("fields.class")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t("fields.topic")}
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder={t("fields.topic")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/40 bg-sky-500/15 px-4 py-3 text-sm text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FilePlus className="h-4 w-4" />
          {uploading ? t("saving") : t("saveStudyMaterial")}
        </button>
      </div>

      {notice && (
        <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100">
          {notice}
        </div>
      )}

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          {t("quizConfiguration")}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-slate-400">
            {t("questions")}
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
            {t("difficulty")}
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
            {t("types")}
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: "multiple_choice", label: t("typeLabels.multipleChoice") },
                { id: "true_false", label: t("typeLabels.trueFalse") },
                { id: "short_answer", label: t("typeLabels.shortAnswer") },
                { id: "essay", label: t("typeLabels.essay") },
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
      </div>

      {error && <AcademicErrorState message={error} className="mt-4 !min-h-0 py-3" />}

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Materials
        </p>
        {loading && (
          <AcademicLoadingState message={t("loadingMaterials")} className="!min-h-0 py-3" />
        )}
        {!loading && materials.length === 0 && (
          <AcademicEmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            className="!min-h-0 py-4"
          />
        )}
        <div className="mt-3 space-y-3">
          {materials.map((material) => (
            <div
              key={material.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
            >
              <div>
                <p className="font-semibold">{material.title}</p>
                <p className="text-xs text-slate-500">
                  {material.class_name || t("noClass")} · {material.topic || t("noTopic")}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await fetch("/api/quiz/generate", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        studyMaterialId: material.id,
                        questionCount,
                        difficulty,
                        questionTypes,
                      }),
                    });
                    const data = await response.json();
                    if (!response.ok) {
                      throw new Error(data.error || t("errors.quizGeneration"));
                    }
                    router.push(`/academic/quiz/${data.quizId}`);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : t("errors.quizGeneration")
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
                    const response = await fetch(`/api/study/materials/${material.id}`, {
                      method: "DELETE",
                    });
                    const data = await response.json();
                    if (!response.ok) {
                      throw new Error(data.error || t("errors.delete"));
                    }
                    setMaterials((prev) => prev.filter((item) => item.id !== material.id));
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : t("errors.delete")
                    );
                  }
                }}
                className="rounded-full border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-200"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => router.push("/academic/study-hub?tab=library")}
          className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300"
        >
          Open Study Hub
        </button>
      </div>
    </div>
  );
}
