// src/components/lex/hooks/useResumeContext.ts
"use client";

import { useState, useEffect } from "react";
import { ResumeContext } from "../types/lex.types";

export function useResumeContext() {
  const [resumeContext, setResumeContext] = useState<ResumeContext>({
    hasResume: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadResumeContext = async () => {
      try {
        const response = await fetch("/api/lex/resume-context");
        const data = await response.json();

        if (data.success) {
          const context: ResumeContext = {
            hasResume: data.allResumes && data.allResumes.length > 0,
            allResumes: data.allResumes,
          };

          if (data.resumeContext?.masterResume) {
            const masterAnalysis = data.resumeContext.masterResume.automatedAnalysis;
            context.masterResume = {
              id: data.resumeContext.masterResume.id,
              fileName: data.resumeContext.masterResume.fileName,
              score: masterAnalysis?.overallScore,
              analysisStatus: masterAnalysis
                ? data.resumeContext.masterResume.lexAnalyses?.length > 0
                  ? "complete"
                  : "needs_lex_review"
                : "pending",
            };
          }

          setResumeContext(context);
        }
      } catch (error) {
        console.error("Failed to load resume context:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResumeContext();
  }, []);

  return { resumeContext, isLoading };
}
