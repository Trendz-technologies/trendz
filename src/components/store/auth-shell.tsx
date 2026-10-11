"use client";

/**
 * Split layout for the sign-in / sign-up family of pages: the form on one
 * side, a bold brand panel on the other (desktop). Presentation only.
 * Entrances are CSS animations, so the form is never hidden while scripts load.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { ArrowUpRight, Check, CircleAlert, Loader2 } from "lucide-react";
import { msg } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { delay } from "./checkout-ui";
import { Doodle } from "./doodle";
import { LogoMark } from "./navbar";

const PERKS = [msg("Track every order with live updates"), msg("Save addresses for a faster checkout"), msg("Request returns in a few taps"), msg("Keep a wishlist across devices")];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  tagline: taglineProp,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tagline?: string;
}) {
  const { t } = useI18n();
  const tagline = taglineProp ?? t("Wear the moment.");
  return (
    <div className="container-x py-6 md:py-10">
      <div className="grid gap-4 lg:min-h-[min(820px,calc(100svh-9rem))] lg:grid-cols-2 lg:gap-6">
        <MobileBrand tagline={tagline} />
        <section className="relative isolate flex min-w-0 flex-col justify-center rounded-[2rem] bg-white px-5 py-10 shadow-neu sm:px-10 lg:px-14 lg:py-14">
          {/* Doodles in two corners, behind the form. */}
          <Doodle art="bow" className="absolute right-3 top-3 -z-10 w-28 rotate-12 text-accent/30 sm:right-4 sm:top-4 sm:w-32 lg:w-36" />
          <Doodle art="flower" className="absolute bottom-3 left-2 -z-10 w-24 -rotate-12 text-gold/30 sm:w-32 lg:left-4 lg:w-36" />
          <div className="mx-auto w-full max-w-md">
            <p className="eyebrow animate-rise" style={delay(60)}>
              {eyebrow}
            </p>
            <h1 className="mt-3 animate-rise text-4xl font-bold tracking-tighter md:text-5xl ta:text-3xl ta:md:text-4xl" style={delay(120)}>
              {title}
            </h1>
            {subtitle && (
              <div className="mt-3 animate-rise text-sm leading-relaxed text-ink/55" style={delay(180)}>
                {subtitle}
              </div>
            )}
            <div className="mt-8 animate-rise" style={delay(240)}>
              {children}
            </div>
            {footer && (
              <div className="mt-8 animate-rise border-t border-black/5 pt-6 text-center text-sm text-ink/60" style={delay(320)}>
                {footer}
              </div>
            )}
          </div>
        </section>
        <BrandPanel tagline={tagline} />
      </div>
    </div>
  );
}

function MobileBrand({ tagline }: { tagline: string }) {
  const { t } = useI18n();
  return (
    <div className="on-dark gold-frame relative animate-fade overflow-hidden rounded-[2rem] bg-ink px-6 py-5 text-white lg:hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 animate-float rounded-full bg-accent/40 blur-3xl" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50 ta:text-xs">{t("Trendz members")}</p>
          <p className="mt-1 text-xl font-bold tracking-tight">{tagline}</p>
        </div>
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-accent">
          <span className="animate-spin-slow">
            <LogoMark size={20} />
          </span>
        </span>
      </div>
    </div>
  );
}

