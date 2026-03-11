"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, FilePlus, UploadCloud, X } from "lucide-react";
import AcademicErrorState from "@/components/academic-studio/shared/AcademicErrorState";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import type { QuizQuestionType } from "@/types/academic-studio";
import { materialKindToUiType, uiTypeToMaterialKind } from "./metadata";

type UploadResult = {
  materialId: string;
  materialTitle: string;
};

type Props = {
  classOptions: string[];
  defaultMaterialKind?: string | null;
  mode: "inline" | "panel";
  onUploaded: (result: UploadResult) => Promise<void>;
  onCancel?: () => void;
};

type Stage = "idle" | "uploading" | "processing" | "complete";

const DEFAULT_TYPES: QuizQuestionType[] = ["multiple_choice", "short_answer"];

export default function UploadMaterialForm({
  classOptions,
  mode,
  onUploaded,
  onCancel,
  defaultMaterialKind,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pastedContent, setPastedContent] = useState("");
  const [title, setTitle] = useState("");
  const [className, setClassName] = useState("");
  const [topic, setTopic] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [materialType, setMaterialType] = useState<"lecture_notes" | "textbook" | "article" | "other">(
    materialKindToUiType(defaultMaterialKind)
  );
  const [tags, setTags] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState(3);
  const [questionTypes, setQuestionTypes] = useState<QuizQuestionType[]>(DEFAULT_TYPES);
  const [stage, setStage] = useState<Stage>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUpload = useMemo(() => {
    return Boolean((file || pastedContent.trim()) && title.trim());
  }, [file, pastedContent, title]);

  const toggleType = (type: QuizQuestionType) => {
    setQuestionTypes((prev) => {
      if (prev.includes(type)) {
        const next = prev.filter((item) => item !== type);
        return next.length > 0 ? next : prev;
      }
      return [...prev, type];
    });
  };

  const reset = () => {
    setFile(null);
    setPastedContent("");
    setTitle("");
    setClassName("");
    setTopic("");
    setMaterialType("other");
    setTags("");
    setQuestionCount(10);
    setDifficulty(3);
    setQuestionTypes(DEFAULT_TYPES);
    setStage("idle");
  };

  const setFileState = (nextFile: File | null) => {
    setFile(nextFile);
    if (nextFile && !title.trim()) {
      const cleanName = nextFile.name.replace(/\.[^.]+$/, "");
      setTitle(cleanName);
    }
  };

  const handleUpload = async () => {
    if (!canUpload) {
      setError("Add a file or pasted text and a material name before uploading.");
      return;
    }

    setError(null);
    setNotice(null);
    setStage("uploading");

    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (pastedContent.trim()) form.append("content", pastedContent.trim());
      form.append("title", title.trim());
      form.append("className", className.trim());
      form.append("topic", topic.trim());
      form.append("sourceType", "quiz_source");
      form.append("originWorkspace", "academic");
      form.append("materialKind", uiTypeToMaterialKind(materialType));
      form.append(
        "sourceMeta",
        JSON.stringify({
          tags: tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          quizDefaults: {
            questionCount,
            difficulty,
            questionTypes,
          },
          lastAccessedAt: null,
        })
      );

      const response = await fetch("/api/study/upload", { method: "POST", body: form });
      setStage("processing");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed. Check your file format and try again.");
      }

      setNotice("Uploaded. Opening in your library.");
      setStage("complete");
      await onUploaded({
        materialId: data?.material?.id || "",
        materialTitle: data?.material?.title || title.trim(),
      });
      reset();
    } catch (err) {
      setStage("idle");
      setError(
        err instanceof Error
          ? err.message
          : "Upload failed. Check your file format and try again."
      );
    }
  };

  const wrapperClass =
    mode === "panel"
      ? "rounded-2xl border border-white/10 bg-[#0B1220] p-6 shadow-xl"
      : "rounded-3xl border border-white/10 bg-white/5 p-6";

  return (
    <div className={wrapperClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Upload your material</p>
          <p className="mt-1 text-xs text-slate-400">Accepted: PDF, DOCX, TXT</p>
        </div>
        {mode === "panel" && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/15 bg-white/5 p-2 text-slate-300"
            aria-label="Close upload panel"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        className="mt-4 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-5"
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files?.[0] || null;
          setFileState(dropped);
        }}
        onDragOver={(event) => event.preventDefault()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <UploadCloud className="h-4 w-4 text-sky-300" />
            <span>{file ? file.name : "Drag and drop or choose file"}</span>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200"
          >
            Choose file
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.docx,.pdf"
          onChange={(event) => setFileState(event.target.files?.[0] || null)}
          className="hidden"
        />
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Or paste text</p>
        <textarea
          value={pastedContent}
          onChange={(event) => setPastedContent(event.target.value)}
          rows={5}
          placeholder="Paste study notes or reading excerpts"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-400">
          Material name
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="text-xs text-slate-400">
          Class (optional)
          <input
            list="study-hub-classes"
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            placeholder="BIO 101"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
          />
          <datalist id="study-hub-classes">
            {classOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-slate-500">
            Adding a class helps Victor connect this material to your assignments.
          </p>
        </label>
      </div>

      <label className="mt-3 block text-xs text-slate-400">
        Topic (optional)
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
        />
      </label>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03]">
        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm text-slate-200"
        >
          <span>Advanced options</span>
          <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
        </button>
        {advancedOpen && (
          <div className="space-y-3 border-t border-white/10 px-4 py-4">
            <label className="text-xs text-slate-400">
              Material type
              <select
                value={materialType}
                onChange={(event) =>
                  setMaterialType(event.target.value as "lecture_notes" | "textbook" | "article" | "other")
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              >
                <option value="lecture_notes">Lecture notes</option>
                <option value="textbook">Textbook chapter</option>
                <option value="article">Article</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="text-xs text-slate-400">
              Tags
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="midterm, review"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-slate-400">
                Questions
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-400">
                Difficulty
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={difficulty}
                  onChange={(event) => setDifficulty(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <div className="text-xs text-slate-400">
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
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={!canUpload || stage === "uploading" || stage === "processing"}
          className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FilePlus className="h-4 w-4" />
          Upload
        </button>
        {stage === "uploading" && (
          <AcademicLoadingState
            message={`Uploading ${file?.name || title.trim()}...`}
            className="!min-h-0 border-0 bg-transparent py-0"
          />
        )}
        {stage === "processing" && (
          <AcademicLoadingState
            message="Reading your material..."
            className="!min-h-0 border-0 bg-transparent py-0"
          />
        )}
      </div>

      {notice && (
        <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          {notice}
        </p>
      )}
      {error && (
        <AcademicErrorState
          message={error}
          retry={() => {
            void handleUpload();
          }}
          className="mt-3 !min-h-0 py-3"
        />
      )}
    </div>
  );
}
