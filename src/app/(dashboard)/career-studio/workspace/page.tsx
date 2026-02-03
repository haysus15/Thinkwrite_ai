// src/app/(dashboard)/career-studio/workspace/page.tsx
'use client';

import { Suspense } from 'react';
import UnifiedCareerStudio from '@/components/career-studio/unified/UnifiedCareerStudio';
import CareerStudioSpinner from '@/components/career-studio/CareerStudioSpinner';

export default function CareerStudioWorkspacePage() {
  return (
    <Suspense fallback={<CareerStudioSpinner />}>
      <UnifiedCareerStudio />
    </Suspense>
  );
}
