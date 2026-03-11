import EmptyState from "./EmptyState";

type AcademicEmptyStateProps = {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
};

export default function AcademicEmptyState({
  title,
  description,
  action,
  className,
}: AcademicEmptyStateProps) {
  return (
    <EmptyState
      heading={title}
      description={description}
      className={className}
      action={
        action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-slate-100 hover:bg-white/15"
          >
            {action.label}
          </button>
        ) : undefined
      }
    />
  );
}
