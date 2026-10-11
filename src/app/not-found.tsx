"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StandaloneDoodles } from "@/components/store/standalone-doodles";
import { LOCALE_TAGS, msg } from "@/lib/i18n";
import { useStandaloneI18n } from "@/lib/i18n/client";

/*
 * Rendered outside the storefront layout (no motion provider), so every
 * animation here is a CSS keyframe from globals.css.
 */

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 2 L13.8 9.2 21 11 13.8 12.8 12 20 10.2 12.8 3 11 10.2 9.2 Z" fill="currentColor" />
    </svg>
  );
}

const SUGGESTIONS = [
  { label: msg("New arrivals"), href: "/products?sort=newest" },
  { label: msg("Today's offers"), href: "/offers" },
  { label: msg("Track an order"), href: "/account/orders" },
  { label: msg("Your wishlist"), href: "/account/wishlist" },
];

export default function NotFound() {
  const { t, locale } = useStandaloneI18n();
  return (
    <div lang={LOCALE_TAGS[locale]} className="store-theme relative flex min-h-svh flex-col overflow-hidden">
      <StandaloneDoodles />
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-10 h-[26rem] w-[26rem] animate-float rounded-full bg-sand/70 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-[22rem] w-[22rem] animate-float rounded-full bg-mist blur-3xl [animation-delay:-3s]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-1/4 top-1/3 h-40 w-40 animate-float rounded-full bg-accent/15 blur-3xl [animation-delay:-1.5s]" />

      <header className="container-x relative flex h-16 items-center">
        <Link href="/" className="group flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25" aria-label={t("{store} home", { store: "Trendz" })}>
          <span className="transition-transform duration-700 ease-out-expo group-hover:rotate-180">
            <Star className="h-[18px] w-[18px]" />
          </span>
          <span lang="en" className="text-sm font-bold tracking-[0.3em]">TRENDZ</span>
        </Link>
      </header>

      <main className="container-x relative flex flex-1 flex-col items-center justify-center py-12 text-center">
        <p className="eyebrow animate-rise">{t("Error 404")}</p>

        {/* The big 404: two floating fours around a spinning "0" ring. */}
        <div lang="en" aria-hidden="true" className="mt-4 flex select-none items-center justify-center text-[clamp(7rem,26vw,17rem)] font-bold leading-none tracking-tighter">
          <span className="inline-block animate-rise [animation-delay:80ms]">
            <span className="inline-block animate-float">4</span>
          </span>
          <span className="mx-[0.03em] inline-block animate-rise [animation-delay:180ms]">
            <span className="relative grid h-[0.74em] w-[0.6em] place-items-center">
              <span className="absolute inset-0 rounded-[50%] border-[0.1em] border-ink" />
              <span className="absolute inset-[24%] animate-spin-slow rounded-full border-[0.02em] border-dashed border-ink/35" />
              <span className="relative animate-spin-slow text-accent">
                <Star className="h-[0.2em] w-[0.2em]" />
              </span>
            </span>
          </span>
          <span className="inline-block animate-rise [animation-delay:280ms]">
            <span className="inline-block animate-float [animation-delay:-2s]">4</span>
          </span>
        </div>

        <h1 className="mt-6 animate-rise text-4xl font-bold tracking-tighter md:text-5xl [animation-delay:340ms]">{t("This page wandered off")}</h1>
        <p className="mt-4 max-w-sm animate-rise text-sm leading-relaxed text-ink/55 [animation-delay:420ms]">
          {t("The page you are looking for does not exist or is no longer available. Let's get you back to the good stuff.")}
        </p>

        <div className="mt-9 flex animate-rise flex-wrap justify-center gap-3 [animation-delay:500ms]">
          <Link
            href="/products"
            className="group inline-flex items-center gap-4 rounded-full bg-ink py-1.5 pl-6 pr-1.5 text-sm font-semibold text-white shadow-neu-lg transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35"
          >
            {t("Browse products")}
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:rotate-45">
              <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex h-13 items-center rounded-full border border-ink/15 px-7 text-sm font-semibold transition hover:border-ink hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
          >
            {t("Back home")}
          </Link>
        </div>

        <nav aria-label={t("Popular pages")} className="mt-12 animate-fade [animation-delay:700ms]">
          <p className="eyebrow">{t("Or try")}</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="inline-block rounded-full border border-black/10 bg-white/70 px-4 py-1.5 text-sm backdrop-blur transition hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
                >
                  {t(s.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>

      <div aria-hidden="true" className="on-dark ribbon relative -rotate-1 overflow-hidden py-4 text-white">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className="flex items-center gap-8 pr-8 text-2xl font-bold uppercase tracking-tighter md:text-3xl">
                  <span>{t("Lost but stylish")}</span>
                  <span className="text-accent">✦</span>
                  <span className="text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.8)]">{t("Keep exploring")}</span>
                  <span className="text-accent">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
