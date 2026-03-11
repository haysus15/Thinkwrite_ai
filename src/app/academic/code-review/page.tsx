"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import { useSearchParams } from "next/navigation";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import CodingReviewPanel from "@/components/academic-studio/coding-review/CodingReviewPanel";
import CodeReviewHome from "@/components/academic-studio/coding-review/CodeReviewHome";
import { VictorChatProvider } from "@/components/academic-studio/victor-chat/VictorChatContext";

export const dynamic = "force-dynamic";

export default function AcademicCodeReviewPage() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");
  const reviewId = searchParams.get("reviewId");
  const setId = searchParams.get("setId");
  const showLegacyEditor = Boolean(assignmentId || reviewId || setId);

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
                window.location.href = getAuthRequiredUrl("/academic/code-review");
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
        {showLegacyEditor ? (
          <CodingReviewPanel initialReviewId={reviewId} setContextId={setId} />
        ) : (
          <CodeReviewHome />
        )}
      </VictorChatProvider>
    </AcademicPageShell>
  );
}
