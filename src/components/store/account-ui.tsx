"use client";

/**
 * Presentation building blocks shared by the account pages.
 * Entrances are CSS animations (animate-rise / animate-fade), so content is in
 * the first paint and never waits for JavaScript; motion is kept for
 * interaction-driven changes only.
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { clsx } from "clsx";
import { ArrowLeft, ArrowUpRight, Check, ShoppingBag } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { OrderListItem } from "@/lib/types";
import { delay, ProgressFill } from "./checkout-ui";
import { SplitWords } from "./motion";

/** Eyebrow + big tight heading, with an optional back link, description and actions. */
export function AccountHeader({
  eyebrow,
  title,
  description,
  back,
  actions,
  children,
  long = false,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
  /** Long single tokens (order numbers): smaller fluid size, allowed to break. */
  long?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-full">
        {back && (
          <div className="animate-fade">
            <Link href={back.href} className="group mb-5 inline-flex items-center gap-2.5 rounded-full text-xs font-semibold text-ink/55 transition hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white transition duration-300 group-hover:-translate-x-0.5 group-hover:border-ink">
                <ArrowLeft size={14} />
              </span>
              {back.label}
            </Link>
          </div>
        )}
        <p className="eyebrow animate-rise">{eyebrow}</p>
        {long ? (
          <h1 className="mt-2 animate-rise break-all text-[clamp(1.75rem,7vw,3rem)] font-bold leading-[1.02] tracking-tighter" style={delay(60)}>
            {title}
          </h1>
        ) : (
          <h1 className="mt-2 text-4xl font-bold tracking-tighter md:text-5xl">
            <SplitWords text={title} delay={0.05} />
          </h1>
        )}
        {description && (
          <div className="mt-3 max-w-xl animate-rise text-sm leading-relaxed text-ink/55" style={delay(150)}>
            {description}
          </div>
        )}
        {children && (
          <div className="animate-rise" style={delay(220)}>
            {children}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex animate-rise flex-wrap items-center gap-2" style={delay(200)}>
          {actions}
        </div>
      )}
    </header>
  );
}

/** White rounded surface that rises in. `delay` is in seconds. */
export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className,
  padded = true,
  delay: delaySeconds = 0,
}: {
  title?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  delay?: number;
}) {
  return (
    <section className={clsx("animate-rise overflow-hidden rounded-3xl bg-white shadow-neu", className)} style={delay(Math.round((0.1 + delaySeconds) * 1000))}>
      {(title || actions || eyebrow) && (
        <header className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (typeof title === "string" ? <h2 className={clsx("text-lg font-bold tracking-tight", eyebrow && "mt-1")}>{title}</h2> : title)}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && "p-5 sm:p-7", padded && (title || eyebrow) && "pt-4 sm:pt-5", !padded && (title || eyebrow) && "pt-2")}>{children}</div>
    </section>
  );
}

// Children rise in one after another (pure CSS, so the list is in the first paint).
const STAGGER =
  "[&>*]:animate-rise [&>*:nth-child(1)]:[animation-delay:150ms] [&>*:nth-child(2)]:[animation-delay:210ms] [&>*:nth-child(3)]:[animation-delay:270ms] [&>*:nth-child(4)]:[animation-delay:330ms] [&>*:nth-child(5)]:[animation-delay:390ms] [&>*:nth-child(6)]:[animation-delay:450ms] [&>*:nth-child(n+7)]:[animation-delay:510ms]";

/**
 * <ul> whose rows rise in one after another on mount. Key it by page to replay
 * on pagination. Keep opacity / transform classes off the rows themselves
 * (the entrance animation owns them); style an inner element instead.
 */
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={clsx(STAGGER, className)}>{children}</ul>;
}

export function StaggerRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={className}>{children}</li>;
}

/** Friendly empty state: floating icon medallion, title, body and an optional action. */
export function EmptyPanel({ icon, title, body, action, bare = false }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode; bare?: boolean }) {
  return (
    <div className={clsx("relative flex animate-rise flex-col items-center overflow-hidden px-6 py-14 text-center sm:py-16", !bare && "rounded-3xl bg-white shadow-neu")} style={delay(100)}>
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-6 h-40 w-40 -translate-x-1/2 rounded-full bg-sand/50 blur-3xl" />
      <div className="relative animate-float">
        <span className="grid h-20 w-20 animate-rise place-items-center rounded-full bg-offwhite text-ink shadow-neu" style={delay(200)}>
          {icon}
        </span>
      </div>
      <p className="relative mt-6 text-xl font-bold tracking-tight">{title}</p>
      {body && <div className="relative mt-2 max-w-sm text-sm text-ink/55">{body}</div>}
      {action && <div className="relative mt-7">{action}</div>}
    </div>
  );
}

