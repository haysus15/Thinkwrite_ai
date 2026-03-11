import EmptyState from "./EmptyState";

type AcademicErrorStateProps = {
  message: string;
  retry?: () => void;
  className?: string;
};

export default function AcademicErrorState({
  message,
  retry,
  className,
}: AcademicErrorStateProps) {
  return (
    <EmptyState
      heading="Something went wrong"
      description={message}
      className={className}
      action={
        retry ? (
          <button
            type="button"
            onClick={retry}
            className="rounded-lg border border-red-400/35 bg-red-500/15 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/20"
          >
            Try again
          </button>
        ) : undefined
      }
    />
  );
}
