"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { MathGuidance, MathProblem, MathStep } from "@/types/math-mode";
import MathProblemInput from "./MathProblemInput";
import MathStepCanvas from "./MathStepCanvas";
import MathVictorGuidance from "./MathVictorGuidance";
import MathGraphPanel from "./MathGraphPanel";
import MathCalculator from "./MathCalculator";
import MathProblemHistory from "./MathProblemHistory";
type MathfieldElement = any;

export default function MathModeContainer({ onExit }: { onExit: () => void }) {
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [steps, setSteps] = useState<MathStep[]>([]);
  const [guidance, setGuidance] = useState<MathGuidance[]>([]);
  const [problemLatex, setProblemLatex] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const missingStepIdsRef = useRef<Set<string>>(new Set());
  const handleActiveField = (_field: MathfieldElement | null) => {};

  const graphExpression = useMemo(() => {
    return currentProblem?.graph_expression || "";
  }, [currentProblem]);
  const hasProblem = Boolean(currentProblem);
  const hasSteps = steps.length > 0;
  const normalizeStepText = (value: string) =>
    value.replace(/\s+/g, " ").trim().toLowerCase();

  useEffect(() => {
    let active = true;

    const loadProblems = async () => {
      try {
        const response = await fetch("/api/math/problem/list");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to load problem history.");
        }
        if (active) {
          setProblems(Array.isArray(data?.problems) ? data.problems : []);
        }
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load problem history."
        );
      }
    };

    loadProblems();
    return () => {
      active = false;
    };
  }, []);

  const handleStartProblem = async () => {
    if (!problemLatex.trim()) return;
    setErrorMessage(null);
    try {
      const response = await fetch("/api/math/problem/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latex: problemLatex,
          graph_visible: showGraph,
          graph_expression: showGraph ? problemLatex : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to create problem.");
      }
      setCurrentProblem(data.problem);
      setProblems((prev) => [data.problem, ...prev.filter((p) => p.id !== data.problem.id)]);
      setSteps([]);
      setGuidance([]);
      missingStepIdsRef.current.clear();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create problem."
      );
    }
  };

  const handleAddStep = async () => {
    if (!currentProblem) return;
    const lastStep = steps[steps.length - 1];
    if (lastStep && !lastStep.latex.trim() && !(lastStep.reasoning || "").trim()) {
      setErrorMessage(
        "Finish the current blank step before adding another one."
      );
      return;
    }
    setErrorMessage(null);
    try {
      const response = await fetch("/api/math/step/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_id: currentProblem.id,
          latex: "",
          step_number: steps.length + 1,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to create step.");
      }
      missingStepIdsRef.current.delete(data.step.id);
      setSteps((prev) => [...prev, data.step]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create step."
      );
    }
  };

  const handleUpdateStep = async (id: string, latex: string, reasoning?: string) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, latex, reasoning } : step))
    );
    if (missingStepIdsRef.current.has(id)) return;
    try {
      const response = await fetch(`/api/math/step/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex, reasoning }),
      });
      if (!response.ok && response.status === 404) {
        missingStepIdsRef.current.add(id);
        setErrorMessage(
          "Autosave lost sync after a server refresh. Add a new step to continue autosave."
        );
      }
    } catch {
      // Preserve local edits even if background persistence fails.
    }
  };

  const handleDeleteStep = async (id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
    missingStepIdsRef.current.delete(id);
    try {
      await fetch(`/api/math/step/${id}`, { method: "DELETE" });
    } catch {
      // Keep UI responsive if delete persistence fails.
    }
  };

  const handleVerifyStep = async (id: string) => {
    const step = steps.find((entry) => entry.id === id);
    if (!currentProblem || !step) return;
    if (!step.latex.trim()) {
      setErrorMessage("Write the math expression for this step before verifying.");
      return;
    }
    const currentIndex = steps.findIndex((entry) => entry.id === id);
    const normalizedLatex = normalizeStepText(step.latex);
    const duplicate = steps.some((entry, index) => {
      if (index === currentIndex) return false;
      if (index > currentIndex) return false;
      return normalizeStepText(entry.latex) === normalizedLatex;
    });
    if (duplicate) {
      setSteps((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "error",
                error_type: "procedural",
                feedback:
                  "This repeats an earlier step. Move the equation forward with a new transformation.",
              }
            : entry
        )
      );
      setErrorMessage(
        "That step matches an earlier step. Apply the next transformation instead of repeating."
      );
      return;
    }
    setErrorMessage(null);
    try {
      const response = await fetch("/api/math/step/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: currentProblem,
          step,
          steps,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to verify step.");
      }
      setSteps((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: data.result.status,
                error_type: data.result.error_type,
                feedback: data.result.feedback,
              }
            : entry
        )
      );
      if (data.guidance) {
        setGuidance((prev) => [...prev, data.guidance]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to verify step."
      );
    }
  };

  const handleVerifyAll = async () => {
    if (!currentProblem || steps.length === 0) return;
    const hasEmptyStep = steps.some((entry) => !entry.latex.trim());
    if (hasEmptyStep) {
      setErrorMessage("Complete all step expressions before running Verify all.");
      return;
    }
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/math/verify-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: currentProblem, steps }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to verify all steps.");
      }
      setSteps((prev) =>
        prev.map((entry) => {
          const result = data.results.find((item: { step_id: string }) => item.step_id === entry.id);
          return result
            ? {
                ...entry,
                status: result.status,
                error_type: result.error_type,
                feedback: result.feedback,
              }
            : entry;
        })
      );
      if (data.guidance) {
        setGuidance((prev) => [...prev, data.guidance]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to verify all steps."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelectProblem = async (id: string) => {
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/math/problem/${id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load selected problem.");
      }
      setCurrentProblem(data.problem);
      setSteps(data.steps || []);
      setGuidance(data.guidance || []);
      setProblemLatex(data.problem?.latex || "");
      setShowHistory(false);
      missingStepIdsRef.current.clear();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load selected problem."
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="glass-panel px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Math mode
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Verified Step Workspace
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Enter a problem, build steps, then verify each transformation with Victor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-slate-300 transition hover:bg-white/[0.08]"
            >
              {showHistory ? "Hide history" : "Problem history"}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-full border border-red-400/40 bg-red-500/15 px-4 py-2 text-xs text-red-200 transition hover:bg-red-500/25"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-200">
              {hasProblem ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <Circle className="h-4 w-4 text-slate-500" />
              )}
              1. Define the problem
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-200">
              {hasSteps ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <Circle className="h-4 w-4 text-slate-500" />
              )}
              2. Build your steps
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-200">
              {steps.some((step) => step.status !== "unchecked") ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <Circle className="h-4 w-4 text-slate-500" />
              )}
              3. Verify and refine
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      )}

      {showHistory && (
        <MathProblemHistory problems={problems} onSelect={handleSelectProblem} />
      )}

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <MathProblemInput
            latex={problemLatex}
            onLatexChange={setProblemLatex}
            onStart={handleStartProblem}
            onActiveFieldChange={handleActiveField}
          />
          <MathStepCanvas
            steps={steps}
            onAddStep={handleAddStep}
            onVerifyAll={handleVerifyAll}
            onVerifyStep={handleVerifyStep}
            onUpdateStep={handleUpdateStep}
            onDeleteStep={handleDeleteStep}
            onActiveFieldChange={handleActiveField}
            isVerifying={isVerifying}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <MathVictorGuidance guidance={guidance} steps={steps} />
          <MathGraphPanel
            expression={graphExpression}
            visible={showGraph}
            onToggle={() => setShowGraph((prev) => !prev)}
          />
          <MathCalculator
            visible={showCalculator}
            onToggle={() => setShowCalculator((prev) => !prev)}
          />
        </div>
      </div>
    </div>
  );
}
