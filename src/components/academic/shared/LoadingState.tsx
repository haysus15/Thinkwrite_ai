import { useTranslations } from "next-intl";
import styles from "./academic.module.css";

export default function LoadingState({
  text,
  lines = 0,
  className,
}: {
  text?: string;
  lines?: number;
  className?: string;
}) {
  const t = useTranslations("global");
  return (
    <div className={[styles.loadingWrap, className].filter(Boolean).join(" ")}>
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.loadingText}>{text || t("loading")}</span>
      {lines > 0 ? (
        <div className={styles.skeleton} aria-hidden="true">
          {Array.from({ length: lines }).map((_, index) => (
            <span
              key={index}
              className={styles.skeletonLine}
              style={{ width: `${Math.max(40, 90 - index * 10)}px` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
