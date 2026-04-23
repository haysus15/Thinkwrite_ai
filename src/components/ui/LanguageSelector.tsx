"use client";

import { useTranslations } from "next-intl";
import { SUPPORTED_LANGUAGE_OPTIONS } from "@/lib/language/constants";
import DropdownSelect from "@/components/ui/DropdownSelect";

export const NATIVE_LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
};

interface LanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
  context: "settings" | "studio";
}

export default function LanguageSelector({
  value,
  onChange,
  context,
}: LanguageSelectorProps) {
  const t = useTranslations();
  const label =
    context === "settings" ? t("settings.preferredLanguage") : t("settings.language");

  return (
    <DropdownSelect
      label={label}
      value={value}
      onChange={onChange}
      options={SUPPORTED_LANGUAGE_OPTIONS.filter(
        (option) => option.code !== "ar" && option.code !== "it"
      ).map((option) => ({
        value: option.code,
        label: NATIVE_LANGUAGE_LABELS[option.code] || option.label,
      }))}
    />
  );
}
