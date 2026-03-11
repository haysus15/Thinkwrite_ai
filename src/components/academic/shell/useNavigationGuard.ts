"use client";

import { useCallback, useState } from "react";

type GuardResult = {
  isSaving: boolean;
  runWithGuard: (navigate: () => void) => Promise<void>;
};

type WindowWithUnsavedState = Window & {
  __academicHasUnsavedState?: boolean;
};

export function useNavigationGuard(
  hasUnsavedState: boolean,
  onSave: () => Promise<void>
): GuardResult {
  const [isSaving, setIsSaving] = useState(false);

  const runWithGuard = useCallback(
    async (navigate: () => void) => {
      const inferredUnsaved =
        typeof window !== "undefined" &&
        (window as WindowWithUnsavedState).__academicHasUnsavedState === true;
      const shouldSave = hasUnsavedState || inferredUnsaved;

      if (!shouldSave) {
        navigate();
        return;
      }

      setIsSaving(true);
      try {
        await onSave();
        navigate();
      } finally {
        setIsSaving(false);
      }
    },
    [hasUnsavedState, onSave]
  );

  return { isSaving, runWithGuard };
}

