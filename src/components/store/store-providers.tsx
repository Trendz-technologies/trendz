"use client";

import type { ReactNode } from "react";
import { LOCALE_TAGS, type Locale } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { CartDrawerProvider } from "./cart-drawer";
import { MotionProvider } from "./motion";

/**
 * Client-side context for the storefront: the shopper's language, the lazy
 * animation engine and the slide-in bag. The `store-theme` wrapper scopes
 * storefront-only styling (gold serif headings) so the admin and POS keep
 * their plain UI type; it also carries the language for assistive technology
 * and the Tamil type rules in globals.css.
 */
export function StoreProviders({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <I18nProvider locale={locale}>
      <MotionProvider>
        <div className="store-theme" lang={LOCALE_TAGS[locale]}>
          <CartDrawerProvider>{children}</CartDrawerProvider>
        </div>
      </MotionProvider>
    </I18nProvider>
  );
}