function BrandPanel({ tagline }: { tagline: string }) {
  const { t } = useI18n();
  return (
    <aside aria-label={t("Why join Trendz")} className="on-dark gold-frame relative hidden min-w-0 animate-fade overflow-hidden rounded-[2rem] bg-ink p-10 text-white shadow-neu-lg lg:flex lg:flex-col xl:p-14">
      {/* Slowly drifting colour fields + a fine dot texture. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 animate-float rounded-full bg-accent/40 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 h-112 w-112 animate-float rounded-full bg-sand/25 blur-3xl [animation-delay:-3s]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.09)_1px,transparent_0)] bg-[length:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
      />
      <Doodle art="dress" className="absolute left-1/2 top-[13%] w-72 -translate-x-1/2 -rotate-6 text-gold/20 xl:w-80" />

      {/* Floating badge. */}
      <div aria-hidden="true" className="absolute right-10 top-10 animate-float [animation-delay:-1.5s] xl:right-14 xl:top-14">
        <div className="relative grid h-28 w-28 place-items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-spin-slow">
            <defs>
              <path id="auth-badge-circle" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
            </defs>
            <text className="fill-white/70 text-[9px] font-semibold uppercase">
              <textPath href="#auth-badge-circle" textLength="228" lengthAdjust="spacing">{t("Members ✦ Trendz ✦ Members ✦ Trendz ✦")}</textPath>
            </text>
          </svg>
          <span className="text-accent">
            <LogoMark size={26} />
          </span>
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        <LogoMark />
        <span lang="en" className="text-sm font-bold tracking-[0.3em]">TRENDZ</span>
      </div>

      <div className="relative mt-auto pt-16">
        <p className="max-w-sm animate-rise text-4xl font-bold leading-[0.95] tracking-tighter xl:text-5xl ta:text-3xl ta:leading-tight ta:xl:text-4xl" style={delay(250)}>
          {tagline}
        </p>
        <ul className="mt-8 space-y-3">
          {PERKS.map((p, i) => (
            <li key={p} className="flex animate-rise items-center gap-3 text-sm text-white/75" style={delay(400 + i * 80)}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10">
                <Check size={12} strokeWidth={3} />
              </span>
              {t(p)}
            </li>
          ))}
        </ul>
      </div>

      <div aria-hidden="true" className="relative -mb-[0.18em] mt-10 overflow-hidden">
        <p lang="en" className="animate-word-rise select-none bg-gradient-to-b from-white to-white/10 bg-clip-text text-[clamp(4.5rem,8.5vw,8rem)] font-bold leading-[0.85] tracking-tighter text-transparent" style={delay(150)}>
          TRENDZ
        </p>
      </div>
    </aside>
  );
}

/** Full-width submit button with the turning arrow (spinner while busy). */
export function AuthSubmit({ loading, children, className, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="submit"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "group flex h-14 w-full items-center justify-between rounded-full bg-ink py-1.5 pl-7 pr-2 text-sm font-semibold text-white shadow-neu-lg transition-[background-color,box-shadow] duration-300 hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:bg-ink/40 disabled:shadow-none",
        className,
      )}
    >
      <span>{children}</span>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-enabled:group-hover:rotate-45">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={17} />}
      </span>
    </button>
  );
}

/** Form-level error that slides in with a small shake (only ever appears after a submit). */
export function FormAlert({ message, className }: { message?: string | null; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <m.p
          key={message}
          role="alert"
          className={clsx("flex items-start gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger", className)}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 3, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          <CircleAlert size={16} className="mt-0.5 shrink-0" /> {message}
        </m.p>
      )}
    </AnimatePresence>
  );
}

/** Icon medallion used for success / error states (CSS entrance on mount). */
export function AuthMedallion({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "success" | "danger" }) {
  return (
    <span
      className={clsx(
        "grid h-20 w-20 animate-rise place-items-center rounded-full",
        tone === "success" && "bg-success/10 text-success",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "ink" && "bg-offwhite text-ink",
      )}
    >
      {children}
    </span>
  );
}

/** Suspense fallback with the same footprint as the shell. */
export function AuthFallback() {
  const { t } = useI18n();
  return (
    <div className="container-x py-6 md:py-10" aria-busy="true">
      <p role="status" className="sr-only">
        {t("Loading")}…
      </p>
      <div className="grid gap-4 lg:min-h-[min(820px,calc(100svh-9rem))] lg:grid-cols-2 lg:gap-6">
        <div className="skeleton h-24 rounded-[2rem] lg:hidden" />
        <div className="flex flex-col justify-center rounded-[2rem] bg-white px-5 py-10 shadow-neu sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-md space-y-4">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-11 w-2/3" />
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton mt-6 h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-14 w-full rounded-full" />
          </div>
        </div>
        <div className="skeleton hidden rounded-[2rem] lg:block" />
      </div>
    </div>
  );
}
