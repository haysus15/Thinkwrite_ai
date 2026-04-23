import { createNavigation } from "next-intl/navigation";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation({
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localePrefix: "never",
  });
