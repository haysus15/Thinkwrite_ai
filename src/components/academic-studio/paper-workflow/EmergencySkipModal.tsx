// src/components/academic-studio/paper-workflow/EmergencySkipModal.tsx
"use client";

interface EmergencySkipModalProps {
  isOpen: boolean;
  usedCount: number;
  limit: number;
  onClose: () => void;
  onConfirm: () => void;
}

export default function EmergencySkipModal({
  isOpen,
  usedCount,
  limit,
  onClose,
  onConfirm,
}: EmergencySkipModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-skip-title"
        className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-slate-950/95 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
      >
        <h3
          id="emergency-skip-title"
          className="text-lg font-semibold text-slate-100"
        >
          Academic integrity warning
        </h3>
        <p className="mt-3 text-sm text-slate-400">
          Skipping the checkpoint means you may submit work you cannot explain.
          You can only use this once per month.
        </p>
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Emergency skips used this month: {usedCount} of {limit}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300"
          >
            Return to checkpoint
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-red-400/40 bg-red-500/15 px-4 py-2 text-sm text-red-200"
          >
            Confirm skip
          </button>
        </div>
      </div>
    </div>
  );
}
