// src/components/academic-studio/workspace/AssignmentsWorkspace.tsx
"use client";

import TravisSidebar from "../travis-sidebar/TravisSidebar";

export default function AssignmentsWorkspace() {
  return (
    <div className="space-y-6">
      <div className="academic-nested-card rounded-2xl p-6">
        <p className="text-sm font-semibold text-slate-100">
          Assignment control center
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Track deadlines, upload syllabi, and launch paper workflows.
        </p>
      </div>
      <div className="academic-nested-card rounded-2xl p-6">
        <TravisSidebar />
      </div>
    </div>
  );
}
