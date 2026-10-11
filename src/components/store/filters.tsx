"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useOptimistic, useRef, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { ArrowDownUp, ArrowUpRight, Check, ChevronDown, LoaderCircle, SearchX, SlidersHorizontal, X } from "lucide-react";
import { money } from "@/lib/format";
import { msg, type I18n } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { isColorOption, swatch } from "./colors";
import { EASE_OUT } from "./motion";
import { RollingNumber } from "./shop-rolling-number";

export interface Facets {
  brands: { name: string; slug: string; count: number }[];
  price: { min: number; max: number };
  options: { name: string; values: { value: string; count: number }[] }[];
}

const SORTS = [
  { value: "", label: msg("Recommended") },
  { value: "newest", label: msg("Newest") },
  { value: "price_asc", label: msg("Price: low to high") },
  { value: "price_desc", label: msg("Price: high to low") },
  { value: "name", label: msg("Name") },
];

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite";

const list = (value: string | null) => (value ?? "").split(",").filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Listing state: URL search params, updated optimistically                    */
/* -------------------------------------------------------------------------- */

interface ListingState {
  /** Current search params — reflects a filter change immediately, before the new page arrives. */
  params: URLSearchParams;
  /** True while the server renders the new results. */
  pending: boolean;
  update: (changes: Record<string, string | null>) => void;
  clearAll: () => void;
  /** How many products the list has put on the page so far (it loads more as the shopper scrolls); null until it says. */
  shown: number | null;
  reportShown: (count: number) => void;
}

const ListingContext = createContext<ListingState | null>(null);

function useListing() {
  const ctx = useContext(ListingContext);
  if (!ctx) throw new Error("Listing controls must be rendered inside <ListingProvider>");
  return ctx;
}

/**
 * Shares the listing's search params between the filter sidebar, mobile drawer,
 * chips and sort menu. `query` is the page's current query string (from the server).
 */
