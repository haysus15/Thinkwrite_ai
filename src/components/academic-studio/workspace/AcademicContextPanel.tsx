// src/components/academic-studio/workspace/AcademicContextPanel.tsx
"use client";

import { ClipboardCheck, ShieldCheck, Sparkles, Timer } from "lucide-react";
import TravisSidebar from "../travis-sidebar/TravisSidebar";

type AcademicWorkspaceView =
  | "dashboard"
  | "paper-workflow"
  | "study-materials"
  | "study-library"
  | "assignments"
  | "math-mode";

export default function AcademicContextPanel({
  view,
}: {
  view: AcademicWorkspaceView;
}) {
  switch (view) {
    case "paper-workflow":
      return <PaperWorkflowContextPanel />;
    case "study-materials":
      return <StudyMaterialsContextPanel />;
    case "study-library":
      return <StudyLibraryContextPanel />;
    case "assignments":
      return <AssignmentsContextPanel />;
    case "math-mode":
      return <MathModeContextPanel />;
    case "dashboard":
    default:
      return <TravisSidebar />;
  }
}

function PaperWorkflowContextPanel() {
  return (
    <div className="space-y-5">
      <div className="academic-nested-card rounded-xl p-5">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-teal-300" />
          <p className="text-sm font-semibold text-slate-100">
            Assignment requirements
          </p>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li className="rounded-lg border border-white/6 bg-white/3 px-4 py-3">
            Minimum length: 1500 words
          </li>
          <li className="rounded-lg border border-white/6 bg-white/3 px-4 py-3">
            Sources required: 5
          </li>
          <li className="rounded-lg border border-white/6 bg-white/3 px-4 py-3">
            Citation style: APA
          </li>
        </ul>
      </div>

      <div className="academic-nested-card rounded-xl p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-sky-300" />
          <p className="text-sm font-semibold text-slate-100">
            Integrity checkpoint
          </p>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Papers unlock only after the understanding check. No shortcuts.
        </p>
        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-3 text-sm text-sky-200 transition hover:bg-sky-500/25"
        >
          Review checkpoint rules
        </button>
      </div>
    </div>
  );
}

function StudyMaterialsContextPanel() {
  return (
    <div className="space-y-5">
      <div className="academic-nested-card rounded-xl p-5">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-sky-300" />
          <p className="text-sm font-semibold text-slate-100">
            Study focus
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Upload clean notes to get sharper quiz questions.
        </p>
      </div>
      <div className="academic-nested-card rounded-xl p-5">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-teal-300" />
          <p className="text-sm font-semibold text-slate-100">Reminder</p>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Victor in Study mode will quiz for understanding, not recall.
        </p>
      </div>
    </div>
  );
}

function StudyLibraryContextPanel() {
  return (
    <div className="space-y-5">
      <div className="academic-nested-card rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-100">
          Study library snapshot
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Review quizzes, check scores, and decide where to focus next.
        </p>
      </div>
      <div className="academic-nested-card rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-100">
          Next review
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Target weak topics before the next deadline.
        </p>
      </div>
    </div>
  );
}

function AssignmentsContextPanel() {
  return (
    <div className="space-y-5">
      <div className="academic-nested-card rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-100">
          Assignment focus
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Select an assignment to start the paper workflow in one step.
        </p>
      </div>
      <div className="academic-nested-card rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-100">
          Travis checks
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Deadlines and requirements stay locked until verified.
        </p>
      </div>
    </div>
  );
}

function MathModeContextPanel() {
  return (
    <div className="space-y-5">
      <div className="academic-nested-card rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-100">Math mode</p>
        <p className="mt-3 text-sm text-slate-400">
          Keep your steps explicit. Victor will check each transformation.
        </p>
      </div>
      <div className="academic-nested-card rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-100">Verification</p>
        <p className="mt-3 text-sm text-slate-400">
          Use Verify All once every step is written cleanly.
        </p>
      </div>
    </div>
  );
}
