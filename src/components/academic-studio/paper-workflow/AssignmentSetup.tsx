"use client";

import { useState } from "react";
import PromptParseReview from "./PromptParseReview";
import type { ParsedAssignmentPrompt } from "@/lib/paper-workflow/assignmentParser";

type Method = "upload" | "paste" | "manual";

export default function AssignmentSetup({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (setId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [className, setClassName] = useState("");
  const [assignmentPrompt, setAssignmentPrompt] = useState("");
  const [rubricText, setRubricText] = useState("");
  const [paperCount, setPaperCount] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [assignmentSetId, setAssignmentSetId] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [manualRows, setManualRows] = useState<string[]>([""]);
  const [parsedPrompts, setParsedPrompts] = useState<ParsedAssignmentPrompt[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureSet = async () => {
    if (assignmentSetId) return assignmentSetId;
    const response = await fetch("/api/paper/assignment-set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        class_name: className.trim() || null,
        assignment_prompt: assignmentPrompt.trim() || null,
        rubric_text: rubricText.trim() || null,
        paper_count: paperCount ? Number(paperCount) : null,
        source_type: method || "manual",
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Unable to create assignment set.");
    setAssignmentSetId(String(data.set.id));
    return String(data.set.id);
  };

  const runParse = async (selectedMethod: Extract<Method, "paste" | "upload">) => {
    setError(null);
    setIsBusy(true);
    try {
      const setId = await ensureSet();
      if (selectedMethod === "paste") {
        const response = await fetch("/api/paper/assignment/parse-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pasteText, assignment_set_id: setId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to parse text.");
        setParsedPrompts(Array.isArray(data?.prompts) ? data.prompts : []);
      } else {
        if (!uploadFile) throw new Error("Choose a file first.");
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("assignment_set_id", setId);
        const response = await fetch("/api/paper/assignment/parse-upload", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to parse upload.");
        setParsedPrompts(Array.isArray(data?.prompts) ? data.prompts : []);
      }
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Parse failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmPrompts = async (prompts: ParsedAssignmentPrompt[]) => {
    const setId = assignmentSetId;
    if (!setId) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/paper/assignment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_set_id: setId, prompts }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to save prompts.");
      onCreated(setId);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : "Unable to confirm prompts."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleManualStart = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const setId = await ensureSet();
      const prompts = manualRows
        .map((row, index) => ({
          order: index + 1,
          raw_text: row.trim(),
          prompt_type: "other" as const,
          word_count_hint: null,
        }))
        .filter((row) => row.raw_text.length > 0);
      if (prompts.length === 0) {
        throw new Error("Add at least one prompt.");
      }
      const response = await fetch("/api/paper/assignment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_set_id: setId, prompts }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to save prompts.");
      onCreated(setId);
    } catch (manualError) {
      setError(
        manualError instanceof Error ? manualError.message : "Unable to save manual prompts."
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-100">New assignment set</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-slate-300"
        >
          Close
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Assignment title"
          className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
        />
        <input
          value={className}
          onChange={(event) => setClassName(event.target.value)}
          placeholder="Class / course name (optional)"
          className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
        />
        <textarea
          value={assignmentPrompt}
          onChange={(event) => setAssignmentPrompt(event.target.value)}
          placeholder="Assignment prompt (optional)"
          rows={3}
          className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100 md:col-span-2"
        />
        <textarea
          value={rubricText}
          onChange={(event) => setRubricText(event.target.value)}
          placeholder="Rubric (optional)"
          rows={3}
          className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100 md:col-span-2"
        />
        <input
          value={paperCount}
          onChange={(event) => setPaperCount(event.target.value)}
          placeholder="Number of papers (optional)"
          inputMode="numeric"
          className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
        />
      </div>

      {!method && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!title.trim()}
            onClick={() => setMethod("upload")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
          >
            Upload file
          </button>
          <button
            type="button"
            disabled={!title.trim()}
            onClick={() => setMethod("paste")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
          >
            Paste text
          </button>
          <button
            type="button"
            disabled={!title.trim()}
            onClick={() => setMethod("manual")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
          >
            Enter manually
          </button>
        </div>
      )}

      {method === "paste" && !parsedPrompts && (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            rows={8}
            placeholder="Paste assignment prompts here. Number them if possible."
            className="w-full rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
          />
          <button
            type="button"
            disabled={!pasteText.trim() || isBusy}
            onClick={() => void runParse("paste")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
          >
            {isBusy ? "Parsing..." : "Parse prompts"}
          </button>
        </div>
      )}

      {method === "upload" && !parsedPrompts && (
        <div className="space-y-2">
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-200"
          />
          <button
            type="button"
            disabled={!uploadFile || isBusy}
            onClick={() => void runParse("upload")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
          >
            {isBusy ? "Parsing..." : "Parse assignment"}
          </button>
        </div>
      )}

      {method === "manual" && (
        <div className="space-y-2">
          {manualRows.map((row, index) => (
            <input
              key={`manual-${index}`}
              value={row}
              onChange={(event) =>
                setManualRows((prev) =>
                  prev.map((entry, idx) => (idx === index ? event.target.value : entry))
                )
              }
              placeholder={`Prompt ${index + 1}`}
              className="w-full rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
            />
          ))}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManualRows((prev) => [...prev, ""])}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
            >
              Add prompt
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleManualStart()}
              className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
            >
              {isBusy ? "Saving..." : "Start writing"}
            </button>
          </div>
        </div>
      )}

      {parsedPrompts && (
        <PromptParseReview
          initialPrompts={parsedPrompts}
          onBack={() => setParsedPrompts(null)}
          onConfirm={(prompts) => void handleConfirmPrompts(prompts)}
          isSaving={isBusy}
        />
      )}

      {error && <p className="text-xs text-rose-200">{error}</p>}
    </section>
  );
}
