// src/components/lex/hooks/useTailoredResumeContext.ts
"use client";

import { useState, useEffect } from "react";
import { TailoredResumeContext } from "../types/lex.types";

export function useTailoredResumeContext(tailoredResumeId?: string | null) {
  const [tailoredResumeContext, setTailoredResumeContext] = useState<TailoredResumeContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!tailoredResumeId) {
      setTailoredResumeContext(null);
      return;
    }

    const loadTailoredResumeContext = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/tailored-resume/${tailoredResumeId}`);
        const data = await response.json();

        if (data.success && data.tailoredResume) {
          const tr = data.tailoredResume;

          setTailoredResumeContext({
            id: tr.id,
            jobTitle: tr.jobDetails?.title || "Unknown Position",
            company: tr.jobDetails?.company || "Unknown Company",
            tailoringLevel: tr.tailoringLevel,
            changes: tr.changes || [],
            changesAccepted: tr.changesAccepted,
            changesRejected: tr.changesRejected,
            changesPending: tr.changesPending,
            lexCommentary: tr.lexCommentary || {},
            isFinalized: tr.isFinalized,
          });
        }
      } catch (error) {
        console.error("Failed to load tailored resume context:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTailoredResumeContext();
  }, [tailoredResumeId]);

  return { tailoredResumeContext, isLoading };
}