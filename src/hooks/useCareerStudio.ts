// Career Studio Hooks
// src/hooks/useCareerStudio.ts

import { useState, useEffect, useCallback } from 'react';

// Resume types
export interface Resume {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  isMasterResume: boolean;
  uploadedAt: Date;
  analysisResults: any;
  analysisStatus: 'pending' | 'complete' | 'error';
  hasLegacyAnalysis: boolean;
}

export interface ResumeListResponse {
  success: boolean;
  resumes: Resume[];
  masterResume: Resume | null;
  userId: string;
  error?: string;
}

// Job Analysis types
export interface JobAnalysis {
  id: string;
  job_title: string;
  company_name: string;
  location?: string;
  is_saved: boolean;
  has_applied: boolean;
  created_at: string;
  ats_keywords?: any;
  hidden_insights?: any;
}

export interface JobAnalysisListResponse {
  success: boolean;
  analyses: JobAnalysis[];
  error?: string;
}

// Cover Letter types
export interface CoverLetter {
  id: string;
  title: string;
  target_company: string;
  target_role: string;
  content: string;
  created_at: string;
}

/**
 * Hook to manage user resumes
 */
export function useResumes(userId: string | null) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [masterResume, setMasterResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResumes = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/resumes");
      const data: ResumeListResponse = await res.json();

      if (data.success) {
        setResumes(data.resumes || []);
        setMasterResume(data.masterResume || null);
      } else {
        setError(data.error || 'Failed to fetch resumes');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const uploadResume = useCallback(
    async (file: File): Promise<{ success: boolean; resume?: Resume; error?: string }> => {
      if (!userId) {
        return { success: false, error: 'User ID required' };
      }

      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/resumes', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (data.success) {
          await fetchResumes(); // Refresh list
          return { success: true, resume: data.resume };
        } else {
          return { success: false, error: data.error };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Upload failed' };
      }
    },
    [userId, fetchResumes]
  );

  const reanalyzeResume = useCallback(
    async (resumeId: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId) {
        return { success: false, error: 'User ID required' };
      }

      try {
        const res = await fetch('/api/resumes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeId }),
        });
        const data = await res.json();

        if (data.success) {
          await fetchResumes(); // Refresh list
          return { success: true };
        } else {
          return { success: false, error: data.error };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Re-analysis failed' };
      }
    },
    [userId, fetchResumes]
  );

  return {
    resumes,
    masterResume,
    loading,
    error,
    refetch: fetchResumes,
    uploadResume,
    reanalyzeResume,
  };
}

/**
 * Hook to manage job analyses
 */
export function useJobAnalyses(userId: string | null) {
  const [analyses, setAnalyses] = useState<JobAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyses = useCallback(async (savedOnly = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = `/api/job-analysis${savedOnly ? '?saved=true' : ''}`;
      const res = await fetch(url);
      const data: JobAnalysisListResponse = await res.json();

      if (data.success) {
        setAnalyses(data.analyses || []);
      } else {
        setError(data.error || 'Failed to fetch job analyses');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const analyzeJob = useCallback(
    async (
      content: string,
      isUrl: boolean
    ): Promise<{ success: boolean; analysis?: any; error?: string }> => {
      if (!userId) {
        return { success: false, error: 'User ID required' };
      }

      try {
        const res = await fetch('/api/job-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, isUrl }),
        });
        const data = await res.json();

        if (data.success) {
          await fetchAnalyses(); // Refresh list
          return { success: true, analysis: data.analysis };
        } else {
          return { success: false, error: data.error };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Analysis failed' };
      }
    },
    [userId, fetchAnalyses]
  );

  const toggleSaved = useCallback(
    async (analysisId: string, isSaved: boolean): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch(`/api/job-analysis/${analysisId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_saved: isSaved }),
        });
        const data = await res.json();

        if (data.success) {
          await fetchAnalyses();
          return { success: true };
        } else {
          return { success: false, error: data.error };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Update failed' };
      }
    },
    [fetchAnalyses]
  );

  return {
    analyses,
    savedAnalyses: analyses.filter((a) => a.is_saved),
    loading,
    error,
    refetch: fetchAnalyses,
    analyzeJob,
    toggleSaved,
  };
}

/**
 * Hook for managing application tracking
 */
export function useApplications(userId: string | null) {
  const [applications, setApplications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [appsRes, statsRes] = await Promise.all([
        fetch("/api/applications"),
        fetch("/api/applications/stats"),
      ]);

      const appsData = await appsRes.json();
      const statsData = await statsRes.json();

      if (appsData.success) {
        setApplications(appsData.applications || []);
      }
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return {
    applications,
    stats,
    loading,
    error,
    refetch: fetchApplications,
  };
}

/**
 * Hook for managing career assessments
 */
export function useAssessment(userId: string | null) {
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessment = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/career-assessment");
      const data = await res.json();

      if (data.success) {
        setAssessment(data.assessment);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  const startAssessment = useCallback(async (): Promise<{
    success: boolean;
    assessmentId?: string;
    error?: string;
  }> => {
    if (!userId) {
      return { success: false, error: 'User ID required' };
    }

    try {
      const res = await fetch('/api/career-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.success) {
        await fetchAssessment();
        return { success: true, assessmentId: data.assessmentId };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to start assessment' };
    }
  }, [userId, fetchAssessment]);

  return {
    assessment,
    loading,
    error,
    refetch: fetchAssessment,
    startAssessment,
    hasCompletedAssessment: assessment?.status === 'completed',
    hasRoadmap: !!assessment?.roadmap,
  };
}

/**
 * Generic async operation hook
 */
export function useAsyncOperation<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (operation: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await operation();
      setData(result);
      return result;
    } catch (err: any) {
      setError(err.message || 'Operation failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
