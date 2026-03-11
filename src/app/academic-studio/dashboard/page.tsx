// Legacy route retained for backwards compatibility.
// Canonical routes: /academic/dashboard and /academic/*
import { redirect } from "next/navigation";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeWorkspace(raw: string | null): string {
  if (!raw) return "";
  return raw.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function resolveLegacyWorkspace(rawWorkspace: string | null): string {
  const workspace = normalizeWorkspace(rawWorkspace);
  if (!workspace || workspace === "dashboard" || workspace === "agenda") {
    return workspace === "agenda" ? "/academic/agenda" : "/academic/dashboard";
  }
  if (workspace === "assignments") return "/academic/assignments";
  if (workspace === "syllabi" || workspace === "syllabus") return "/academic/syllabi";
  if (workspace === "paper-workflow" || workspace === "paperworkflow") {
    return "/academic/paper-workflow";
  }
  if (workspace === "coding-review" || workspace === "codingreview") {
    return "/academic/coding-review";
  }
  if (workspace === "math-mode" || workspace === "mathmode") {
    return "/academic/math-mode";
  }
  if (workspace === "study-hub" || workspace === "study-library") {
    return "/academic/study-hub?tab=library";
  }
  if (workspace === "study-materials") {
    return "/academic/study-hub?tab=ingest";
  }
  return "/academic/dashboard";
}

export default async function AcademicStudioDashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const workspaceParam = params.workspace;
  const workspaceValue = Array.isArray(workspaceParam) ? workspaceParam[0] : workspaceParam ?? null;
  redirect(resolveLegacyWorkspace(workspaceValue));
}
