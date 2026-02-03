// src/components/academic-studio/paper-workflow/PaperWorkflowContainer.tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import OutlineBuilder from "./OutlineBuilder";
import PaperGenerator from "./PaperGenerator";
import UnderstandingCheckpoint from "./UnderstandingCheckpoint";
import PaperLibrary from "./PaperLibrary";

type WorkflowStep = "outline" | "generate" | "checkpoint" | "library";

export default function PaperWorkflowContainer() {
  const [step, setStep] = useState<WorkflowStep>("outline");
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("assignmentId");
    if (id) {
      setAssignmentId(id);
      setStep("outline");
    }
  }, [searchParams]);

  return (
    <div className="academic-nested-card rounded-xl p-5">
      {/* Workflow header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
            Paper workflow
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-100">
            Outline to checkpoint, no skipped steps.
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Victor drives structure. Travis locks requirements before you
            export.
          </p>
        </div>
        {/* Step navigation */}
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          <button
            type="button"
            onClick={() => setStep("outline")}
            className={`rounded-full border px-4 py-2 transition ${
              step === "outline"
                ? "border-sky-400/50 bg-sky-500/15 text-sky-200"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
            }`}
          >
            Outline
          </button>
          <button
            type="button"
            onClick={() => setStep("generate")}
            className={`rounded-full border px-4 py-2 transition ${
              step === "generate"
                ? "border-sky-400/50 bg-sky-500/15 text-sky-200"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
            }`}
          >
            Generate
          </button>
          <button
            type="button"
            onClick={() => setStep("checkpoint")}
            className={`rounded-full border px-4 py-2 transition ${
              step === "checkpoint"
                ? "border-sky-400/50 bg-sky-500/15 text-sky-200"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
            }`}
          >
            Checkpoint
          </button>
          <button
            type="button"
            onClick={() => setStep("library")}
            className={`rounded-full border px-4 py-2 transition ${
              step === "library"
                ? "border-sky-400/50 bg-sky-500/15 text-sky-200"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
            }`}
          >
            Library
          </button>
        </div>
      </div>

      {/* Step content */}
      <div className="mt-6">
        {step === "outline" && (
          <OutlineBuilder
            onContinue={(id) => {
              setOutlineId(id);
              setStep("generate");
            }}
          />
        )}
        {step === "generate" && (
          <PaperGenerator
            outlineId={outlineId}
            assignmentId={assignmentId}
            onBack={() => setStep("outline")}
            onContinue={(id) => {
              setPaperId(id);
              setStep("checkpoint");
            }}
          />
        )}
        {step === "checkpoint" && (
          <UnderstandingCheckpoint
            paperId={paperId}
            onBack={() => setStep("generate")}
          />
        )}
        {step === "library" && <PaperLibrary />}
      </div>
    </div>
  );
}
