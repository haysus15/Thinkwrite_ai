"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import StudyHub from "@/components/academic/study-hub/StudyHub";

export const dynamic = "force-dynamic";

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <AcademicLoadingState message="Loading Study Hub..." className="!min-h-0 border-0 bg-transparent py-0" />
    </div>
  );
}

export default function StudyHubPage() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState />;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <AcademicEmptyState
          title="Authentication required"
          description="Sign in to access your study hub."
          action={{
            label: "Sign In",
            onClick: () => {
              window.location.href = getAuthRequiredUrl("/academic/study-hub");
            },
          }}
          className="max-w-md border-0 bg-transparent"
        />
      </div>
    );
  }

  return (
    <AcademicPageShell active="study-hub" agendaBadgeCount={0}>
      <StudyHub />
    </AcademicPageShell>
  );
}
