// src/components/lex/hooks/useJobContext.ts
"use client";

import { useState, useEffect } from "react";
import { JobContext } from "../types/lex.types";

export function useJobContext(jobId?: string | null) {
  const [jobContext, setJobContext] = useState<JobContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJobContext(null);
      return;
    }

    const loadJobContext = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/job-analysis/${jobId}`);
        const data = await response.json();

        if (data.success && data.analysis) {
          const analysis = data.analysis;

          setJobContext({
            id: analysis.id,
            jobTitle: analysis.job_title || analysis.jobDetails?.title || "Unknown Position",
            company: analysis.company_name || analysis.jobDetails?.company || "Unknown Company",
            location: analysis.jobDetails?.location || "",
            hiddenInsights: analysis.hiddenInsights || analysis.hidden_insights || {},
            industryIntelligence: analysis.industryIntelligence || analysis.industry_intelligence || {},
            atsKeywords: analysis.atsKeywords || analysis.ats_keywords || {},
          });
        }
      } catch (error) {
        console.error("Failed to load job context:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadJobContext();
  }, [jobId]);

  return { jobContext, isLoading };
}
