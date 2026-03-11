"use client";

import Link from "next/link";

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
};

const primaryTabs = [
  { id: "dashboard", label: "Dashboard", href: "/academic/dashboard" },
  { id: "agenda", label: "Agenda", href: "/academic/agenda" },
  { id: "assignments", label: "Assignments", href: "/academic/assignments" },
  { id: "syllabi", label: "Syllabi", href: "/academic/syllabi" },
] as const;

const tools = [
  { id: "paper-workflow", label: "Paper Workflow", href: "/academic/paper-workflow" },
  { id: "study-hub", label: "Study Hub", href: "/academic/study-hub?tab=library" },
  { id: "math-mode", label: "Math Mode", href: "/academic/math-mode" },
  { id: "coding-review", label: "Coding Review", href: "/academic/coding-review" },
];

export default function AcademicTopNav({ active, agendaBadgeCount = 0 }: Props) {
  return (
    <div className="mb-5 space-y-2 text-xs text-slate-300">
      <div className="flex flex-wrap items-center gap-2">
        {primaryTabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 transition ${
                isActive
                  ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === "agenda" && agendaBadgeCount > 0 ? (
                <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] leading-none text-amber-100">
                  {agendaBadgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className={`rounded-full border px-4 py-2 transition ${
              tool.id === active
                ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {tool.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
