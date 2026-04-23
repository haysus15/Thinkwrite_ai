'use client';

import { SOURCE_AUTHORITY, type SourceAuthority } from '@/lib/mirror-core/sourceAuthority';
import { MINIMUM_WORD_COUNT } from '@/lib/mirror-core/ingestionPolicy';
import styles from './CaptureEventRow.module.css';

type Chamber = 'career' | 'academic' | 'creative' | 'general';

type CaptureEventRowProps = {
  sourceAuthority: SourceAuthority;
  sourceLabel: string;
  retentionLabel: string;
  chamber: Chamber;
  wordCount: number;
  relativeTime: string;
};

function getDotClass(sourceAuthority: SourceAuthority): string {
  const isEligible =
    sourceAuthority === SOURCE_AUTHORITY.USER_TYPED ||
    sourceAuthority === SOURCE_AUTHORITY.USER_UPLOADED ||
    sourceAuthority === SOURCE_AUTHORITY.USER_QUICKSTART ||
    sourceAuthority === SOURCE_AUTHORITY.EXTENSION_CAPTURED;
  return isEligible ? styles.dotEligible : styles.dotExcluded;
}

function getRetentionClass(sourceAuthority: SourceAuthority): string {
  if (sourceAuthority === SOURCE_AUTHORITY.EXTENSION_CAPTURED) {
    return styles.retentionPattern;
  }
  const isEligible =
    sourceAuthority === SOURCE_AUTHORITY.USER_TYPED ||
    sourceAuthority === SOURCE_AUTHORITY.USER_UPLOADED ||
    sourceAuthority === SOURCE_AUTHORITY.USER_QUICKSTART;
  if (isEligible) {
    return styles.retentionUsed;
  }
  return styles.retentionMuted;
}

function chamberLabel(chamber: Chamber): string {
  return chamber[0].toUpperCase() + chamber.slice(1);
}

export default function CaptureEventRow({
  sourceAuthority,
  sourceLabel,
  retentionLabel,
  chamber,
  wordCount,
  relativeTime,
}: CaptureEventRowProps) {
  const wordCountClass =
    wordCount >= MINIMUM_WORD_COUNT ? styles.wordCountStrong : styles.wordCountMuted;

  return (
    <div className={styles.row}>
      <span className={`${styles.dot} ${getDotClass(sourceAuthority)}`} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.topLine}>
          <p className={styles.sourceLabel}>{sourceLabel}</p>
          <span className={getRetentionClass(sourceAuthority)}>{retentionLabel}</span>
        </div>
        <div className={styles.metaLine}>
          <span>{chamberLabel(chamber)}</span>
          <span>•</span>
          <span className={wordCountClass}>{wordCount} words</span>
          <span>•</span>
          <span>{relativeTime}</span>
        </div>
      </div>
    </div>
  );
}