export function ListingProvider({ query, children }: { query: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(query);
  // Remembered with the results it belongs to, so a count from the previous filters is never shown against the new ones.
  const [progress, setProgress] = useState<{ query: string; count: number } | null>(null);
  const reportShown = useCallback((count: number) => setProgress({ query, count }), [query]);
  const shown = progress?.query === query ? progress.count : null;

  const value = useMemo<ListingState>(() => {
    const params = new URLSearchParams(optimisticQuery);
    const update = (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      startTransition(() => {
        setOptimisticQuery(qs);
        router.push(`${pathname}?${qs}`, { scroll: false });
      });
    };
    const clearAll = () => update(Object.fromEntries([...params.keys()].filter((k) => !["q", "sort"].includes(k)).map((k) => [k, null])));
    return { params, pending, update, clearAll, shown, reportShown };
  }, [optimisticQuery, pending, pathname, router, setOptimisticQuery, shown, reportShown]);

  return <ListingContext.Provider value={value}>{children}</ListingContext.Provider>;
}

interface Chip {
  id: string;
  label: string;
  group?: string;
  remove: Record<string, string | null>;
}

/** Every active filter as a removable chip. */
function activeChips(params: URLSearchParams, facets: Facets, t: I18n["t"], tx: I18n["tx"]): Chip[] {
  const chips: Chip[] = [];
  if (params.get("inStock") === "true") chips.push({ id: "inStock", label: t("In stock"), remove: { inStock: null, page: null } });
  if (params.get("featured") === "true") chips.push({ id: "featured", label: t("Trending"), remove: { featured: null, page: null } });
  for (const [key, raw] of params) {
    if (!key.startsWith("opt.")) continue;
    const values = list(raw);
    for (const value of values) {
      chips.push({ id: `${key}:${value}`, group: tx(key.slice(4)), label: tx(value), remove: { [key]: values.filter((v) => v !== value).join(",") || null, page: null } });
    }
  }
  const brands = list(params.get("brand"));
  for (const slug of brands) {
    chips.push({ id: `brand:${slug}`, group: t("Brand"), label: facets.brands.find((b) => b.slug === slug)?.name ?? slug, remove: { brand: brands.filter((b) => b !== slug).join(",") || null, page: null } });
  }
  const min = params.get("minPrice");
  const max = params.get("maxPrice");
  if (min || max) {
    const label = min && max ? `${money(Number(min))} – ${money(Number(max))}` : min ? t("From {amount}", { amount: money(Number(min)) }) : t("Up to {amount}", { amount: money(Number(max)) });
    chips.push({ id: "price", group: t("Price"), label, remove: { minPrice: null, maxPrice: null, page: null } });
  }
  return chips;
}

/* -------------------------------------------------------------------------- */
/* Filter controls                                                             */
/* -------------------------------------------------------------------------- */

function FilterSection({ title, badge = 0, children }: { title: string; badge?: number; children: ReactNode }) {
  // Every group starts closed, so the list of filters is short; the badge still shows how many are applied inside.
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="border-b border-black/[0.07] py-5 first:pt-0">
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className={clsx("group flex w-full items-center justify-between gap-3 rounded-lg text-left", FOCUS_RING)}>
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70 transition-colors group-hover:text-ink">
            {title}
            <AnimatePresence initial={false}>
              {badge > 0 && (
                <m.span
                  key={badge}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                  className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink px-1 text-[10px] tracking-normal text-white"
                >
                  {badge}
                </m.span>
              )}
            </AnimatePresence>
          </span>
          <span className="grid h-7 w-7 place-items-center rounded-full text-ink/50 transition-colors group-hover:bg-black/5 group-hover:text-ink">
            <m.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.4, ease: EASE_OUT }} className="grid place-items-center">
              <ChevronDown size={15} />
            </m.span>
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={id}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="-mx-1 overflow-hidden px-1"
          >
            <div className="pb-1 pt-4">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function StockToggle() {
  const { t } = useI18n();
  const { params, update } = useListing();
  const on = params.get("inStock") === "true";
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => update({ inStock: on ? null : "true", page: null })} className={clsx("flex w-full items-center justify-between gap-3 rounded-xl py-1 text-sm", FOCUS_RING)}>
      <span>{t("In stock only")}</span>
      <span className={clsx("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300", on ? "justify-end bg-accent" : "justify-start bg-black/15")}>
        <m.span layout transition={{ type: "spring", stiffness: 600, damping: 36 }} className="h-5 w-5 rounded-full bg-white shadow-sm" />
      </span>
    </button>
  );
}

/** Rough perceived brightness, to pick a readable tick colour on a swatch. */
function isLight(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = n >> 16;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 165;
}

function OptionFilter({ option }: { option: Facets["options"][number] }) {
  const { tn, tx } = useI18n();
  const { params, update } = useListing();
  const key = `opt.${option.name}`;
  const current = list(params.get(key));
  const toggle = (value: string) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.join(",") || null, page: null });
  };

  if (isColorOption(option.name)) {
    return (
      <div className="grid grid-cols-2 gap-1.5 ta:grid-cols-1">
        {option.values.map((v) => {
          const active = current.includes(v.value);
          const hex = swatch(v.value);
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => toggle(v.value)}
              aria-pressed={active}
              className={clsx(
                "flex min-w-0 items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-3 text-left text-xs font-medium transition-[background-color,border-color,box-shadow] duration-300",
                FOCUS_RING,
                active ? "border-ink bg-white shadow-neu" : "border-transparent hover:bg-white",
              )}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: hex }}>
                <AnimatePresence initial={false}>
                  {active && (
                    <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 520, damping: 24 }} className="grid place-items-center">
                      <Check size={12} strokeWidth={3} className={isLight(hex) ? "text-ink" : "text-white"} />
                    </m.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="min-w-0 flex-1 truncate">{tx(v.value)}</span>
              <span className="text-[10px] tabular-nums text-ink/35">{v.count}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {option.values.map((v) => {
        const active = current.includes(v.value);
        return (
          <m.button
            key={v.value}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => toggle(v.value)}
            aria-pressed={active}
            title={tn(v.count, "{n} product", "{n} products")}
            className={clsx(
              "h-9 min-w-11 rounded-full border px-3.5 text-xs font-semibold transition-colors duration-300",
              FOCUS_RING,
              active ? "border-ink bg-ink text-white" : "border-black/10 bg-white hover:border-ink/50",
            )}
          >
            {tx(v.value)}
          </m.button>
        );
      })}
    </div>
  );
}

