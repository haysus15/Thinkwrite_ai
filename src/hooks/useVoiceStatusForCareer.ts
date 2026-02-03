// Voice Status Hook for Career Studio
// src/hooks/useVoiceStatusForCareer.ts
// Lightweight hook to display Mirror Mode status in Career Studio

import { useState, useEffect, useCallback } from 'react';

export interface VoiceStatus {
  exists: boolean;
  confidenceLevel: number;
  confidenceLabel: string;
  documentCount: number;
  isLoading: boolean;
  error: string | null;
}

const CACHE_KEY = 'mirror-mode-voice-status';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedStatus {
  data: VoiceStatus;
  timestamp: number;
}

/**
 * Hook to fetch and cache voice profile status for Career Studio dashboard
 */
export function useVoiceStatusForCareer(): VoiceStatus {
  const [status, setStatus] = useState<VoiceStatus>({
    exists: false,
    confidenceLevel: 0,
    confidenceLabel: 'Not Started',
    documentCount: 0,
    isLoading: true,
    error: null,
  });

  const fetchStatus = useCallback(async () => {
    // Check cache first
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp }: CachedStatus = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setStatus({ ...data, isLoading: false, error: null });
          return;
        }
      }
    } catch (e) {
      // Cache read failed, continue with fetch
    }

    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/mirror-mode/voice/profile');

      if (!response.ok) {
        throw new Error('Failed to fetch voice status');
      }

      const data = await response.json();

      const newStatus: VoiceStatus = {
        exists: data.success && data.exists,
        confidenceLevel: data.profile?.confidenceLevel
          ? Math.round(data.profile.confidenceLevel * 100)
          : 0,
        confidenceLabel: data.profile?.confidenceLabel || 'Not Started',
        documentCount: data.profile?.documentCount || 0,
        isLoading: false,
        error: null,
      };

      setStatus(newStatus);

      // Cache the result
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          data: newStatus,
          timestamp: Date.now(),
        }));
      } catch (e) {
        // Cache write failed, continue
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return status;
}

/**
 * Clear cached voice status (call when user updates profile)
 */
export function clearVoiceStatusCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch (e) {
    // Ignore cache clear errors
  }
}

export default useVoiceStatusForCareer;
