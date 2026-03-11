import styles from "./academic-studio.module.css";

type StatusTone = "pending" | "active" | "completed" | "archived" | "draft";

function resolveTone(status: string): StatusTone {
  const value = status.trim().toLowerCase();
  if (["complete", "completed", "done", "passed", "strong"].includes(value)) {
    return "completed";
  }
  if (["archive", "archived"].includes(value)) {
    return "archived";
  }
  if (["draft", "not started"].includes(value)) {
    return "draft";
  }
  if (["pending", "learning", "in progress"].includes(value)) {
    return "pending";
  }
  return "active";
}

export default function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = resolveTone(status);
  const toneClass = {
    pending: styles.badgePending,
    active: styles.badgeActive,
    completed: styles.badgeCompleted,
    archived: styles.badgeArchived,
    draft: styles.badgeDraft,
  }[tone];

  return <span className={[styles.badge, toneClass, className].filter(Boolean).join(" ")}>{status}</span>;
}