const BRAND_LIMIT = 6;

function BrandFilter({ brands }: { brands: Facets["brands"] }) {
  const { t } = useI18n();
  const { params, update } = useListing();
  const selected = list(params.get("brand"));
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? brands : brands.slice(0, BRAND_LIMIT);
  const toggle = (slug: string) => {
    const next = selected.includes(slug) ? selected.filter((b) => b !== slug) : [...selected, slug];
    update({ brand: next.join(",") || null, page: null });
  };

  return (
    <div>
      <ul>
        <AnimatePresence initial={false}>
          {shown.map((b) => {
            const checked = selected.includes(b.slug);
            return (
              <m.li key={b.slug} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }} className="overflow-hidden">
                <label className="group flex cursor-pointer items-center gap-3 py-1.5 text-sm">
                  <input type="checkbox" className="peer sr-only" checked={checked} onChange={() => toggle(b.slug)} />
                  <span
                    className={clsx(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-offwhite",
                      checked ? "border-ink bg-ink text-white" : "border-black/20 bg-white group-hover:border-ink/60",
                    )}
                  >
                    <AnimatePresence initial={false}>
                      {checked && (
                        <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 520, damping: 24 }} className="grid place-items-center">
                          <Check size={12} strokeWidth={3} />
                        </m.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className={clsx("flex-1 transition-colors", checked ? "font-medium text-ink" : "text-ink/75 group-hover:text-ink")}>{b.name}</span>
                  <span className="text-xs tabular-nums text-ink/35">{b.count}</span>
                </label>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {brands.length > BRAND_LIMIT && (
        <button type="button" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll} className={clsx("link-draw mt-3 rounded-sm text-xs font-semibold", FOCUS_RING)}>
          {showAll ? t("Show fewer") : t("Show all {count}", { count: brands.length })}
        </button>
      )}
    </div>
  );
}

const rupeesFromParam = (paise: string | null) => (paise ? String(Number(paise) / 100) : "");

function PriceFilter({ facets }: { facets: Facets }) {
  const { t } = useI18n();
  const { params, update } = useListing();
  const minParam = params.get("minPrice");
  const maxParam = params.get("maxPrice");
  const source = `${minParam ?? ""}|${maxParam ?? ""}`;
  const [synced, setSynced] = useState(source);
  const [min, setMin] = useState(rupeesFromParam(minParam));
  const [max, setMax] = useState(rupeesFromParam(maxParam));
  // Keep the inputs in step with the URL (e.g. after "Clear all"), adjusting state during render.
  if (synced !== source) {
    setSynced(source);
    setMin(rupeesFromParam(minParam));
    setMax(rupeesFromParam(maxParam));
  }

  return (
    <div>
      {facets.price.max > 0 && (
        <p className="text-xs text-ink/45">{t("Range {min} – {max}", { min: money(facets.price.min), max: money(facets.price.max) })}</p>
      )}
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          update({ minPrice: min ? String(Math.round(Number(min) * 100)) : null, maxPrice: max ? String(Math.round(Number(max) * 100)) : null, page: null });
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <label className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink/40">₹</span>
            <input aria-label={t("Minimum price")} value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder={t("Min")} className="input rounded-full py-2 pl-7" />
          </label>
          <span aria-hidden="true" className="text-ink/30">
            –
          </span>
          <label className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink/40">₹</span>
            <input aria-label={t("Maximum price")} value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder={t("Max")} className="input rounded-full py-2 pl-7" />
          </label>
        </div>
        <button type="submit" className={clsx("group flex h-10 w-full items-center justify-center gap-2 rounded-full border border-ink/15 text-xs font-semibold transition-colors hover:border-ink hover:bg-ink hover:text-white", FOCUS_RING)}>
          {t("Apply price")}
          <ArrowUpRight size={14} className="transition-transform duration-500 group-hover:rotate-45" />
        </button>
      </form>
    </div>
  );
}

function FilterPanel({ facets }: { facets: Facets }) {
  const { t, tx } = useI18n();
  const { params } = useListing();
  const count = (key: string) => list(params.get(key)).length;
  return (
    <div>
      <FilterSection title={t("Availability")} badge={params.get("inStock") === "true" ? 1 : 0}>
        <StockToggle />
      </FilterSection>
      {facets.options.map((o) => (
        <FilterSection key={o.name} title={tx(o.name)} badge={count(`opt.${o.name}`)}>
          <OptionFilter option={o} />
        </FilterSection>
      ))}
      {facets.brands.length > 0 && (
        <FilterSection title={t("Brand")} badge={count("brand")}>
          <BrandFilter brands={facets.brands} />
        </FilterSection>
      )}
      <FilterSection title={t("Price")} badge={params.get("minPrice") || params.get("maxPrice") ? 1 : 0}>
        <PriceFilter facets={facets} />
      </FilterSection>
    </div>
  );
}

/** Desktop filter column. */
export function FilterSidebar({ facets }: { facets: Facets }) {
  const { t, tx } = useI18n();
  const { params, clearAll } = useListing();
  const active = activeChips(params, facets, t, tx).length;
  return (
    <div>
      <div className="mb-6 flex h-6 items-center justify-between">
        <p className="eyebrow">{t("Filter by")}</p>
        <AnimatePresence initial={false}>
          {active > 0 && (
            <m.button
              key="clear"
              type="button"
              onClick={clearAll}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className={clsx("link-draw rounded-sm text-xs font-semibold text-ink/60 hover:text-ink", FOCUS_RING)}
            >
              {t("Clear all")}
            </m.button>
          )}
        </AnimatePresence>
      </div>
      <FilterPanel facets={facets} />
    </div>
  );
}

/** Removable chips for every active filter, plus "Clear all". */
export function ActiveFilters({ facets }: { facets: Facets }) {
  const { t, tx } = useI18n();
  const { params, update, clearAll } = useListing();
  const chips = activeChips(params, facets, t, tx);
  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <m.div key="chips" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE_OUT }} className="-mx-1 overflow-hidden px-1">
          <ul aria-label={t("Active filters")} className="flex flex-wrap items-center gap-2 pb-7 pt-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {chips.map((c) => (
                <m.li key={c.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
                  <button
                    type="button"
                    onClick={() => update(c.remove)}
                    aria-label={t("Remove filter {filter}", { filter: `${c.group ? `${c.group}: ` : ""}${c.label}` })}
                    className={clsx("group inline-flex h-9 items-center gap-1.5 rounded-full bg-ink pl-3.5 pr-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink/85", FOCUS_RING)}
                  >
                    {c.group && <span className="font-medium text-white/50">{c.group}</span>}
                    {c.label}
                    <span className="ml-0.5 grid h-6 w-6 place-items-center rounded-full bg-white/15 transition-transform duration-300 group-hover:rotate-90">
                      <X size={12} />
                    </span>
                  </button>
                </m.li>
              ))}
              <m.li key="clear-all" layout className="pl-1">
                <button type="button" onClick={clearAll} className={clsx("link-draw rounded-sm text-xs font-semibold text-ink/60 hover:text-ink", FOCUS_RING)}>
                  {t("Clear all")}
                </button>
              </m.li>
            </AnimatePresence>
          </ul>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** Keeps keyboard focus inside an open drawer. */
