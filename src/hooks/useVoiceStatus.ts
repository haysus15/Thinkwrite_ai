// src/hooks/useVoiceStatus.ts
// Hook for fetching Mirror Mode voice status and profile (NO STALE CACHE)

import { useState, useEffect, useCallback, useRef } from "react";

export type VoiceHighlight = {
  label: string;
  value: string;
  icon: string;
};

export type VoiceEvolution = {
  timestamp: string;
  documentId: string;
  documentName: string;
  writingType: string;
  changesMade: string[];
  confidenceDelta: number;
  confidenceLevel: number;
  totalWordCount: number;
  totalDocuments: number;
};

export type RecentUpload = {
  id: string;
  fileName: string;
  wordCount: number;
  fileSize?: number;
  learned: boolean;
  writingType: string;
  uploadedAt: string;
};

export type VoiceStatus = {
  success: boolean;
  status: "not_started" | "learning" | "ready";
  overview: {
    hasProfile: boolean;
    confidenceLevel: number;
    confidenceLabel: string;
    documentCount: number;
    totalWordCount: number;
    lastTrainedAt: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  progress?: {
    current: number;
    nextMilestone: number;
    nextMilestoneLabel: string;
    documentsNeeded: number;
    wordsNeeded: number;
  };
  documents: {
    total: number;
    learned: number;
    pending: number;
    recentUploads: RecentUpload[];
  };
  voiceDescription: string | null;
  voiceHighlights: VoiceHighlight[] | null;
  evolutionHistory?: VoiceEvolution[];
  recommendations?: string[];
};

export type VoiceProfile = {
  success: boolean;
  exists: boolean;
  message?: string;
  profile: {
    userId: string;
    confidenceLevel: number;
    confidenceLabel: string;
    documentCount: number;
    totalWordCount: number;
    lastTrainedAt: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  voiceDescription: string | null;
  voiceSummary: string | null;
  fingerprint: any | null;
  evolutionHistory?: any[];
};

async function fetchJsonNoStore<T>(url: string, signal?: AbortSignal): Promise<T> {
  const withBust =
    url + (url.includes("?") ? "&" : "?") + `_ts=${Date.now()}`;

  const res = await fetch(withBust, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
    signal,
  });

  // Prefer surfacing server message text (helps debugging)
  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // If server returned HTML/error, include a snippet
    throw new Error(`Non-JSON response (${res.status}): ${text?.slice(0, 180)}`);
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }

  return data as T;
}

export function useVoiceStatus() {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async () => {
    // cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const data = await fetchJsonNoStore<VoiceStatus>(
        `/api/mirror-mode/voice/status?fullHistory=true`,
        controller.signal
      );

      if (data?.success) setStatus(data);
      else setError((data as any)?.error || "Failed to fetch voice status");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}

export function useVoiceProfile() {
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      // NOTE: this endpoint auths via cookies; userId is not required but we keep it for consistency
      const data = await fetchJsonNoStore<VoiceProfile>(
        `/api/mirror-mode/voice/profile?includeFingerprint=true`,
        controller.signal
      );

      if (data?.success) setProfile(data);
      else setError((data as any)?.error || "Failed to fetch voice profile");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    isReady: (profile?.profile?.confidenceLevel || 0) >= 45,
  };
}
