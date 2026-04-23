import { useCallback, useEffect, useState } from "react";
import { translateSystemError } from "@/lib/mirror/voiceProfileStatus";
import type { SourceAuthority } from "@/lib/mirror-core/sourceAuthority";

export type CaptureChamber = "career" | "academic" | "creative" | "general";

export type CaptureEvent = {
  id: string;
  captureType: "document" | "extension";
  sourceAuthority: SourceAuthority;
  excludedFromProfile: boolean;
  chamber: CaptureChamber;
  wordCount: number;
  capturedAt: string;
  hostname?: string;
  sourceLabel: string;
  retentionLabel: string;
};

export type CaptureLogResponse = {
  success: boolean;
  window: {
    days: number;
    from: string;
    to: string;
  };
  summary: {
    totalCaptures: number;
    profileEligibleCount: number;
    excludedCount: number;
    bySource: Record<SourceAuthority, number>;
    byChamber: Record<CaptureChamber, number>;
    wordCountTotal: number;
  };
  captures: CaptureEvent[];
};

export function useCaptureLog(days = 7) {
  const [captureLog, setCaptureLog] = useState<CaptureLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCaptureLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/mirror-mode/capture-log?days=${days}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to load capture transparency");
      }
      setCaptureLog(data as CaptureLogResponse);
    } catch (err: any) {
      setError(translateSystemError(err?.message || "UNKNOWN"));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void fetchCaptureLog();
  }, [fetchCaptureLog]);

  return { captureLog, loading, error, refetch: fetchCaptureLog };
}
