"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import { useParams, useSearchParams } from "next/navigation";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import CodingReviewPanel from "@/components/academic-studio/coding-review/CodingReviewPanel";
import { VictorChatProvider } from "@/components/academic-studio/victor-chat/VictorChatContext";

export default function AcademicCodeReviewEditorPage() {
  const { user, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const reviewId = params?.id || "new";
  const setId = searchParams.get("setId");

  if (loading) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <AcademicLoadingState message="Loading coding review..." />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
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
          />
        </div>
      </div>
    );
  }

  return (
    <AcademicPageShell active="coding-review" agendaBadgeCount={0}>
      <VictorChatProvider>
        <CodingReviewPanel
          initialReviewId={reviewId === "new" ? null : reviewId}
          setContextId={setId || null}
        />
      </VictorChatProvider>
    </AcademicPageShell>
  );
}
