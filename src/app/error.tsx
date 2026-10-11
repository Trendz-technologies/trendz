"use client";

import Link from "next/link";
import { RotateCw } from "lucide-react";
import { StandaloneDoodles } from "@/components/store/standalone-doodles";
import { LOCALE_TAGS } from "@/lib/i18n";
import { useStandaloneI18n } from "@/lib/i18n/client";

/*
 * Rendered outside the storefront layout (no motion provider), so every
 * animation here is a CSS keyframe from globals.css.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // This replaces the storefront layout and its language provider.
  const { t, locale } = useStandaloneI18n();
  return (
    <div lang={LOCALE_TAGS[locale]} className="store-theme relative flex min-h-[80svh] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <StandaloneDoodles />
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-0 h-80 w-80 animate-float rounded-full bg-sand/70 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 animate-float rounded-full bg-accent/15 blur-3xl [animation-delay:-3s]" />

      <div aria-hidden="true" className="relative animate-rise">
        <div className="relative grid h-28 w-28 animate-float place-items-center">
          <span className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-ink/20" />
          <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-4xl font-bold tracking-tighter shadow-neu-lg">
            <span className="text-accent">!</span>
          </span>
        </div>
      </div>

      <p className="eyebrow relative mt-8 animate-rise [animation-delay:80ms]">{t("Unexpected error")}</p>
      <h1 className="relative mt-3 animate-rise text-4xl font-bold tracking-tighter md:text-5xl [animation-delay:160ms]">{t("Something went wrong")}</h1>
      <p className="relative mt-4 max-w-sm animate-rise text-sm leading-relaxed text-ink/55 [animation-delay:240ms]">{t("Please try again. If the problem continues, contact support.")}</p>
      {error.digest && (
        <p className="relative mt-3 animate-fade font-mono text-[11px] text-ink/35 [animation-delay:320ms]">
          {t("Reference: {code}", { code: error.digest })}
        </p>
      )}

      <div className="relative mt-9 flex animate-rise flex-wrap justify-center gap-3 [animation-delay:320ms]">
        <button
          type="button"
          onClick={reset}
          className="group inline-flex items-center gap-4 rounded-full bg-ink py-1.5 pl-6 pr-1.5 text-sm font-semibold text-white shadow-neu-lg transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35"
        >
          {t("Try again")}
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:rotate-180">
            <RotateCw size={16} />
          </span>
        </button>
        <Link
          href="/"
          className="inline-flex h-13 items-center rounded-full border border-ink/15 px-7 text-sm font-semibold transition hover:border-ink hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
        >
          {t("Back home")}
        </Link>
      </div>
    </div>
  );
}
