// Cover Letter Redirect
// src/app/career-studio/cover-letter/page.tsx

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CareerStudioShell from '@/components/career-studio/CareerStudioShell';
import CareerStudioSpinner from '@/components/career-studio/CareerStudioSpinner';

export default function CoverLetterRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Preserve any existing query params
    const jobId = searchParams.get('jobAnalysisId') || searchParams.get('jobId');
    const resumeId = searchParams.get('resumeId');

    let url = '/career-studio/dashboard?workspace=cover-letter';
    if (jobId) url += `&jobId=${jobId}`;
    if (resumeId) url += `&resumeId=${resumeId}`;

    router.replace(url);
  }, [router, searchParams]);

  return (
    <CareerStudioShell>
      <div className="career-panel flex-1 flex items-center justify-center p-6">
        <CareerStudioSpinner label="Redirecting..." />
      </div>
    </CareerStudioShell>
  );
}
