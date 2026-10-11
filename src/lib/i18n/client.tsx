"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { i18n, LOCALE_COOKIE, LOCALE_TAGS, toLocale, type I18n, type Locale } from ".";

// English unless a provider says otherwise, so shared components used by the admin and POS stay English there.
const I18nContext = createContext<I18n>(i18n("en"));

/** Gives the storefront its language (read from the cookie on the server, so the first paint is already translated). */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  // Toasts and dialogs render outside the storefront wrapper; keep the document language in step for them.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = LOCALE_TAGS[locale];
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);
  return <I18nContext.Provider value={i18n(locale)}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

const cookieLocale = (): Locale => toLocale(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`).exec(document.cookie)?.[1]);
const never = () => () => undefined;

/**
 * Translator for the two pages rendered outside the storefront provider (not
 * found, error). The cookie is read in the browser: reading it on the server
 * there would make every route, the admin's included, render per request.
 * The admin and POS stay English.
 */
export function useStandaloneI18n(): I18n {
  const staffArea = /^\/(admin|pos)(\/|$)/.test(usePathname());
  const cookie = useSyncExternalStore<Locale>(never, cookieLocale, () => "en");
  return i18n(staffArea ? "en" : cookie);
}

/** Remembers the language for a year and reloads, so server-rendered text is fetched again in it. */
export function switchLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}
