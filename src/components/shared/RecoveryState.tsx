"use client";

interface RecoveryStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  } | null;
}

export function RecoveryState({
  title = "Something went wrong",
  description = "Refresh the page to continue. Your work is saved.",
  action = { label: "Refresh", onClick: () => window.location.reload() },
}: RecoveryStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-center backdrop-blur-md">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export default RecoveryState;

