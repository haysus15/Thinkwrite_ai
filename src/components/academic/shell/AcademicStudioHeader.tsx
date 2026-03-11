"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademicShellData } from "./AcademicShellDataContext";
import { useNavigationGuard } from "./useNavigationGuard";

const SECTION_NAMES: Record<string, string> = {
  "/academic": "Dashboard",
  "/academic/dashboard": "Dashboard",
  "/academic/paper": "Paper Workflow",
  "/academic/paper-workflow": "Paper Workflow",
  "/academic/study-hub": "Study Hub",
  "/academic/agenda": "Agenda",
  "/academic/math": "Math Mode",
  "/academic/math-mode": "Math Mode",
  "/academic/assignments": "Assignments",
  "/academic/syllabi": "Syllabi",
  "/academic/code-review": "Coding Review",
  "/academic/coding-review": "Coding Review",
  "/academic/quiz": "Quiz",
};

function sectionNameForPath(pathname: string): string {
  const match = Object.keys(SECTION_NAMES)
    .sort((a, b) => b.length - a.length)
    .find((key) => pathname === key || pathname.startsWith(`${key}/`));
  return match ? SECTION_NAMES[match] : "Academic Studio";
}

function initialsFromEmail(email: string | undefined): string {
  if (!email) return "U";
  const local = email.split("@")[0] || "";
  const parts = local.split(/[._-]/g).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (local.slice(0, 2) || "U").toUpperCase();
}

async function saveBeforeNavigateEvent(): Promise<void> {
  if (typeof window === "undefined") return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    window.dispatchEvent(
      new CustomEvent("academic:save-before-nav", {
        detail: { done },
      })
    );

    window.setTimeout(done, 1200);
  });
}

export default function AcademicStudioHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { academicConfidence } = useAcademicShellData();
  const sectionName = useMemo(() => sectionNameForPath(pathname), [pathname]);
  const avatarInitials = useMemo(() => initialsFromEmail(user?.email), [user?.email]);
  const { isSaving, runWithGuard } = useNavigationGuard(false, saveBeforeNavigateEvent);

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-white/10 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-4 px-5">
        <Link
          href="/select-studio"
          onClick={(event) => {
            event.preventDefault();
            void runWithGuard(() => router.push("/select-studio"));
          }}
          className="inline-flex min-w-[220px] items-center gap-2 text-sm text-slate-300 transition hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Select Studio</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-200">Academic Studio</span>
          {isSaving ? <span className="text-xs text-slate-400">Saving...</span> : null}
        </Link>

        <div className="truncate text-sm font-semibold text-slate-100">{sectionName}</div>

        <div className="flex min-w-[180px] items-center justify-end gap-3">
          <div className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-200">
            Academic chamber{" "}
            <span className="font-semibold text-indigo-300">
              {academicConfidence === null ? "--" : `${academicConfidence}%`}
            </span>
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-slate-800 text-xs font-semibold text-slate-100"
            aria-label="Account avatar"
            title={user?.email || "Account"}
          >
            {avatarInitials}
          </div>
        </div>
      </div>
    </header>
  );
}
