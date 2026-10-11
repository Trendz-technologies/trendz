"use client";

import { clsx } from "clsx";
import { Languages } from "lucide-react";
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES } from "@/lib/i18n";
import { switchLocale, useI18n } from "@/lib/i18n/client";

/**
 * English / Tamil switch for the storefront. Each language is written in its
 * own script so a shopper can find theirs whatever the page currently shows.
 * `bar` is the slim version that sits on the dark announcement strip at the
 * top of every page; the default is the pill used in the mobile menu.
 */
export function LanguageSwitch({ bar = false, className }: { bar?: boolean; className?: string }) {
  const { locale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("Language")}
      className={clsx(
        "flex items-center",
        // On the strip it covers the ticker behind it, with a soft edge so the text slides under.
        bar ? "gap-0.5 bg-night pl-3 pr-2 shadow-[-14px_0_12px_-2px_var(--color-night)] sm:pr-4 lg:pr-6" : "w-fit gap-1 rounded-full bg-black/[0.05] p-1",
        className,
      )}
    >
      {bar && <Languages size={14} strokeWidth={1.75} aria-hidden="true" className="mr-1 text-gold/70" />}
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={LOCALE_TAGS[l]}
          aria-pressed={l === locale}
          onClick={() => l !== locale && switchLocale(l)}
          className={clsx(
            "font-sans font-semibold transition",
            bar ? "h-full px-1.5 text-xs" : "rounded-full px-4 py-1.5 text-sm",
            bar ? (l === locale ? "text-gold-bright" : "text-white/55 hover:text-white") : l === locale ? "bg-white text-ink shadow-neu" : "text-ink/55 hover:text-ink",
          )}
        >
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
