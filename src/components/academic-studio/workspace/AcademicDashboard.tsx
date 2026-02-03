// src/components/academic-studio/workspace/AcademicDashboard.tsx
"use client";

import { BookOpen, FileText, GraduationCap, Layers, ListChecks } from "lucide-react";

type AcademicWorkspaceView =
  | "dashboard"
  | "paper-workflow"
  | "study-materials"
  | "study-library"
  | "assignments"
  | "math-mode";

const featureCards: Array<{
  id: AcademicWorkspaceView;
  title: string;
  description: string;
  icon: typeof BookOpen;
}> = [
  {
    id: "paper-workflow",
    title: "Paper workflow",
    description: "Outline, generate, checkpoint, export.",
    icon: FileText,
  },
  {
    id: "study-materials",
    title: "Study materials",
    description: "Upload guides and build quizzes.",
    icon: BookOpen,
  },
  {
    id: "study-library",
    title: "Study library",
    description: "Review materials and quiz history.",
    icon: Layers,
  },
  {
    id: "assignments",
    title: "Assignments",
    description: "Deadlines, requirements, and syllabus parsing.",
    icon: ListChecks,
  },
  {
    id: "math-mode",
    title: "Math mode",
    description: "Step-by-step verification workspace.",
    icon: GraduationCap,
  },
];

export default function AcademicDashboard({
  onNavigate,
}: {
  onNavigate: (view: AcademicWorkspaceView) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="academic-nested-card rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-sky-300" />
          <p className="text-sm font-semibold text-slate-100">
            Academic dashboard
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Choose where to focus. Victor is ready to challenge your thinking and
          Travis will keep the requirements tight.
        </p>
      </div>

      <div className="academic-nested-card rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-200">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Victor chat</p>
            <p className="mt-1 text-xs text-slate-400">
              Always available in the left panel.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {featureCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.id)}
              className="academic-nested-card-interactive rounded-2xl p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-200">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    {card.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {card.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
