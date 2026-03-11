// src/components/academic-studio/AcademicStudioContainer.tsx
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import VictorSidebar from "./victor-sidebar/VictorSidebar";
import AcademicWorkspace from "./workspace/AcademicWorkspace";
import { VictorChatProvider } from "./victor-chat/VictorChatContext";
import AcademicDashboard from "./workspace/AcademicDashboard";
import AssignmentsWorkspace from "./workspace/AssignmentsWorkspace";
import SyllabiWorkspace from "./workspace/SyllabiWorkspace";
import AcademicContextPanel from "./workspace/AcademicContextPanel";
import MathModeContainer from "./math-mode/MathModeContainer";
import AcademicAgendaShell from "./agenda/AcademicAgendaShell";
import { useVictorChat } from "./victor-chat/VictorChatContext";
import AcademicStudioTour from "./AcademicStudioTour";
import StudioConsentModal from "@/components/mirror-mode/StudioConsentModal";
import CodingReviewPanel from "./coding-review/CodingReviewPanel";
import TravisReminderPanel from "./travis-reminders/TravisReminderPanel";

type AcademicWorkspaceView =
  | "dashboard"
  | "agenda"
  | "paper-workflow"
  | "assignments"
  | "syllabi"
  | "math-mode"
  | "coding-review";

function normalizeWorkspace(value: string | null): AcademicWorkspaceView {
  switch (value) {
    case "paper-workflow":
    case "agenda":
    case "assignments":
    case "syllabi":
    case "math-mode":
    case "coding-review":
      return value;
    case "syllabus-review":
      return "syllabi";
    default:
      return "dashboard";
  }
}

const workspaceConfig: Record<
  AcademicWorkspaceView,
  { title: string; description: string }
