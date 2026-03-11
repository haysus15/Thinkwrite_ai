import type { ReactNode } from "react";
import styles from "./academic-studio.module.css";

export default function EmptyState({
  icon,
  heading,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  heading: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.emptyState, className].filter(Boolean).join(" ")}>
      {icon ? <div className={styles.emptyStateIcon}>{icon}</div> : null}
      <p className={styles.emptyStateHeading}>{heading}</p>
      {description ? <p className={styles.emptyStateDescription}>{description}</p> : null}
      {action ? <div className={styles.emptyStateAction}>{action}</div> : null}
    </div>
  );
}
