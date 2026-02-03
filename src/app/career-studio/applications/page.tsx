// Applications Redirect
// src/app/career-studio/applications/page.tsx

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CareerStudioShell from '@/components/career-studio/CareerStudioShell';
import CareerStudioSpinner from '@/components/career-studio/CareerStudioSpinner';

export default function ApplicationsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = '/career-studio/dashboard?workspace=applications';
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