/** Loading placeholder for list panels. */
export function RowsSkeleton({ rows = 3, thumb = true, label }: { rows?: number; thumb?: boolean; label?: string }) {
  const { t } = useI18n();
  return (
    <div aria-busy="true" className="divide-y divide-black/5">
      <p role="status" className="sr-only">
        {label ?? t("Loading")}…
      </p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-7">
          {thumb && <div className="skeleton h-16 w-13 shrink-0 rounded-xl" />}
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-40 max-w-full" />
            <div className="skeleton h-3 w-56 max-w-full" />
          </div>
          <div className="skeleton hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Page-level loading placeholder for detail views. */
export function DetailSkeleton({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6" aria-busy="true">
      <p role="status" className="sr-only">
        {label ?? t("Loading")}…
      </p>
      <div className="skeleton h-8 w-28 rounded-full" />
      <div className="skeleton h-3 w-20" />
      <div className="skeleton h-11 w-72 max-w-full" />
      <div className="skeleton h-32 rounded-3xl" />
      <div className="skeleton h-64 rounded-3xl" />
    </div>
  );
}

/** Small product thumbnail. */
export function Thumb({ src, className }: { src: string | null | undefined; className?: string }) {
  return (
    <div className={clsx("grid shrink-0 place-items-center overflow-hidden rounded-xl bg-offwhite text-ink/20", className ?? "h-16 w-13")}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <ShoppingBag size={18} strokeWidth={1.5} />}
    </div>
  );
}

/** The small arrow-in-a-circle that turns when its `group` parent is hovered. */
export function RowArrow({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 text-ink/60 transition duration-500 group-hover:rotate-45 group-hover:border-ink group-hover:bg-ink group-hover:text-white", className)}>
      <ArrowUpRight size={15} />
    </span>
  );
}

/** One order in a list: thumbnail, number, meta line, status, total and arrow. */
export function OrderRow({ order: o, meta }: { order: OrderListItem; meta: ReactNode }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/account/orders/${o.orderNumber}`}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-offwhite/70 focus-visible:bg-offwhite focus-visible:outline-none sm:px-7"
    >
      <div className="relative shrink-0">
        <Thumb src={o.items[0]?.imageUrl} className="h-16 w-13 transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" />
        {o._count.items > 1 && (
          <span aria-hidden="true" className="absolute -bottom-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {o._count.items}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{o.orderNumber}</p>
        <div className="truncate text-xs text-ink/55">{meta}</div>
        {o.status === "PENDING" && o.paymentStatus !== "PAID" && <p className="mt-1 text-xs font-semibold text-warning">{t("Payment pending")}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <StatusBadge status={o.status} />
        <span className="text-sm font-semibold tabular-nums sm:w-24 sm:text-right">{money(o.grandTotal)}</span>
      </div>
      <RowArrow className="hidden sm:grid" />
    </Link>
  );
}

/**
 * Horizontal progress tracker: the bar fills up to the current step, then the
 * reached dots light up one after another. CSS transitions from
 * @starting-style, so the correct state is in the first paint.
 */
export function StatusTrack({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  const { t } = useI18n();
  const n = steps.length;
  const progress = n > 1 ? Math.max(0, Math.min(current, n - 1)) / (n - 1) : 0;
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute top-[11.5px] h-[3px] overflow-hidden rounded-full bg-black/[0.07]" style={{ left: `${50 / n}%`, right: `${50 / n}%` }}>
        <ProgressFill value={progress} className="bg-ink" delayMs={250} durationMs={1300} />
      </div>
      <ol aria-label={label} className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const reached = i <= current;
          const isCurrent = i === current;
          // Light each dot roughly when the growing bar reaches it.
          const lightAt: CSSProperties = { transitionDelay: `${250 + (n > 1 ? Math.round((i / (n - 1)) * 700) : 0)}ms` };
          return (
            <li key={s} aria-current={isCurrent ? "step" : undefined} className="flex flex-col items-center gap-2.5 px-0.5 text-center">
              <span
                className={clsx(
                  "relative grid h-[26px] w-[26px] place-items-center rounded-full border-2 transition-colors duration-500",
                  reached ? "border-ink bg-ink starting:border-black/10 starting:bg-white" : "border-black/10 bg-white",
                )}
                style={lightAt}
              >
                {reached && !isCurrent && (
                  <span className="grid place-items-center transition-[scale] duration-500 ease-out-expo starting:[scale:0]" style={lightAt}>
                    <Check size={12} strokeWidth={3.5} className="text-white" />
                  </span>
                )}
                {isCurrent && (
                  <>
                    <span className="h-2 w-2 rounded-full bg-white" />
                    <span aria-hidden="true" className="absolute -inset-1 animate-pulse-dot rounded-full" />
                  </>
                )}
              </span>
              <span className={clsx("text-[11px] font-semibold leading-tight ta:wrap-anywhere sm:text-xs", reached ? "text-ink" : "text-ink/40")}>
                {s}
                <span className="sr-only">{isCurrent ? ` ${t("(current)")}` : reached ? ` ${t("(done)")}` : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
