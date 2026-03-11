"use client";

import { Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import { useParams, useSearchParams } from "next/navigation";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import PaperWorkflowContainer from "@/components/academic-studio/paper-workflow/PaperWorkflowContainer";
import PaperWorkflowErrorBoundary from "@/components/academic-studio/paper-workflow/PaperWorkflowErrorBoundary";
import { VictorChatProvider } from "@/components/academic-studio/victor-chat/VictorChatContext";

export default function AcademicPaperEditorPage() {
  return (
    <Suspense fallback={<AcademicPaperEditorPageFallback />}>
      <AcademicPaperEditorPageContent />
    </Suspense>
  );
}

function AcademicPaperEditorPageContent() {
  const { user, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const paperId = params?.id || "new";
  const setId = searchParams.get("setId");

  if (loading) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <AcademicLoadingState message="Loading paper workflow..." />
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
            description="Sign in to open paper workflow."
            action={{
              label: "Sign In",
              onClick: () => {
                window.location.href = getAuthRequiredUrl("/academic/paper-workflow");
              },
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <AcademicPageShell active="paper-workflow" agendaBadgeCount={0}>
      <VictorChatProvider>
        <PaperWorkflowErrorBoundary>
          <PaperWorkflowContainer
            initialPaperId={paperId === "new" ? null : paperId}
            setContextId={setId || null}
          />
        </PaperWorkflowErrorBoundary>
      </VictorChatProvider>
    </AcademicPageShell>
  );
}

function AcademicPaperEditorPageFallback() {
  return (
    <div className="academic-studio-root min-h-screen text-slate-100">
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <AcademicLoadingState message="Loading paper workflow..." />
      </div>
    </div>
  );
}
