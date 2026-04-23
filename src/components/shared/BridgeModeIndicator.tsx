"use client";

import { useTranslations } from "next-intl";
import { NATIVE_LANGUAGE_LABELS } from "@/components/ui/LanguageSelector";

interface BridgeModeIndicatorProps {
  sourceLanguage: string;
  isTransferring?: boolean;
  className?: string;
}

export default function BridgeModeIndicator({
  sourceLanguage,
  isTransferring = false,
  className = "",
}: BridgeModeIndicatorProps) {
  const t = useTranslations("studio.bridgeMode");
  const sourceLanguageLabel =
    NATIVE_LANGUAGE_LABELS[sourceLanguage] || sourceLanguage.toUpperCase();

  return (
    <div
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/58 ${className}`.trim()}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#a0aed4]" />
      <span className="truncate">
        {isTransferring
          ? t("transferring")
          : t("indicator", {
              sourceLanguage: sourceLanguageLabel,
            })}
      </span>
    </div>
  );
}
