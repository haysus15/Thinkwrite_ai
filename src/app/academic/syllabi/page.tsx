"use client";

import { useEffect, useState } from "react";
import SyllabiWorkspace from "@/components/academic-studio/workspace/SyllabiWorkspace";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";

export const dynamic = "force-dynamic";

export default function AcademicSyllabiPage() {
  const { user, loading } = useAuth();
  const [agendaBadgeCount, setAgendaBadgeCount] = useState(0);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="sky-layer">
          <div className="stars" />
          <div className="nebula-glow" />
        </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <AcademicLoadingState message="Loading syllabi..." />
      </div>
    </div>
  );
  }

  if (!user) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="sky-layer">
          <div className="stars" />
          <div className="nebula-glow" />
        </div>
        <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
          <AcademicEmptyState
            title="Authentication required"
            description="Sign in to open your syllabi."
            action={{
              label: "Sign In",
              onClick: () => {
                window.location.href = getAuthRequiredUrl("/academic/syllabi");
              },
            }}
            className="max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md"
          />
        </div>
      </div>
    );
  }

  return (
    <AcademicPageShell active="syllabi" agendaBadgeCount={agendaBadgeCount}>
      <SyllabiWorkspace />
    </AcademicPageShell>
  );
}
  type RiskAssignment = { is_at_risk?: boolean; status?: string | null };
