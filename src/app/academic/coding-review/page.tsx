"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import CodingReviewPanel from "@/components/academic-studio/coding-review/CodingReviewPanel";
import { VictorChatProvider } from "@/components/academic-studio/victor-chat/VictorChatContext";

export const dynamic = "force-dynamic";

export default function AcademicCodingReviewPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="sky-layer"><div className="stars" /><div className="nebula-glow" /></div>
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <AcademicLoadingState message="Loading coding review..." />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="sky-layer"><div className="stars" /><div className="nebula-glow" /></div>
        <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
          <AcademicEmptyState
            title="Authentication required"
            description="Sign in to open coding review."
            action={{
              label: "Sign In",
              onClick: () => {
                window.location.href = getAuthRequiredUrl("/academic/coding-review");
              },
            }}
            className="max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md"
          />
        </div>
      </div>
    );
  }

  return (
    <AcademicPageShell active="coding-review" agendaBadgeCount={0}>
      <VictorChatProvider>
        <CodingReviewPanel />
      </VictorChatProvider>
    </AcademicPageShell>
  );
}
