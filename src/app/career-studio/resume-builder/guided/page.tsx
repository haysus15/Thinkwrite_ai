// Guided Resume Builder Redirect (use unified dashboard instead)
// src/app/career-studio/resume-builder/guided/page.tsx

'use client';

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CareerStudioShell from "@/components/career-studio/CareerStudioShell";
import CareerStudioSpinner from "@/components/career-studio/CareerStudioSpinner";

export default function GuidedResumeBuilderRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const draftId = searchParams.get("draft");
    let url = "/career-studio/dashboard?workspace=resume-builder";
    if (draftId) {
      url += `&resumeId=${encodeURIComponent(draftId)}`;
    }
    router.replace(url);
  }, [router, searchParams]);

  return (
    <CareerStudioShell>
      <div className="career-panel flex-1 flex items-center justify-center p-6">
        <CareerStudioSpinner label="Redirecting to Resume Builder..." />
      </div>
    </CareerStudioShell>
  );
}
