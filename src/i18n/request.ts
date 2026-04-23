import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_COOKIE_NAME,
  resolveBrowserLocale,
} from "@/i18n/config";

const messageLoaders = {
  en: () => import("../../messages/en.json"),
  es: () => import("../../messages/es.json"),
  fr: () => import("../../messages/fr.json"),
  de: () => import("../../messages/de.json"),
  pt: () => import("../../messages/pt.json"),
  zh: () => import("../../messages/zh.json"),
  ja: () => import("../../messages/ja.json"),
  ko: () => import("../../messages/ko.json"),
} as const;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const headerLocale = headerStore.get("x-thinkwrite-locale");
  const browserLocale = resolveBrowserLocale(headerStore.get("accept-language"));

  const locale = isAppLocale(headerLocale)
    ? headerLocale
    : isAppLocale(cookieLocale)
    ? cookieLocale
    : browserLocale || DEFAULT_LOCALE;

  const messages = (await messageLoaders[locale]()).default;

  return {
    locale,
    messages,
  };
});
