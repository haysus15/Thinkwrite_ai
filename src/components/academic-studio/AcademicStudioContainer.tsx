// src/components/academic-studio/AcademicStudioContainer.tsx
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import VictorSidebar from "./victor-sidebar/VictorSidebar";
import AcademicWorkspace from "./workspace/AcademicWorkspace";
import { VictorChatProvider } from "./victor-chat/VictorChatContext";
import StudyMaterialsPanel from "./study-materials/StudyMaterialsPanel";
import StudyLibrary from "./study-materials/StudyLibrary";
import AcademicDashboard from "./workspace/AcademicDashboard";
import AssignmentsWorkspace from "./workspace/AssignmentsWorkspace";
import AcademicContextPanel from "./workspace/AcademicContextPanel";
import MathModeContainer from "./math-mode/MathModeContainer";
import { useVictorChat } from "./victor-chat/VictorChatContext";
import AcademicStudioTour from "./AcademicStudioTour";

type AcademicWorkspaceView =
  | "dashboard"
  | "paper-workflow"
  | "study-materials"
  | "study-library"
  | "assignments"
  | "math-mode";

const workspaceConfig: Record<
  AcademicWorkspaceView,
  { title: string; description: string }
> = {
  dashboard: {
    title: "Workspace",
    description: "Choose the next step for your work session.",
  },
  "paper-workflow": {
    title: "Paper workflow",
    description: "Outline, generate, checkpoint, export.",
  },
  "study-materials": {
    title: "Study materials",
    description: "Upload guides and generate quizzes.",
  },
  "study-library": {
    title: "Study library",
    description: "Review materials and quiz history.",
  },
  assignments: {
    title: "Assignments",
    description: "Deadlines, requirements, and syllabus parsing.",
  },
  "math-mode": {
    title: "Math mode",
    description: "Step-by-step math verification workspace.",
  },
};

export default function AcademicStudioContainer() {
  return (
    <VictorChatProvider>
      <AcademicStudioLayout />
    </VictorChatProvider>
  );
}

function AcademicStudioLayout() {
  const { setMode } = useVictorChat();
  const searchParams = useSearchParams();
  const initialWorkspace =
    (searchParams.get("workspace") as AcademicWorkspaceView) || "dashboard";
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [workspaceState, setWorkspaceState] = useState<{
    currentView: AcademicWorkspaceView;
    history: AcademicWorkspaceView[];
  }>({
    currentView: initialWorkspace,
    history: [initialWorkspace],
  });

  useEffect(() => {
    const workspace = searchParams.get("workspace") as AcademicWorkspaceView;
    if (workspace && workspace !== workspaceState.currentView) {
      switchWorkspace(workspace);
    }
  }, [searchParams]);

  useEffect(() => {
    setIsFirstTime(true);
  }, []);

  const switchWorkspace = (view: AcademicWorkspaceView) => {
    setWorkspaceState((prev) => ({
      currentView: view,
      history: [...prev.history.slice(-9), view],
    }));

    const url = new URL(window.location.href);
    url.searchParams.set("workspace", view);
    window.history.pushState({}, "", url.toString());
  };

  const goBack = () => {
    if (workspaceState.history.length > 1) {
      const newHistory = [...workspaceState.history];
      newHistory.pop();
      const previousView = newHistory[newHistory.length - 1] || "dashboard";
      setWorkspaceState({
        currentView: previousView,
        history: newHistory,
      });
      const url = new URL(window.location.href);
      url.searchParams.set("workspace", previousView);
      window.history.pushState({}, "", url.toString());
    }
  };

  const renderWorkspace = () => {
    switch (workspaceState.currentView) {
      case "paper-workflow":
        return <AcademicWorkspace />;
      case "study-materials":
        return <StudyMaterialsPanel />;
      case "study-library":
        return <StudyLibrary embedded />;
      case "assignments":
        return <AssignmentsWorkspace />;
      case "math-mode":
        return (
          <MathModeContainer
            onExit={() => {
              setMode("default");
              switchWorkspace("dashboard");
            }}
          />
        );
      case "dashboard":
      default:
        return <AcademicDashboard onNavigate={switchWorkspace} />;
    }
  };

  const activeConfig = workspaceConfig[workspaceState.currentView];
  const canGoBack =
    workspaceState.history.length > 1 &&
    workspaceState.currentView !== "dashboard";
  const assignmentId = searchParams.get("assignmentId");
  const workspaceContext = assignmentId
    ? `${activeConfig.title} · Assignment ${assignmentId}`
    : activeConfig.title;

  return (
    <div
      className="academic-studio-root text-slate-100"
      style={
        {
          "--academic-primary": "#3B82F6",
          "--academic-primary-dark": "#1E40AF",
          "--victor-accent": "#0EA5E9",
          "--travis-accent": "#14B8A6",
        } as CSSProperties
      }
    >
      {/* Sky background layer */}
      <div className="sky-layer">
        <div className="stars" />
        <div className="nebula-glow" />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-5 pt-5">
        <Link
          href="/select-studio"
          className="inline-flex items-start gap-2 text-slate-300 transition hover:text-white"
        >
          <ChevronLeft className="mt-0.5 h-4 w-4" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300">
              Academic Studio
            </div>
            <div className="text-sm text-slate-200">Back to Select Studio</div>
          </div>
        </Link>
      </div>

      <div className="academic-unified-layout mx-auto w-full max-w-[1600px]">
          <aside className="academic-unified-panel academic-unified-left">
            <div className="academic-panel-scroll p-5 overflow-hidden">
              <VictorSidebar
                workspaceContext={workspaceContext}
                onWorkspaceSwitch={switchWorkspace}
              />
            </div>
          </aside>

          <section className="academic-unified-panel academic-unified-center">
            <header className="academic-unified-header">
              <div className="flex w-full flex-wrap items-center gap-4">
                <div className="flex flex-1 items-center gap-3">
                  {canGoBack && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                      title="Go back"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Academic Studio
                    </p>
                    <h1 className="mt-2 text-xl font-semibold text-slate-100 lg:text-2xl">
                      {activeConfig.title}
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                      {activeConfig.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-[var(--academic-primary)] shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
                  Mirror Mode active
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 text-xs text-slate-300">
                {(
                  [
                    { id: "dashboard", label: "Workspace" },
                    { id: "paper-workflow", label: "Paper workflow" },
                    { id: "study-materials", label: "Study materials" },
                    { id: "study-library", label: "Study library" },
                    { id: "assignments", label: "Assignments" },
                    { id: "math-mode", label: "Math mode" },
                  ] as const
                ).map((item) => {
                  const isActive = workspaceState.currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        switchWorkspace(item.id as AcademicWorkspaceView)
                      }
                      className={`rounded-full border px-4 py-2 transition ${
                        isActive
                          ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </header>
            <div className="academic-panel-scroll p-5">
              {renderWorkspace()}
            </div>
          </section>

          <aside className="academic-unified-panel academic-unified-right">
            <div className="academic-panel-scroll p-5">
              <AcademicContextPanel view={workspaceState.currentView} />
            </div>
          </aside>
        </div>

      <AcademicStudioTour
        isFirstTime={isFirstTime && workspaceState.currentView === "dashboard"}
        onComplete={() => {}}
        onStartPaperWorkflow={() => switchWorkspace("paper-workflow")}
      />
    </div>
  );
}
