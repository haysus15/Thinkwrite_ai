"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import { useSearchParams } from "next/navigation";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import PaperWorkflowHome from "@/components/academic-studio/paper-workflow/PaperWorkflowHome";
import PaperWorkflowContainer from "@/components/academic-studio/paper-workflow/PaperWorkflowContainer";
import { VictorChatProvider } from "@/components/academic-studio/victor-chat/VictorChatContext";
import PaperWorkflowErrorBoundary from "@/components/academic-studio/paper-workflow/PaperWorkflowErrorBoundary";

export const dynamic = "force-dynamic";

export default function AcademicPaperWorkflowPage() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");
  const initialPaperId = searchParams.get("paperId");
  const setContextId = searchParams.get("setId");
  const showLegacyEditor = Boolean(assignmentId || initialPaperId || setContextId);

  if (loading) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="sky-layer"><div className="stars" /><div className="nebula-glow" /></div>
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <AcademicLoadingState message="Loading paper workflow..." />
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
            description="Sign in to open paper workflow."
            action={{
              label: "Sign In",
              onClick: () => {
                window.location.href = getAuthRequiredUrl("/academic/paper-workflow");
              },
            }}
            className="max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md"
          />
        </div>
      </div>
    );
  }

  return (
    <AcademicPageShell active="paper-workflow" agendaBadgeCount={0}>
      <VictorChatProvider>
        {showLegacyEditor ? (
          <PaperWorkflowErrorBoundary>
            <PaperWorkflowContainer
              initialPaperId={initialPaperId}
              setContextId={setContextId}
            />
          </PaperWorkflowErrorBoundary>
        ) : (
          <PaperWorkflowHome />
        )}
      </VictorChatProvider>
    </AcademicPageShell>
  );
}
