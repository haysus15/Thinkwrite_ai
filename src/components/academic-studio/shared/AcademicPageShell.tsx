"use client";

import type { CSSProperties, ReactNode } from "react";

type Props = {
  active:
    | "dashboard"
    | "agenda"
    | "assignments"
    | "syllabi"
    | "paper-workflow"
    | "study-hub"
    | "math-mode"
    | "coding-review";
  agendaBadgeCount?: number;
  children: ReactNode;
};

export default function AcademicPageShell({
  active: _active,
  agendaBadgeCount: _agendaBadgeCount = 0,
  children,
}: Props) {
  return (
    <div
      className="text-slate-100"
      style={
        {
          "--academic-primary": "#3B82F6",
          "--academic-primary-dark": "#1E40AF",
          "--victor-accent": "#0EA5E9",
          "--travis-accent": "#14B8A6",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
