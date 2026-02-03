// src/components/academic-studio/study-materials/StudyMaterialsPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FilePlus } from "lucide-react";
import type { QuizQuestionType } from "@/types/academic-studio";

interface MaterialItem {
  id: string;
  title: string;
  class_name: string | null;
  topic: string | null;
  source_type: string | null;
}

export default function StudyMaterialsPanel() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
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
          throw new Error(data.error || "Failed to load materials.");
        }
        setMaterials(data.materials || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    };

    loadMaterials();
  }, []);

  const handleUpload = async () => {
    if (!file) {
      setError("Select a file to upload.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title);
      form.append("className", className);
      form.append("topic", topic);

      const response = await fetch("/api/study/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      setMaterials((prev) => [data.material, ...prev]);
      setFile(null);
      setTitle("");
      setClassName("");
      setTopic("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
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
          Study materials
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            File
          </p>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            <span className="flex-1 truncate">
              {file ? file.name : "No file selected"}
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
            >
              Choose file
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
        <div className="space-y-3">
          <label className="text-xs text-slate-400">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            Class
            <input
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="Class"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            Topic
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Topic"
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
          {uploading ? "Uploading..." : "Upload materials"}
        </button>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Quiz configuration
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
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
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Materials
        </p>
        {loading && (
          <p className="mt-3 text-sm text-slate-500">Loading materials...</p>
        )}
        {!loading && materials.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">
            Upload a study guide to generate a quiz.
          </p>
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
                  {material.class_name || "No class"} · {material.topic || "No topic"}
                </p>
              </div>
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
                      throw new Error(data.error || "Quiz generation failed.");
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
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            router.push("/academic-studio/dashboard?workspace=study-library")
          }
          className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300"
        >
          Open study library
        </button>
      </div>
    </div>
  );
}
