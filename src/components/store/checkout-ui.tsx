"use client";

/**
 * Shared presentation pieces for the bag, checkout and order confirmation.
 * Display only: every amount shown here comes from the server.
 */
import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, m, type Variants } from "motion/react";
import { clsx } from "clsx";
import { ArrowUpRight, Check, Truck } from "lucide-react";
import { money } from "@/lib/format";
import { msg } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { EASE_OUT } from "./motion";

/** Inline style for a CSS entrance (animate-rise / animate-fade) that starts after `ms`. */
export const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * Bar fill that grows to `value` (0–1) with CSS only: @starting-style gives the
 * first paint a zero scale to transition from, so the correct value is in the
 * server HTML and nothing waits for JavaScript. Later changes transition too.
 */
export function ProgressFill({ value, className, delayMs = 0, durationMs = 1100 }: { value: number; className?: string; delayMs?: number; durationMs?: number }) {
  const style = { "--fill": Math.max(0, Math.min(1, value)), transitionDuration: `${durationMs}ms`, transitionDelay: `${delayMs}ms` } as CSSProperties;
  return <div className={clsx("h-full origin-left rounded-full ease-out-expo [scale:var(--fill)_1] [transition-property:scale,background-color] starting:[scale:0_1]", className)} style={style} />;
}

const roll: Variants = {
  enter: (dir: number) => ({ y: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { y: "0%", opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

/** A number that rolls up (or down) to its new value, odometer-style. */
export function RollingNumber({ value, format = String, className }: { value: number; format?: (n: number) => string; className?: string }) {
  // Remember the previous value (during render, not in an effect) to pick the roll direction.
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState(1);
  if (value !== shown) {
    setDir(value > shown ? 1 : -1);
    setShown(value);
  }
  return (
    <span className={clsx("relative inline-flex overflow-hidden tabular-nums", className)}>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <m.span key={value} custom={dir} variants={roll} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4, ease: EASE_OUT }} className="inline-block whitespace-nowrap">
          {format(value)}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

/** Progress towards the free-shipping threshold (server-provided numbers only). */
export function FreeShippingMeter({ threshold, left, className }: { threshold: number; left: number; className?: string }) {
  const { t, tr } = useI18n();
  const unlocked = left <= 0;
  const progress = threshold > 0 ? Math.min(1, Math.max(0, (threshold - left) / threshold)) : 1;
  return (
    <div className={className}>
      <div className="flex items-center gap-3 text-sm">
        <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors duration-500", unlocked ? "bg-success text-white" : "bg-ink/6 text-ink")}>
          <Truck size={16} strokeWidth={1.75} />
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={unlocked ? "unlocked" : "locked"}
            className="min-w-0 flex-1 text-ink/70"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            {unlocked ? (
              <span className="font-semibold text-success">{t("You've unlocked free shipping")}</span>
            ) : (
              tr("Add {amount} more for free shipping", { amount: <RollingNumber value={left} format={money} className="align-bottom font-semibold text-ink" /> })
            )}
          </m.p>
        </AnimatePresence>
      </div>
      <div
        role="progressbar"
        aria-label={t("Progress towards free shipping")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/6"
      >
        <ProgressFill value={progress} className={unlocked ? "bg-success" : "bg-ink"} />
      </div>
    </div>
  );
}

const STEPS = [msg("Address"), msg("Review"), msg("Pay")] as const;

/** Address → Review → Pay header with an animated progress line. */
export function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("Checkout progress")} className="relative">
      <div aria-hidden="true" className="absolute left-[16.667%] right-[16.667%] top-4.5 h-0.5 overflow-hidden rounded-full bg-black/10">
        <ProgressFill value={current / (STEPS.length - 1)} className="bg-ink" durationMs={900} />
      </div>
      <ol className="relative grid grid-cols-3">
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className="flex flex-col items-center gap-2">
              <span
                className={clsx(
                  "relative grid h-9 w-9 place-items-center rounded-full text-xs font-bold transition-colors duration-500",
                  done || active ? "bg-ink text-white" : "bg-white text-ink/40 shadow-neu",
                )}
              >
                {active && <m.span layoutId="checkout-step-ring" className="absolute -inset-1.5 rounded-full border-2 border-ink/15" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                <AnimatePresence mode="wait" initial={false}>
                  <m.span
                    key={done ? "done" : "todo"}
                    className="grid place-items-center"
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.3, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 24 }}
                  >
                    {done ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </m.span>
                </AnimatePresence>
              </span>
              <span className={clsx("text-xs font-semibold transition-colors duration-500", done || active ? "text-ink" : "text-ink/40")}>
                {t(label)}
                <span className="sr-only">{done ? ` ${t("(completed)")}` : active ? ` ${t("(current step)")}` : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A check mark inside a circle that draws itself. */
export function DrawnCheck({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <m.path
        d="M32 3a29 29 0 1 1 0 58a29 29 0 1 1 0-58"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ pathLength: { duration: 0.9, ease: EASE_OUT, delay }, opacity: { duration: 0.01, delay } }}
      />
      <m.path
        d="M20 33.5 28.5 42 45 24"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ pathLength: { duration: 0.55, ease: EASE_OUT, delay: delay + 0.55 }, opacity: { duration: 0.01, delay: delay + 0.55 } }}
      />
    </svg>
  );
}

/** Primary pill link with the arrow-in-a-circle that turns on hover. */
export function CtaLink({ href, children, className, tone = "dark", onClick }: { href: string; children: ReactNode; className?: string; tone?: "dark" | "light"; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "group inline-flex items-center justify-between gap-4 rounded-full py-1.5 pl-6 pr-1.5 text-sm font-semibold transition-[background-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-4",
        tone === "dark" ? "bg-ink text-white shadow-neu-lg hover:bg-ink/90 focus-visible:ring-accent/35" : "bg-white text-ink shadow-neu hover:shadow-neu-lg focus-visible:ring-accent/25",
        className,
      )}
    >
      {children}
      <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-45", tone === "dark" ? "bg-white text-ink" : "bg-ink text-white")}>
        <ArrowUpRight size={16} />
      </span>
    </Link>
  );
}

/** Secondary outline pill link. */
export function GhostLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex h-13 items-center justify-center rounded-full border border-ink/15 px-7 text-sm font-semibold transition hover:border-ink hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25",
        className,
      )}
    >
      {children}
    </Link>
  );
}
