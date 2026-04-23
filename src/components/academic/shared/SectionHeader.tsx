import type { ReactNode } from "react";
import styles from "./academic.module.css";

export default function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.sectionHeader, className].filter(Boolean).join(" ")}>
      <div className={styles.sectionHeaderText}>
        {eyebrow ? <p className={styles.sectionEyebrow}>{eyebrow}</p> : null}
        <p className={styles.sectionTitle}>{title}</p>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
