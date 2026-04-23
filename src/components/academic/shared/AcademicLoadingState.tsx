import { useTranslations } from "next-intl";
import LoadingState from "./LoadingState";

type AcademicLoadingStateProps = {
  message?: string;
  className?: string;
};

export default function AcademicLoadingState({
  message,
  className,
}: AcademicLoadingStateProps) {
  const t = useTranslations();

  return (
    <LoadingState
      text={message || t("global.loading")}
      lines={2}
      className={className}
    />
  );
}
