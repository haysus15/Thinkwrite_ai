// src/components/lex/hooks/useLexContext.ts
"use client";

import { useResumeContext } from "./useResumeContext";
import { useJobContext } from "./useJobContext";
import { useMatchContext } from "./useMatchContext";
import { useTailoredResumeContext } from "./useTailoredResumeContext";

interface UseLexContextProps {
  jobId?: string | null;
  tailoredResumeId?: string | null;
  loadMatchContext?: boolean;
}

/**
 * Master hook that loads ALL context for Lex
 * - Resume context is ALWAYS loaded
 * - Job, match, and tailored resume context are optional
 */
export function useLexContext({
  jobId,
  tailoredResumeId,
  loadMatchContext = false,
}: UseLexContextProps) {
  // Always load resume context
  const { resumeContext, isLoading: isLoadingResume } = useResumeContext();

  // Optionally load job context
  const { jobContext, isLoading: isLoadingJob } = useJobContext(jobId);

  // Optionally load match context
  const { matchContext, isLoading: isLoadingMatch } = loadMatchContext
    ? useMatchContext()
    : { matchContext: null, isLoading: false };

  // Optionally load tailored resume context
  const { tailoredResumeContext, isLoading: isLoadingTailored } =
    useTailoredResumeContext(tailoredResumeId);

  const isLoading =
    isLoadingResume || isLoadingJob || isLoadingMatch || isLoadingTailored;

  return {
    resumeContext,
    jobContext,
    matchContext,
    tailoredResumeContext,
    isLoading,
  };
}
