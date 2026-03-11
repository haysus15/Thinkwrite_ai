"use client";

import { useEffect } from "react";
import styles from "./MomentumIndicator.module.css";

type Props = {
  chamberLabel: string;
  stateLabel: string;
  observations: string[];
  visible: boolean;
  onDismiss: () => void;
};

export default function MomentumIndicator({
  chamberLabel,
  stateLabel,
  observations,
  visible,
  onDismiss,
}: Props) {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => onDismiss(), 8000);
    return () => window.clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <aside className={styles.panel}>
      <p className={styles.title}>Profile updated - {chamberLabel} voice</p>
      {observations.length > 0 && (
        <>
          <p className={styles.label}>Mirror Mode noticed:</p>
          <ul className={styles.list}>
            {observations.slice(0, 3).map((obs) => (
              <li key={obs}>{obs}</li>
            ))}
          </ul>
        </>
      )}
      <p className={styles.stateLine}>
        {chamberLabel} voice is now {stateLabel}
      </p>
    </aside>
  );
}
