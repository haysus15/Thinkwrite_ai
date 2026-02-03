// Career Studio Dashboard Page - Unified Interface
// src/app/career-studio/dashboard/page.tsx

'use client';

import { Suspense } from 'react';
import UnifiedCareerStudio from '@/components/career-studio/unified/UnifiedCareerStudio';
import CareerStudioShell from '@/components/career-studio/CareerStudioShell';
import CareerStudioSpinner from '@/components/career-studio/CareerStudioSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthRequiredUrl } from '@/lib/auth/redirects';

export const dynamic = 'force-dynamic';

function LoadingShell() {
  return (
    <CareerStudioShell>
      <div className="career-panel flex-1 flex items-center justify-center p-6">
        <CareerStudioSpinner label="Loading Career Studio..." sizeClassName="w-8 h-8" />
      </div>
    </CareerStudioShell>
  );
}

export default function CareerStudioDashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingShell />;
  }

  if (!user) {
    return (
      <CareerStudioShell>
        <div className="career-panel flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md text-white">
            <div className="w-16 h-16 rounded-full border border-white/20 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Authentication required</h2>
            <p className="text-white/60 mb-4">Sign in to access Career Studio.</p>
            <a
              href={getAuthRequiredUrl("/career-studio/dashboard")}
              className="inline-block px-6 py-3 bg-[#9333EA] text-white font-semibold rounded-lg hover:bg-[#7E22CE] transition-colors"
            >
              Sign In
            </a>
          </div>
        </div>
      </CareerStudioShell>
    );
  }

  return (
    <Suspense fallback={<LoadingShell />}>
      <UnifiedCareerStudio />
    </Suspense>
  );
}
