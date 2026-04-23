"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("academic.codeReviewMode.pathPicker");
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
          : t("errors.startPath")
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <ActionModal title={t("title")} onClose={onClose} maxWidth="560px">
      <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
        {t("body")}
      </div>
      <p className="mt-3 text-xs text-slate-400">{t("languageTrackNote")}</p>
      {pendingPathId && (
        <p className="mt-2 text-xs text-amber-200">
          {t("selected", { title: pathOptions.find((path) => path.id === pendingPathId)?.title })}
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
        {pathsLoading && <AcademicLoadingState message={t("loading")} className="!min-h-0 py-4" />}
        {!pathsLoading && pathsError && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {pathsError}
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 block rounded-full border border-rose-300/40 bg-rose-500/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-100"
            >
              {t("retry")}
            </button>
          </div>
        )}
        {!pathsLoading && !pathsError && pathOptions.length === 0 && (
          <AcademicEmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
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
                  {isPending ? t("selectedShort") : t("select")}
                </button>
              </div>
              {isPending && (
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-300">
                  <span>{t("startTrack", { title: path.title })}</span>
                  <button
                    type="button"
                    onClick={() => void handleConfirm(path.id)}
                    disabled={isStarting}
                    className="rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs text-amber-100 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStarting ? t("starting") : t("confirm")}
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
