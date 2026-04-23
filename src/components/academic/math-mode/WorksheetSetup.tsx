"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ParseReview from "./ParseReview";
import type { ParsedWorksheetProblem } from "@/lib/math-mode/worksheetParser";

type Method = "upload" | "paste" | "manual";

export default function WorksheetSetup({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (setId: string) => void;
}) {
  const t = useTranslations();
  const [title, setTitle] = useState("");
  const [className, setClassName] = useState("");
  const [assignmentPrompt, setAssignmentPrompt] = useState("");
  const [problemCount, setProblemCount] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [problemSetId, setProblemSetId] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [manualRows, setManualRows] = useState<string[]>([""]);
  const [parsedProblems, setParsedProblems] = useState<ParsedWorksheetProblem[] | null>(
    null
  );
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureSet = async () => {
    if (problemSetId) return problemSetId;
    const response = await fetch("/api/math/problem-set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        class_name: className.trim() || null,
        assignment_prompt: assignmentPrompt.trim() || null,
        problem_count: problemCount ? Number(problemCount) : null,
        source_type: method || "manual",
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || t("academic.mathMode.worksheetSetup.errors.createSet"));
    setProblemSetId(data.set.id);
    return String(data.set.id);
  };

  const runParse = async (selectedMethod: Method) => {
    setError(null);
    setIsBusy(true);
    try {
      const setId = await ensureSet();
      if (selectedMethod === "paste") {
        const response = await fetch("/api/math/worksheet/parse-text", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: pasteText, problem_set_id: setId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || t("academic.mathMode.worksheetSetup.errors.parseText"));
        setParsedProblems(Array.isArray(data?.problems) ? data.problems : []);
      } else if (selectedMethod === "upload") {
        if (!uploadFile) throw new Error(t("academic.entry.chooseFileFirst"));
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("problem_set_id", setId);
        const response = await fetch("/api/math/worksheet/parse-upload", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || t("academic.mathMode.worksheetSetup.errors.parseUpload"));
        setParsedProblems(Array.isArray(data?.problems) ? data.problems : []);
      }
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : t("academic.entry.parseFailed"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmParsed = async (problems: ParsedWorksheetProblem[]) => {
    if (!problemSetId) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/math/worksheet/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problem_set_id: problemSetId,
          problems,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || t("academic.mathMode.worksheetSetup.errors.saveProblems"));
      onCreated(problemSetId);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : t("academic.mathMode.worksheetSetup.errors.confirmProblems")
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
      const problems = manualRows
        .map((row, index) => ({
          order: index + 1,
          raw_text: row.trim(),
          latex: row.trim(),
          problem_type: "other" as const,
        }))
        .filter((row) => row.raw_text.length > 0);
      if (problems.length === 0) {
        throw new Error(t("academic.entry.addAtLeastOneProblem"));
      }
      const response = await fetch("/api/math/worksheet/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problem_set_id: setId, problems }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || t("academic.mathMode.worksheetSetup.errors.saveProblems"));
      onCreated(setId);
    } catch (manualError) {
      setError(
        manualError instanceof Error ? manualError.message : t("academic.entry.unableToSaveWorksheet")
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-100">{t("academic.entry.newWorksheet")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-slate-300"
        >
          {t("global.close")}
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("academic.entry.assignmentTitle")}
          className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
        />
        <input
          value={className}
          onChange={(event) => setClassName(event.target.value)}
          placeholder={t("academic.entry.classOptional")}
          className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
        />
        <textarea
          value={assignmentPrompt}
          onChange={(event) => setAssignmentPrompt(event.target.value)}
          placeholder={t("academic.entry.assignmentPromptOptional")}
          rows={3}
          className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100 md:col-span-2"
        />
        <input
          value={problemCount}
          onChange={(event) => setProblemCount(event.target.value)}
          placeholder={t("academic.entry.problemCountOptional")}
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
            {t("academic.entry.uploadFile")}
          </button>
          <button
            type="button"
            disabled={!title.trim()}
            onClick={() => setMethod("paste")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
          >
            {t("academic.entry.pasteText")}
          </button>
          <button
            type="button"
            disabled={!title.trim()}
            onClick={() => setMethod("manual")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
          >
            {t("academic.entry.enterManually")}
          </button>
        </div>
      )}

      {method === "paste" && !parsedProblems && (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            rows={8}
            placeholder={t("academic.entry.pasteProblemsPlaceholder")}
            className="w-full rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
          />
          <button
            type="button"
            disabled={!pasteText.trim() || isBusy}
            onClick={() => void runParse("paste")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
          >
            {isBusy ? t("academic.entry.parsing") : t("academic.entry.parseProblems")}
          </button>
        </div>
      )}

      {method === "upload" && !parsedProblems && (
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
            {isBusy ? t("academic.entry.parsing") : t("academic.entry.parseWorksheet")}
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
              placeholder={`${t("academic.entry.problem")} ${index + 1}`}
              className="w-full rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
            />
          ))}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManualRows((prev) => [...prev, ""])}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
            >
              {t("academic.entry.addProblem")}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleManualStart()}
              className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
            >
              {isBusy ? t("academic.entry.saving") : t("academic.entry.startWorking")}
            </button>
          </div>
        </div>
      )}

      {parsedProblems && (
        <ParseReview
          initialProblems={parsedProblems}
          onBack={() => setParsedProblems(null)}
          onConfirm={(problems) => void handleConfirmParsed(problems)}
          isSaving={isBusy}
        />
      )}

      {error && <p className="text-xs text-rose-200">{error}</p>}
    </section>
  );
}
