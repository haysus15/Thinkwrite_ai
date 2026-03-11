"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import { useParams } from "next/navigation";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import { VictorChatProvider } from "@/components/academic-studio/victor-chat/VictorChatContext";
import AssignmentSetView from "@/components/academic-studio/paper-workflow/AssignmentSetView";

export default function AcademicPaperSetPage() {
  const { user, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const setId = params?.id || "";

  if (loading) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <AcademicLoadingState message="Loading assignment set..." />
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
            description="Sign in to open assignment sets."
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
        <AssignmentSetView setId={setId} />
      </VictorChatProvider>
    </AcademicPageShell>
  );
}
