"use client";

import styles from "./ChamberCard.module.css";
import type { ChamberStatus } from "@/lib/mirror/voiceProfileStatus";

type ChamberCardProps = {
  chamberLabel: string;
  status: ChamberStatus;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
};

export default function ChamberCard({
  chamberLabel,
  status,
  onPrimaryAction,
  primaryActionLabel,
}: ChamberCardProps) {
  return (
    <article className={styles.card} data-state={status.state}>
      <div className={styles.topRow}>
        <h3 className={styles.title}>{chamberLabel}</h3>
        <span className={styles.badge}>{status.displayLabel}</span>
      </div>
      <p className={styles.documents}>
        {status.documentCount} {status.documentCount === 1 ? "document" : "documents"}
      </p>
      <p className={styles.nextAction}>{status.nextMilestone}</p>
      <button type="button" className={styles.cta} onClick={onPrimaryAction}>
        {primaryActionLabel}
      </button>
    </article>
  );
}
