"use client";

import { useMemo, useState } from "react";
import type { MathGuidance, MathProblem, MathStep } from "@/types/math-mode";
import MathProblemInput from "./MathProblemInput";
import MathStepCanvas from "./MathStepCanvas";
import MathVictorGuidance from "./MathVictorGuidance";
import MathGraphPanel from "./MathGraphPanel";
import MathCalculator from "./MathCalculator";
import MathProblemHistory from "./MathProblemHistory";
import { MathfieldElement } from "mathlive";

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
  const handleActiveField = (_field: MathfieldElement | null) => {};

  const graphExpression = useMemo(() => {
    return currentProblem?.graph_expression || "";
  }, [currentProblem]);

  const handleStartProblem = async () => {
    if (!problemLatex.trim()) return;
    const response = await fetch("/api/math/problem/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latex: problemLatex,
        graph_visible: showGraph,
      }),
    });
    const data = await response.json();
    if (response.ok) {
      setCurrentProblem(data.problem);
      setProblems((prev) => [data.problem, ...prev]);
      setSteps([]);
      setGuidance([]);
    }
  };

  const handleAddStep = async () => {
    if (!currentProblem) return;
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
    if (response.ok) {
      setSteps((prev) => [...prev, data.step]);
    }
  };

  const handleUpdateStep = async (id: string, latex: string, reasoning?: string) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, latex, reasoning } : step))
    );
    await fetch(`/api/math/step/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latex, reasoning }),
    });
  };

  const handleDeleteStep = async (id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
    await fetch(`/api/math/step/${id}`, { method: "DELETE" });
  };

  const handleVerifyStep = async (id: string) => {
    const step = steps.find((entry) => entry.id === id);
    if (!currentProblem || !step) return;
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
    if (response.ok) {
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
    }
  };

  const handleVerifyAll = async () => {
    if (!currentProblem || steps.length === 0) return;
    setIsVerifying(true);
    const response = await fetch("/api/math/verify-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem: currentProblem, steps }),
    });
    const data = await response.json();
    if (response.ok) {
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
    }
    setIsVerifying(false);
  };

  const handleSelectProblem = async (id: string) => {
    const response = await fetch(`/api/math/problem/${id}`);
    const data = await response.json();
    if (response.ok) {
      setCurrentProblem(data.problem);
      setSteps(data.steps || []);
      setGuidance(data.guidance || []);
      setProblemLatex(data.problem?.latex || "");
    }
    setShowHistory(false);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="glass-panel flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Math mode
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Step verification workspace
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-slate-300"
          >
            Problem history
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-full border border-red-400/40 bg-red-500/15 px-4 py-2 text-xs text-red-200"
          >
            Exit
          </button>
        </div>
      </div>

      {showHistory && (
        <MathProblemHistory problems={problems} onSelect={handleSelectProblem} />
      )}

      <div className="grid flex-1 min-h-0 grid-cols-[1fr_320px] gap-4 overflow-hidden">
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
          <MathCalculator
            visible={showCalculator}
            onToggle={() => setShowCalculator((prev) => !prev)}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <MathVictorGuidance guidance={guidance} steps={steps} />
          <MathGraphPanel
            expression={graphExpression}
            visible={showGraph}
            onToggle={() => setShowGraph((prev) => !prev)}
          />
        </div>
      </div>
    </div>
  );
}
