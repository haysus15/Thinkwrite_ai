import LoadingState from "./LoadingState";

type AcademicLoadingStateProps = {
  message?: string;
  className?: string;
};

export default function AcademicLoadingState({
  message,
  className,
}: AcademicLoadingStateProps) {
  return <LoadingState text={message || "Loading..."} lines={2} className={className} />;
}
