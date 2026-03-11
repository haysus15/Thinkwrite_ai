"use client";

import AcademicDashboard from "@/components/academic-studio/workspace/AcademicDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";

export const dynamic = "force-dynamic";

function LoadingState() {
  return (
    <div className="relative z-10 flex min-h-[calc(100vh-104px)] items-center justify-center px-6">
      <AcademicLoadingState message="Loading dashboard..." />
    </div>
  );
}

export default function AcademicRootPage() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;

  if (!user) {
    return (
      <div className="relative z-10 flex min-h-[calc(100vh-104px)] items-center justify-center p-6">
        <AcademicEmptyState
          title="Authentication required"
          description="Sign in to open your dashboard."
          action={{
            label: "Sign In",
            onClick: () => {
              window.location.href = getAuthRequiredUrl("/academic");
            },
          }}
          className="max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md"
        />
      </div>
    );
  }

  return <AcademicDashboard onNavigate={() => undefined} />;
}
