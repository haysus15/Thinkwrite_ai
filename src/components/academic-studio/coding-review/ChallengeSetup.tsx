"use client";

import { useState } from "react";
import ChallengeParseReview from "./ChallengeParseReview";
import type { ParsedCodeChallenge } from "@/lib/code-review/challengeParser";

type Method = "upload" | "paste" | "manual";

export default function ChallengeSetup({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (setId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [className, setClassName] = useState("");
  const [assignmentPrompt, setAssignmentPrompt] = useState("");
  const [language, setLanguage] = useState("");
  const [challengeCount, setChallengeCount] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [challengeSetId, setChallengeSetId] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [manualRows, setManualRows] = useState<string[]>([""]);
  const [parsedChallenges, setParsedChallenges] = useState<ParsedCodeChallenge[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureSet = async () => {
    if (challengeSetId) return challengeSetId;
    const response = await fetch("/api/code-review/challenge-set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        class_name: className.trim() || null,
        assignment_prompt: assignmentPrompt.trim() || null,
        language: language.trim() || null,
        challenge_count: challengeCount ? Number(challengeCount) : null,
        source_type: method || "manual",
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Unable to create challenge set.");
    setChallengeSetId(String(data.set.id));
    return String(data.set.id);
  };

  const runParse = async (selectedMethod: Extract<Method, "paste" | "upload">) => {
    setError(null);
    setIsBusy(true);
    try {
      const setId = await ensureSet();
      if (selectedMethod === "paste") {
        const response = await fetch("/api/code-review/challenge/parse-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pasteText, challenge_set_id: setId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to parse text.");
        setParsedChallenges(Array.isArray(data?.challenges) ? data.challenges : []);
      } else {
        if (!uploadFile) throw new Error("Choose a file first.");
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("challenge_set_id", setId);
        const response = await fetch("/api/code-review/challenge/parse-upload", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to parse upload.");
        setParsedChallenges(Array.isArray(data?.challenges) ? data.challenges : []);
      }
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Parse failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmChallenges = async (challenges: ParsedCodeChallenge[]) => {
    const setId = challengeSetId;
    if (!setId) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/code-review/challenge/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_set_id: setId, challenges }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to save challenges.");
      onCreated(setId);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : "Unable to confirm challenges."
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
      const challenges = manualRows
        .map((row, index) => ({
          order: index + 1,
          raw_text: row.trim(),
          challenge_type: "other" as const,
          language_hint: language.trim() || null,
        }))
        .filter((row) => row.raw_text.length > 0);
      if (challenges.length === 0) {
        throw new Error("Add at least one challenge.");
      }
      const response = await fetch("/api/code-review/challenge/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_set_id: setId, challenges }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to save challenges.");
      onCreated(setId);
    } catch (manualError) {
      setError(
        manualError instanceof Error ? manualError.message : "Unable to save manual challenges."
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-100">New challenge set</h3>
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
        <input
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          placeholder="Primary language (optional)"
          className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
        />
        <input
          value={challengeCount}
          onChange={(event) => setChallengeCount(event.target.value)}
          placeholder="Number of challenges (optional)"
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

      {method === "paste" && !parsedChallenges && (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            rows={8}
            placeholder="Paste challenge specs here. Number them if possible."
            className="w-full rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
          />
          <button
            type="button"
            disabled={!pasteText.trim() || isBusy}
            onClick={() => void runParse("paste")}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
          >
            {isBusy ? "Parsing..." : "Parse challenges"}
          </button>
        </div>
      )}

      {method === "upload" && !parsedChallenges && (
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
            {isBusy ? "Parsing..." : "Parse challenge set"}
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
              placeholder={`Challenge ${index + 1}`}
              className="w-full rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
            />
          ))}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManualRows((prev) => [...prev, ""])}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
            >
              Add challenge
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleManualStart()}
              className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
            >
              {isBusy ? "Saving..." : "Start coding"}
            </button>
          </div>
        </div>
      )}

      {parsedChallenges && (
        <ChallengeParseReview
          initialChallenges={parsedChallenges}
          onBack={() => setParsedChallenges(null)}
          onConfirm={(challenges) => void handleConfirmChallenges(challenges)}
          isSaving={isBusy}
        />
      )}

      {error && <p className="text-xs text-rose-200">{error}</p>}
    </section>
  );
}
