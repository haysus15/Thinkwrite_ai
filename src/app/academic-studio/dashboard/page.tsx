// Academic Studio Dashboard
// src/app/academic-studio/dashboard/page.tsx
"use client";

import AcademicStudioContainer from "@/components/academic-studio/AcademicStudioContainer";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";

export const dynamic = "force-dynamic";

function LoadingState() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-white/60">Loading Academic Studio...</p>
      </div>
    </div>
  );
}

export default function AcademicStudioDashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full border border-white/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Authentication required
          </h2>
          <p className="text-white/60 mb-4">
            Sign in to access Academic Studio.
          </p>
          <a
            href={getAuthRequiredUrl("/academic-studio/dashboard")}
            className="inline-block px-6 py-3 bg-blue-500 text-black font-semibold rounded-lg hover:bg-blue-400 transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return <AcademicStudioContainer />;
}
