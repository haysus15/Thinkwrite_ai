import type { ReactNode } from "react";
import styles from "./academic.module.css";

export default function ActionModal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "720px",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={styles.modalContainer}
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.sectionTitle}>{title}</p>
            {subtitle ? <p className={styles.sectionDescription}>{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className={`${styles.buttonBase} ${styles.buttonSecondary}`}>
            Close
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer ? <div className={styles.modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}
