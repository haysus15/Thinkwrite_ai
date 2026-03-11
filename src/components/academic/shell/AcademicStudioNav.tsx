"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calculator,
  ClipboardList,
  Code2,
  FileText,
  Home,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAcademicShellData } from "./AcademicShellDataContext";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: "count" | "dot";
};

const STUDIO_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/academic", icon: Home },
  { label: "Assignments", href: "/academic/agenda", icon: ClipboardList, badge: "count" },
  { label: "Syllabi", href: "/academic/syllabi", icon: ScrollText },
  { label: "Paper", href: "/academic/paper", icon: FileText, badge: "dot" },
  { label: "Study Hub", href: "/academic/study-hub", icon: BookOpen },
  { label: "Math Mode", href: "/academic/math", icon: Calculator },
  { label: "Coding Review", href: "/academic/coding-review", icon: Code2 },
];

function isTabActive(href: string, pathname: string): boolean {
  if (href === "/academic") return pathname === "/academic" || pathname === "/academic/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function badgeLabel(value: number): string {
  return value > 99 ? "99+" : String(value);
}

export default function AcademicStudioNav() {
  const pathname = usePathname();
  const { assignmentsDueSoon, paperInProgress } = useAcademicShellData();

  const tabs = useMemo(
    () =>
      STUDIO_NAV_ITEMS.map((item) => ({
        ...item,
        active: isTabActive(item.href, pathname),
      })),
    [pathname]
  );

  return (
    <nav className="fixed inset-x-0 top-14 z-40 h-12 border-b border-white/10 bg-slate-900/95 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center gap-1 px-5">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative inline-flex h-full items-center gap-2 px-4 text-sm transition ${
              tab.active
                ? "border-b-2 border-b-indigo-400 text-slate-100"
                : "text-slate-300/60 hover:text-slate-100"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>

            {tab.badge === "count" && assignmentsDueSoon > 0 ? (
              <span className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
                {badgeLabel(assignmentsDueSoon)}
              </span>
            ) : null}

            {tab.badge === "dot" && paperInProgress ? (
              <span className="absolute right-1.5 top-2 h-2 w-2 rounded-full bg-indigo-500" />
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
