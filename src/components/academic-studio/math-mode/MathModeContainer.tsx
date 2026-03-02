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
  const [mathTrack, setMathTrack] = useState<
    "general" | "algebra" | "calculus" | "statistics"
  >("general");
  const [activeTool, setActiveTool] = useState<
    "none" | "guidance" | "graph" | "calculator" | "history"
  >("none");
  const [showTools, setShowTools] = useState(false);
  const [graphSource, setGraphSource] = useState<
    "problem" | "latest_step" | "custom"
  >("problem");
  const [customGraphExpression, setCustomGraphExpression] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const missingStepIdsRef = useRef<Set<string>>(new Set());
  const handleActiveField = (_field: MathfieldElement | null) => {};

  const graphExpression = useMemo(() => {
    const latestStep = [...steps]
      .reverse()
      .find((step) => (step.latex || "").trim().length > 0);
    if (graphSource === "latest_step") return latestStep?.latex || "";
    if (graphSource === "custom") return customGraphExpression;
    return currentProblem?.graph_expression || problemLatex || "";
  }, [currentProblem, customGraphExpression, graphSource, problemLatex, steps]);
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
          graph_visible: true,
          graph_expression: problemLatex,
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
      if (!customGraphExpression.trim()) {
        setCustomGraphExpression(problemLatex);
      }
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">Math Mode</p>
          <p className="text-xs text-slate-400">
            Worksheet + tools. Keep all steps explicit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={mathTrack}
            onChange={(event) =>
              setMathTrack(
                event.target.value as
                  | "general"
                  | "algebra"
                  | "calculus"
                  | "statistics"
              )
            }
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="general">General</option>
            <option value="algebra">Algebra</option>
            <option value="calculus">Calculus</option>
            <option value="statistics">Statistics</option>
          </select>
          <button
            type="button"
            onClick={onExit}
            className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-500/25"
          >
            Exit
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
            Mode: {mathTrack}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
            {hasProblem ? "Problem set" : "No problem yet"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
            {steps.length} step{steps.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
            {steps.some((step) => step.status !== "unchecked")
              ? "Verification started"
              : "Not verified yet"}
          </span>
          <button
            type="button"
            onClick={() => {
              setShowTools((prev) => !prev);
              if (!showTools && activeTool === "none") {
                setActiveTool("guidance");
              }
            }}
            className="ml-auto rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300 transition hover:bg-white/[0.08]"
          >
            {showTools ? "Hide tools" : "Show tools"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTools(true);
              setActiveTool("guidance");
            }}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300 transition hover:bg-white/[0.08]"
          >
            Guidance
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTools(true);
              setActiveTool("graph");
            }}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300 transition hover:bg-white/[0.08]"
          >
            Graph
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTools(true);
              setActiveTool("calculator");
            }}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300 transition hover:bg-white/[0.08]"
          >
            Calculator
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTools(true);
              setActiveTool("history");
            }}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300 transition hover:bg-white/[0.08]"
          >
            History
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-4 mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      )}

      <div
        className={`grid min-h-0 flex-1 gap-3 p-3 ${
          showTools && activeTool !== "none"
            ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]"
            : "grid-cols-1"
        }`}
      >
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          {!hasProblem && !hasSteps && (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/10 text-center">
              <div>
                <p className="text-sm text-slate-300">Blank worksheet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Enter a math problem in the dock below to begin.
                </p>
              </div>
            </div>
          )}
          {(hasProblem || hasSteps) && (
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
          )}
        </div>

        {showTools && activeTool !== "none" && (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="border-b border-white/10 px-3 py-2">
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              {[
                { id: "guidance", label: "Guidance" },
                { id: "graph", label: "Graph" },
                { id: "calculator", label: "Calculator" },
                { id: "history", label: "History" },
              ].map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() =>
                    setActiveTool(
                      tool.id as "guidance" | "graph" | "calculator" | "history"
                    )
                  }
                  className={`rounded-md border px-2 py-1 transition ${
                    activeTool === tool.id
                      ? "border-sky-400/40 bg-sky-500/20 text-sky-100"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {activeTool === "guidance" && (
              <MathVictorGuidance guidance={guidance} steps={steps} />
            )}

            {activeTool === "graph" && (
              <div className="space-y-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Graph source
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setGraphSource("problem")}
                      className={`rounded-md border px-2 py-1 ${
                        graphSource === "problem"
                          ? "border-sky-400/40 bg-sky-500/20 text-sky-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300"
                      }`}
                    >
                      Problem
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphSource("latest_step")}
                      className={`rounded-md border px-2 py-1 ${
                        graphSource === "latest_step"
                          ? "border-sky-400/40 bg-sky-500/20 text-sky-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300"
                      }`}
                    >
                      Latest step
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphSource("custom")}
                      className={`rounded-md border px-2 py-1 ${
                        graphSource === "custom"
                          ? "border-sky-400/40 bg-sky-500/20 text-sky-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {graphSource === "custom" && (
                    <input
                      value={customGraphExpression}
                      onChange={(event) =>
                        setCustomGraphExpression(event.target.value)
                      }
                      placeholder="e.g., x^2 + 3*x - 4"
                      className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-100"
                    />
                  )}
                </div>
                <MathGraphPanel
                  expression={graphExpression}
                  visible
                  onToggle={() => null}
                  showToggle={false}
                />
              </div>
            )}

            {activeTool === "calculator" && (
              <MathCalculator visible onToggle={() => null} showToggle={false} />
            )}

            {activeTool === "history" && (
              <MathProblemHistory problems={problems} onSelect={handleSelectProblem} />
            )}
          </div>
        </div>
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <MathProblemInput
          latex={problemLatex}
          onLatexChange={setProblemLatex}
          onStart={handleStartProblem}
          onActiveFieldChange={handleActiveField}
          variant="dock"
        />
      </div>
    </div>
  );
}
