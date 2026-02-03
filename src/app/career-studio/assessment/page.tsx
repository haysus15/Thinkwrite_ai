// Assessment Redirect
// src/app/career-studio/assessment/page.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CareerStudioShell from '@/components/career-studio/CareerStudioShell';
import CareerStudioSpinner from '@/components/career-studio/CareerStudioSpinner';

export default function AssessmentRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/career-studio/dashboard?workspace=assessment');
  }, [router]);

  return (
    <CareerStudioShell>
      <div className="career-panel flex-1 flex items-center justify-center p-6">
        <CareerStudioSpinner label="Redirecting..." />
      </div>
    </CareerStudioShell>
  );
}
