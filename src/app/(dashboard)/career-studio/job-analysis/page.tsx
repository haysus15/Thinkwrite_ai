"use client";

import React, { Suspense } from "react";
import JobAnalysisInterface from "@/components/career-studio/job-analysis/JobAnalysisInterface";
import CareerStudioShell from "@/components/career-studio/CareerStudioShell";
import CareerStudioSpinner from "@/components/career-studio/CareerStudioSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";

function LoadingState() {
  return (
    <CareerStudioShell>
      <div className="career-panel flex-1 flex items-center justify-center p-6">
        <CareerStudioSpinner label="Loading Job Analysis..." />
      </div>
    </CareerStudioShell>
  );
}

function JobAnalysisContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState />;
  }

  if (!user) {
    return (
      <CareerStudioShell>
        <div className="career-panel flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md text-white">
            <div className="w-16 h-16 rounded-full border border-white/20 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Authentication Required</h2>
            <p className="text-white/60 mb-4">Please sign in to access Job Analysis.</p>
            <a
              href={getAuthRequiredUrl("/career-studio/job-analysis")}
              className="inline-block px-6 py-3 bg-[#EAAA00] text-black font-semibold rounded-lg hover:bg-[#d49b00] transition-colors"
            >
              Sign In
            </a>
          </div>
        </div>
      </CareerStudioShell>
    );
  }

  return <JobAnalysisInterface />;
}

export default function JobAnalysisPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <JobAnalysisContent />
    </Suspense>
  );
}