> = {
  dashboard: {
    title: "Dashboard",
    description: "Orientation for workload and immediate priorities.",
  },
  agenda: {
    title: "Agenda",
    description: "Execution workspace for calendar, tasks, and Travis planning.",
  },
  "paper-workflow": {
    title: "Paper workflow",
    description: "Outline, generate, checkpoint, export.",
  },
  assignments: {
    title: "Assignments",
    description: "Unified assignment view across all syllabi.",
  },
  syllabi: {
    title: "Syllabi",
    description: "Uploaded syllabus versions and publish controls.",
  },
  "math-mode": {
    title: "Math mode",
    description: "Step-by-step math verification workspace.",
  },
  "coding-review": {
    title: "Coding review",
    description: "Run code, see output, and get Victor’s review.",
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
  const { mode, setMode } = useVictorChat();
  const searchParams = useSearchParams();
  const initialWorkspace = normalizeWorkspace(searchParams.get("workspace"));
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentRecorded, setConsentRecorded] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [agendaBadgeCount, setAgendaBadgeCount] = useState(0);
  const [workspaceState, setWorkspaceState] = useState<{
    currentView: AcademicWorkspaceView;
    history: AcademicWorkspaceView[];
  }>({
    currentView: initialWorkspace,
    history: [initialWorkspace],
  });

  useEffect(() => {
    const rawWorkspace = searchParams.get("workspace");
    if (rawWorkspace === "study-materials") {
      window.location.href = "/academic/study-hub?tab=ingest";
      return;
    }
    if (rawWorkspace === "study-library") {
      window.location.href = "/academic/study-hub?tab=library";
      return;
    }
    const workspace = normalizeWorkspace(rawWorkspace);
    if (workspace) {
      setWorkspaceState((prev) => {
        if (workspace === prev.currentView) return prev;
        return {
          currentView: workspace,
          history: [...prev.history.slice(-9), workspace],
        };
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (workspaceState.currentView === "coding-review") {
      setMode("coding_review");
    } else if (mode === "coding_review") {
      setMode("default");
    }
  }, [workspaceState.currentView, mode, setMode]);

  useEffect(() => {
    setIsFirstTime(true);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/mirror-mode/consent?studio=academic")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setConsentRecorded(Boolean(data?.consented));
        setConsentChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setConsentChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem("academic-tour-dismissed") === "true";
    if (dismissed) {
      setTourCompleted(true);
    }
  }, []);

  useEffect(() => {
    if (!consentChecked) return;
    if (consentRecorded) {
      setShowConsent(false);
      return;
    }
    const shouldBlockForTour = isFirstTime && !tourCompleted;
    setShowConsent(!shouldBlockForTour);
  }, [consentChecked, consentRecorded, isFirstTime, tourCompleted]);

  useEffect(() => {
    type RiskAssignment = { is_at_risk?: boolean; status?: string | null };
    let active = true;
    fetch("/api/travis/assignments/all?status=active")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const assignments = Array.isArray(data?.assignments) ? data.assignments : [];
        const count = assignments.filter(
          (assignment: RiskAssignment) =>
            Boolean(assignment?.is_at_risk) &&
            assignment?.status !== "submitted" &&
            assignment?.status !== "completed"
        ).length;
        setAgendaBadgeCount(count);
      })
      .catch(() => {
        if (!active) return;
        setAgendaBadgeCount(0);
      });
    return () => {
      active = false;
    };
  }, [workspaceState.currentView]);

  const handleConsentAcknowledge = () => {
    fetch("/api/mirror-mode/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studio: "academic" }),
    })
      .then(() => setShowConsent(false))
      .catch(() => setShowConsent(false));
  };

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
      case "agenda":
        return <AcademicAgendaShell />;
      case "assignments":
        return <AssignmentsWorkspace />;
      case "syllabi":
        return <SyllabiWorkspace />;
      case "math-mode":
        return (
          <MathModeContainer />
        );
      case "coding-review":
        return (
          <div className="text-slate-300">
            Coding review is active in the center panel.
          </div>
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
  const isMathWorkspace = workspaceState.currentView === "math-mode";
  const showVictorSidebar =
    !isMathWorkspace && workspaceState.currentView === "paper-workflow";
  const showRightRail =
    !isMathWorkspace &&
    workspaceState.currentView !== "dashboard" &&
    workspaceState.currentView !== "agenda";

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
      {consentChecked && showConsent ? (
        <StudioConsentModal
          studioLabel="Academic Studio"
          onAcknowledge={handleConsentAcknowledge}
        />
      ) : null}
      {/* Sky background layer */}
      <div className="sky-layer">
        <div className="stars" />
        <div className="nebula-glow" />
      </div>

      {!isMathWorkspace && (
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
      )}

      <div
        className={`academic-unified-layout mx-auto w-full max-w-[1600px] ${
          isMathWorkspace
            ? "mt-2 min-h-[calc(100vh-16px)] lg:mt-2 lg:h-[calc(100vh-16px)] lg:min-h-[calc(100vh-16px)]"
            : ""
        }`}
      >
          {!isMathWorkspace && (
          <aside className="academic-unified-panel academic-unified-left">
            <div className="academic-panel-scroll p-5 overflow-hidden">
              {showVictorSidebar ? (
                <VictorSidebar
                  workspaceContext={workspaceContext}
                  onWorkspaceSwitch={switchWorkspace}
                />
              ) : (
                <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-slate-300">
                  <p className="text-sm font-semibold text-slate-100">Workspace focus</p>
                  <p className="text-xs text-slate-400">
                    Victor is available in Paper Workflow as your Academic Coach.
                  </p>
                </div>
              )}
            </div>
          </aside>
          )}

          {mode === "coding_review" ? (
            <section className="academic-unified-panel academic-unified-center">
              <div className="academic-panel-scroll p-0">
                <div className="h-full min-h-0">
                  <CodingReviewPanel />
                </div>
              </div>
            </section>
          ) : (
            <>
              <section
                className={`academic-unified-panel academic-unified-center ${
                  isMathWorkspace ? "col-span-2" : ""
                }`}
              >
                {!isMathWorkspace && (
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
                    <div className="w-full space-y-2 text-xs text-slate-300">
                      <div className="flex w-full flex-wrap items-center gap-2">
                        {[
                          { id: "dashboard", label: "Dashboard", type: "workspace" as const },
                          { id: "agenda", label: "Agenda", type: "route" as const, href: "/academic/agenda" },
                          { id: "assignments", label: "Assignments", type: "route" as const, href: "/academic/assignments" },
                          { id: "syllabi", label: "Syllabi", type: "route" as const, href: "/academic/syllabi" },
                        ].map((item) => {
                          const isActive = workspaceState.currentView === item.id;
                          const className = `rounded-full border px-4 py-2 transition ${
                            isActive
                              ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                              : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                          }`;

                          if (item.type === "route") {
                            return (
                              <Link
                                key={item.id}
                                href={item.href}
                                className={`${className} inline-flex items-center gap-1.5`}
                                onClick={() => setAgendaBadgeCount(0)}
                              >
                                <span>{item.label}</span>
                                {item.id === "agenda" && agendaBadgeCount > 0 ? (
                                  <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] leading-none text-amber-100">
                                    {agendaBadgeCount}
                                  </span>
                                ) : null}
                              </Link>
                            );
                          }

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                switchWorkspace(item.id as AcademicWorkspaceView)
                              }
                              className={className}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2">
                        {[
                          { id: "paper-workflow", label: "Paper workflow", type: "workspace" as const },
                          { id: "study-hub", label: "Study Hub", type: "route" as const, href: "/academic/study-hub?tab=library" },
                          { id: "math-mode", label: "Math mode", type: "workspace" as const },
                          { id: "coding-review", label: "Coding review", type: "workspace" as const },
                        ].map((item) => {
                        const isActive = item.type === "workspace" && workspaceState.currentView === item.id;
                        const className = `rounded-full border px-4 py-2 transition ${
                          isActive
                            ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                        }`;
                        if (item.type === "route") {
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              className={className}
                            >
                              {item.label}
                            </Link>
                          );
                        }
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              switchWorkspace(item.id as AcademicWorkspaceView)
                            }
                            className={className}
                          >
                            {item.label}
                          </button>
                        );
                        })}
                      </div>
                    </div>
                  </header>
                )}
                <div
                  className={`academic-panel-scroll ${
                    isMathWorkspace ? "overflow-hidden p-0" : "p-5"
                  }`}
                >
                  {renderWorkspace()}
                </div>
              </section>

              {showRightRail && (
                <aside className="academic-unified-panel academic-unified-right">
                  <div className="academic-panel-scroll p-5">
                    <AcademicContextPanel view={workspaceState.currentView} />
                  </div>
                </aside>
              )}
            </>
          )}
        </div>

      <AcademicStudioTour
        isFirstTime={isFirstTime && workspaceState.currentView === "dashboard"}
        onComplete={() => setTourCompleted(true)}
        onStartPaperWorkflow={() => switchWorkspace("paper-workflow")}
      />
      <TravisReminderPanel />
    </div>
  );
}