function trapFocus(e: KeyboardEvent, root: HTMLElement) {
  const nodes = root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!nodes.length) return;
  const first = nodes[0]!;
  const last = nodes[nodes.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function FilterDrawer({ facets, total, onClose }: { facets: Facets; total: number; onClose: () => void }) {
  const { t, tn, tr, tx } = useI18n();
  const { params, pending, clearAll } = useListing();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const active = activeChips(params, facets, t, tx).length;

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Tab" && panel.current) trapFocus(e, panel.current);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] lg:hidden">
      <m.div className="absolute inset-0 bg-night/70 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      <m.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-offwhite shadow-neu-lg"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.55, ease: EASE_OUT }}
      >
        <header className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <div>
            <p className="eyebrow">{t("Refine")}</p>
            <h2 id={titleId} className="mt-0.5 text-xl font-bold tracking-tight">
              {t("Filters")}
            </h2>
          </div>
          <button ref={closeButton} type="button" aria-label={t("Close filters")} onClick={onClose} className={clsx("grid h-10 w-10 place-items-center rounded-full transition hover:rotate-90 hover:bg-black/5", FOCUS_RING)}>
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          <ActiveFilters facets={facets} />
          <FilterPanel facets={facets} />
        </div>
        <footer className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-black/5 bg-white/80 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          <button type="button" onClick={clearAll} disabled={!active} className={clsx("h-12 rounded-full border border-ink/15 px-5 text-sm font-semibold transition hover:border-ink disabled:opacity-35", FOCUS_RING)}>
            {t("Clear all")}
          </button>
          <button type="button" onClick={onClose} className={clsx("flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90", FOCUS_RING)}>
            {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
            <span className="flex items-center gap-1 whitespace-nowrap">
              {total === 1 ? tr("Show {count} product", { count: <RollingNumber value={total} /> }) : tr("Show {count} products", { count: <RollingNumber value={total} /> })}
            </span>
          </button>
        </footer>
        <p className="sr-only" role="status" aria-live="polite">
          {pending ? t("Updating results") : tn(total, "{n} product found", "{n} products found")}
        </p>
      </m.div>
    </div>,
    document.body,
  );
}

