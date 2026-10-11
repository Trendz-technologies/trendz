import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { i18n, LOCALE_COOKIE, toLocale, type I18n, type Locale } from ".";

/** The shopper's language, from the cookie set by the storefront switch. Reading it renders the route per request. */
export const getLocale = cache(async (): Promise<Locale> => toLocale((await cookies()).get(LOCALE_COOKIE)?.value));

/** Translator for server components and metadata: `const { t } = await getI18n()`. */
export const getI18n = async (): Promise<I18n> => i18n(await getLocale());
