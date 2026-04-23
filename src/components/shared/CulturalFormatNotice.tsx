"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

type CulturalFormatNoticeData = {
  title: string;
  detail: string;
} | null | undefined;

type CulturalFormatNoticeProps = {
  notice: CulturalFormatNoticeData;
  languageCode?: string | null;
  className?: string;
};

function dismissalKey(languageCode: string) {
  return `career-cultural-format-dismissed:${languageCode}`;
}

export default function CulturalFormatNotice({
  notice,
  languageCode,
  className = "",
}: CulturalFormatNoticeProps) {
  const normalizedLanguage = useMemo(
    () => String(languageCode || "").toLowerCase().trim(),
    [languageCode]
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!notice || !normalizedLanguage || normalizedLanguage === "en") {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(window.localStorage.getItem(dismissalKey(normalizedLanguage)) === "true");
    } catch {
      setDismissed(false);
    }
  }, [notice, normalizedLanguage]);

  if (!notice || !normalizedLanguage || normalizedLanguage === "en" || dismissed) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{notice.title}</p>
          <p className="mt-1 text-xs leading-5 text-emerald-100/80">{notice.detail}</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss cultural format notice"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(dismissalKey(normalizedLanguage), "true");
            } catch {
              // Ignore storage failures.
            }
          }}
          className="rounded-full border border-emerald-200/20 bg-emerald-500/10 p-1 text-emerald-100/80 hover:bg-emerald-500/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