/** "Filters" button (below lg) that opens the slide-in filter drawer. */
export function MobileFilters({ facets, total }: { facets: Facets; total: number }) {
  const { t, tx } = useI18n();
  const { params } = useListing();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const active = activeChips(params, facets, t, tx).length;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={clsx("flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white pl-4 pr-3 text-sm font-semibold transition hover:border-ink/40 lg:hidden", FOCUS_RING)}
      >
        <SlidersHorizontal size={15} />
        {t("Filters")}
        <AnimatePresence initial={false}>
          {active > 0 && (
            <m.span
              key={active}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-white"
            >
              {active}
            </m.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence onExitComplete={() => trigger.current?.focus()}>{open && <FilterDrawer key="filters" facets={facets} total={total} onClose={close} />}</AnimatePresence>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sort menu                                                                   */
/* -------------------------------------------------------------------------- */

export function SortSelect() {
  const { t } = useI18n();
  const { params, update } = useListing();
  const current = params.get("sort") ?? "";
  const selectedIndex = Math.max(0, SORTS.findIndex((s) => s.value === current));
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(selectedIndex);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    items.current[selectedIndex]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, selectedIndex]);

  const show = () => {
    setHovered(selectedIndex);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const choose = (value: string) => {
    if (value !== current) update({ sort: value || null, page: null });
    close();
  };
  const onMenuKey = (e: ReactKeyboardEvent) => {
    const buttons = items.current.filter((b): b is HTMLButtonElement => !!b);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (n: number) => buttons[(n + buttons.length) % buttons.length]?.focus();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusAt(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAt(buttons.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            show();
          }
        }}
        className={clsx("flex h-10 max-w-[13rem] items-center gap-2 rounded-full border border-black/10 bg-white pl-4 pr-3 text-sm transition hover:border-ink/40 sm:max-w-none", FOCUS_RING)}
      >
        <ArrowDownUp size={14} className="shrink-0 text-ink/50 sm:hidden" />
        <span className="hidden text-ink/50 sm:inline">{t("Sort")}</span>
        <span className="truncate font-semibold">{t(SORTS[selectedIndex]!.label)}</span>
        <m.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.35, ease: EASE_OUT }} className="grid shrink-0 place-items-center text-ink/50">
          <ChevronDown size={15} />
        </m.span>
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            id={menuId}
            role="menu"
            aria-label={t("Sort products")}
            onKeyDown={onMenuKey}
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="absolute right-0 top-full z-30 mt-2 w-60 origin-top-right rounded-2xl border border-black/5 bg-white p-1.5 shadow-neu-lg"
          >
            {SORTS.map((s, i) => {
              const checked = s.value === current;
              return (
                <button
                  key={s.value || "default"}
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  tabIndex={-1}
                  onClick={() => choose(s.value)}
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  className="relative flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm outline-none"
                >
                  {hovered === i && <m.span layoutId="sort-highlight" className="absolute inset-0 rounded-xl bg-offwhite" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  <span className={clsx("relative", checked ? "font-semibold" : "text-ink/70")}>{t(s.label)}</span>
                  {checked && <Check size={15} className="relative" />}
                </button>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

/** For the product list: tells the listing how many products are on the page now. */
export const useListingProgress = () => useListing().reportShown;

/** "Showing 1–24 of 120", with a spinner while new results load. The end of the range grows as the list loads more. */
export function ListingCount({ from, to: firstTo, total }: { from: number; to: number; total: number }) {
  const { t, tr } = useI18n();
  const { pending, shown } = useListing();
  const to = shown === null ? firstTo : Math.min(total, from - 1 + shown);
  return (
    <p className="hidden items-center gap-2 text-sm text-ink/55 sm:flex" aria-live="polite">
      {pending ? (
        <>
          <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> {t("Updating…")}
        </>
      ) : total === 0 ? (
        t("No products")
      ) : (
        tr("Showing {range} of {total}", {
          range: (
            <span className="font-semibold tabular-nums text-ink">
              {from}–{to}
            </span>
          ),
          total: <span className="font-semibold tabular-nums text-ink">{total}</span>,
        })
      )}
    </p>
  );
}

/** Dims the grid while the server renders the next set of results. */
export function ListingResults({ children }: { children: ReactNode }) {
  const { pending } = useListing();
  return (
    <div aria-busy={pending} className={clsx("transition-opacity duration-300", pending && "pointer-events-none opacity-45")}>
      {children}
    </div>
  );
}

/** Shown when nothing matches the current filters. */
export function ListingEmpty() {
  const { t } = useI18n();
  const { params, clearAll } = useListing();
  const filtered = [...params.keys()].some((k) => !["q", "sort", "page"].includes(k));
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-white px-6 py-16 text-center shadow-neu md:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-float rounded-full bg-sand/60 blur-3xl" />
      {/* CSS entrances: this can be the first thing on screen, so it never waits for JavaScript. */}
      <span className="relative mx-auto grid h-20 w-20 animate-rise place-items-center rounded-full bg-offwhite">
        <SearchX size={30} strokeWidth={1.5} className="animate-float" />
      </span>
      <div className="relative animate-rise [animation-delay:120ms]">
        <p className="mt-6 text-3xl font-bold tracking-tighter md:text-4xl">{t("No products match")}</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink/55">{t("Try removing a filter or searching for something else.")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {filtered && (
            <button type="button" onClick={clearAll} className={clsx("h-12 rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink/90", FOCUS_RING)}>
              {t("Clear filters")}
            </button>
          )}
          <Link href="/products" className={clsx("group flex h-12 items-center gap-3 rounded-full border border-ink/15 py-1 pl-6 pr-1 text-sm font-semibold transition hover:border-ink", FOCUS_RING)}>
            {t("Browse everything")}
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white transition-transform duration-500 group-hover:rotate-45">
              <ArrowUpRight size={16} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
