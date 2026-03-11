"use client";

import { Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import { useParams, useSearchParams } from "next/navigation";
import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import AcademicLoadingState from "@/components/academic-studio/shared/AcademicLoadingState";
import AcademicPageShell from "@/components/academic-studio/shared/AcademicPageShell";
import { VictorChatProvider } from "@/components/academic-studio/victor-chat/VictorChatContext";
import MathModeContainer from "@/components/academic-studio/math-mode/MathModeContainer";

export default function AcademicMathProblemPage() {
  return (
    <Suspense fallback={<AcademicMathProblemPageFallback />}>
      <AcademicMathProblemPageContent />
    </Suspense>
  );
}

function AcademicMathProblemPageContent() {
  const { user, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const problemId = params?.id || "";
  const setId = searchParams.get("setId");
  const debrief = searchParams.get("debrief");

  if (loading) {
    return (
      <div className="academic-studio-root min-h-screen text-slate-100">
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <AcademicLoadingState message="Loading problem..." />
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
            description="Sign in to open Math Mode."
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
        <MathModeContainer
          initialProblemId={problemId === "new" ? null : problemId}
          setContextId={setId || null}
          autoSetDebrief={debrief === "set"}
        />
      </VictorChatProvider>
    </AcademicPageShell>
  );
}

function AcademicMathProblemPageFallback() {
  return (
    <div className="academic-studio-root min-h-screen text-slate-100">
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <AcademicLoadingState message="Loading problem..." />
      </div>
    </div>
  );
}
