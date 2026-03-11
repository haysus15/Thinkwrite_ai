"use client";

import { useState } from "react";
import ActionModal from "../../shared/ActionModal";
import AcademicEmptyState from "../../shared/AcademicEmptyState";
import AcademicErrorState from "../../shared/AcademicErrorState";
import AcademicLoadingState from "../../shared/AcademicLoadingState";

type PathOption = { id: string; title: string };

type CodingReviewPathPickerModalProps = {
  open: boolean;
  onClose: () => void;
  pathsLoading: boolean;
  pathsError: string | null;
  pathOptions: PathOption[];
  pendingPathId: string | null;
  setPendingPathId: (id: string | null) => void;
  onRetry: () => void;
  onConfirmPath: (pathId: string) => Promise<void>;
};

export default function CodingReviewPathPickerModal({
  open,
  onClose,
  pathsLoading,
  pathsError,
  pathOptions,
  pendingPathId,
  setPendingPathId,
  onRetry,
  onConfirmPath,
}: CodingReviewPathPickerModalProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = async (pathId: string) => {
    try {
      setIsStarting(true);
      setStartError(null);
      await onConfirmPath(pathId);
      setPendingPathId(null);
    } catch (error) {
      setStartError(
        error instanceof Error && error.message
          ? error.message
          : "Could not start this learning path. Check your connection and try again."
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <ActionModal title="Learning Coach" onClose={onClose} maxWidth="560px">
      <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
        Learning Coach means Victor runs a quick placement, sets your starting lesson, then teaches through a structured sequence.
        It is for learning deeply, not just ad-hoc debugging.
      </div>
      <p className="mt-3 text-xs text-slate-400">Each option is a language track. This does not use the editor language dropdown above.</p>
      {pendingPathId && (
        <p className="mt-2 text-xs text-amber-200">
          Selected: {pathOptions.find((path) => path.id === pendingPathId)?.title}. Confirm to start placement.
        </p>
      )}
      {startError && (
        <AcademicErrorState
          message={startError}
          className="mt-3 !min-h-0 py-3"
          retry={
            pendingPathId && !isStarting
              ? () => {
                  void handleConfirm(pendingPathId);
                }
              : undefined
          }
        />
      )}
      <div className="mt-4 space-y-2">
        {pathsLoading && <AcademicLoadingState message="Loading tracks..." className="!min-h-0 py-4" />}
        {!pathsLoading && pathsError && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {pathsError}
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 block rounded-full border border-rose-300/40 bg-rose-500/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-100"
            >
              Retry
            </button>
          </div>
        )}
        {!pathsLoading && !pathsError && pathOptions.length === 0 && (
          <AcademicEmptyState title="No tracks loaded yet" description="Try again to load coding review tracks." />
        )}
        {pathOptions.map((path) => {
          const isPending = pendingPathId === path.id;
          return (
            <div
              key={path.id}
              className={`rounded-xl border px-4 py-3 ${
                isPending ? "border-amber-400/40 bg-amber-500/10" : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between text-sm text-slate-100">
                <span>{path.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStartError(null);
                    setPendingPathId(isPending ? null : path.id);
                  }}
                  className={`text-[10px] uppercase tracking-[0.2em] ${
                    isPending ? "text-amber-200" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {isPending ? "Selected" : "Select"}
                </button>
              </div>
              {isPending && (
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-300">
                  <span>Start {path.title} track?</span>
                  <button
                    type="button"
                    onClick={() => void handleConfirm(path.id)}
                    disabled={isStarting}
                    className="rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs text-amber-100 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStarting ? "Starting path..." : "Confirm"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ActionModal>
  );
}
