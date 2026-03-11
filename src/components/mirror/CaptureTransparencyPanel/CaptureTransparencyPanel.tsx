"use client";

import { useMemo, useState } from "react";
import CaptureEventRow from "@/components/mirror/CaptureEventRow/CaptureEventRow";
import { SOURCE_AUTHORITY, type SourceAuthority } from "@/lib/mirror-mode/sourceAuthority";
import { getSourceLabel } from "@/lib/mirror-mode/ingestionPolicy";
import type { CaptureLogResponse, CaptureChamber } from "@/hooks/useCaptureLog";
import styles from "./CaptureTransparencyPanel.module.css";

const SOURCE_FILTER_OPTIONS: Array<{ value: SourceAuthority; label: string }> = (
  Object.values(SOURCE_AUTHORITY) as SourceAuthority[]
).map((value) => ({ value, label: getSourceLabel(value) }));

const CHAMBERS: Array<{ key: CaptureChamber; label: string }> = [
  { key: "career", label: "Career" },
  { key: "academic", label: "Academic" },
  { key: "creative", label: "Creative" },
  { key: "general", label: "General" },
];

function formatRelative(value?: string): string {
  if (!value) return "Now";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Recent";
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  captureLog: CaptureLogResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export default function CaptureTransparencyPanel({
  captureLog,
  loading,
  error,
  onRetry,
}: Props) {
  const [sourceFilter, setSourceFilter] = useState<"all" | SourceAuthority>("all");
  const [chamberFilter, setChamberFilter] = useState<"all" | CaptureChamber>("all");
  const captureSummary = captureLog?.summary ?? null;
  const captureEvents = useMemo(() => captureLog?.captures ?? [], [captureLog?.captures]);
  const showCaptureFilters = (captureSummary?.totalCaptures || 0) > 10;

  const filteredCaptureEvents = useMemo(() => {
    return captureEvents.filter((event) => {
      if (sourceFilter !== "all" && event.sourceAuthority !== sourceFilter) {
        return false;
      }
      if (chamberFilter !== "all" && event.chamber !== chamberFilter) {
        return false;
      }
      return true;
    });
  }, [captureEvents, sourceFilter, chamberFilter]);

  const visibleCaptureEvents = useMemo(
    () => filteredCaptureEvents.slice(0, 50),
    [filteredCaptureEvents]
  );

  return (
    <div className={styles.panel}>
      <p className={styles.title}>Mirror captured — last 7 days</p>

      {loading ? (
        <p className={styles.hint}>Loading capture transparency…</p>
      ) : error ? (
        <div>
          <p className={styles.error}>{error}</p>
          <button type="button" className={styles.retryBtn} onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : !captureSummary || captureSummary.totalCaptures === 0 ? (
        <p className={styles.hint}>
          Nothing captured in the last 7 days.
          <br />
          Write in a studio or use the extension to start building your voice profile.
        </p>
      ) : (
        <>
          <p className={styles.summary}>
            <span>{captureSummary.totalCaptures} total</span>
            <span>•</span>
            <span>{captureSummary.profileEligibleCount} used for voice learning</span>
            {captureSummary.excludedCount > 0 && (
              <>
                <span>•</span>
                <span>{captureSummary.excludedCount} stored only</span>
              </>
            )}
          </p>

          {showCaptureFilters && (
            <div className={styles.filterRow}>
              <label className={styles.filterLabel}>
                Source
                <select
                  className={styles.filterSelect}
                  value={sourceFilter}
                  onChange={(event) =>
                    setSourceFilter(
                      event.target.value === "all"
                        ? "all"
                        : (event.target.value as SourceAuthority)
                    )
                  }
                >
                  <option value="all">All sources</option>
                  {SOURCE_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.filterLabel}>
                Chamber
                <select
                  className={styles.filterSelect}
                  value={chamberFilter}
                  onChange={(event) =>
                    setChamberFilter(
                      event.target.value === "all"
                        ? "all"
                        : (event.target.value as CaptureChamber)
                    )
                  }
                >
                  <option value="all">All chambers</option>
                  {CHAMBERS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className={styles.list}>
            {visibleCaptureEvents.length === 0 ? (
              <p className={styles.hint}>No captures match the current filters.</p>
            ) : (
              visibleCaptureEvents.map((capture) => (
                <CaptureEventRow
                  key={`${capture.captureType}-${capture.id}`}
                  sourceAuthority={capture.sourceAuthority}
                  sourceLabel={capture.sourceLabel}
                  retentionLabel={capture.retentionLabel}
                  chamber={capture.chamber}
                  wordCount={capture.wordCount}
                  relativeTime={formatRelative(capture.capturedAt)}
                />
              ))
            )}
          </div>

          {filteredCaptureEvents.length > 50 && (
            <p className={styles.hint}>
              Showing 50 of {filteredCaptureEvents.length} captures. View all in your archive.
            </p>
          )}
        </>
      )}
    </div>
  );
}
