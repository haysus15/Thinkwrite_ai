"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import { useParams } from "next/navigation";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import { VictorChatProvider } from "@/components/academic-studio/victor-chat/VictorChatContext";
import SetView from "@/components/academic-studio/math-mode/SetView";

export default function AcademicMathSetPage() {
  const { user, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const setId = params?.id || "";

  if (loading) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <AcademicLoadingState message="Loading worksheet..." />
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
            description="Sign in to open worksheet sets."
            action={{
              label: "Sign In",
              onClick: () => {
                window.location.href = getAuthRequiredUrl("/academic/math-mode");
              },
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <AcademicPageShell active="math-mode" agendaBadgeCount={0}>
      <VictorChatProvider>
        <SetView setId={setId} />
      </VictorChatProvider>
    </AcademicPageShell>
  );
}
