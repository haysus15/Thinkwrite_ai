// Lex Redirect
// src/app/career-studio/lex/page.tsx

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CareerStudioShell from '@/components/career-studio/CareerStudioShell';
import CareerStudioSpinner from '@/components/career-studio/CareerStudioSpinner';

export default function LexRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Map Lex modes to workspace views
    const mode = searchParams.get('mode');

    const modeToWorkspace: Record<string, string> = {
      'career-assessment': 'assessment',
      'resume-tailoring': 'tailor',
      'cover-letter': 'cover-letter',
      'job-discussion': 'job-analysis',
      'match-analysis': 'job-analysis',
      'general': 'dashboard'
    };

    const workspace = mode ? (modeToWorkspace[mode] || 'dashboard') : 'dashboard';
    router.replace(`/career-studio/dashboard?workspace=${workspace}`);
  }, [router, searchParams]);

  return (
    <CareerStudioShell>
      <div className="career-panel flex-1 flex items-center justify-center p-6">
        <CareerStudioSpinner label="Redirecting..." />
      </div>
    </CareerStudioShell>
  );
}
