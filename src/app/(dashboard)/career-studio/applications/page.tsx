// src/app/(dashboard)/career-studio/applications/page.tsx
'use client';

import { redirect } from 'next/navigation';

export default function CareerStudioApplicationsRedirect() {
  redirect('/career-studio/workspace?workspace=applications');
}
