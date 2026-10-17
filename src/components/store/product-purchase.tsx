"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { Check, LoaderCircle, Minus, Plus, RotateCcw, ShoppingBag, Truck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useAddToCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { ImageView, ProductDetail } from "@/lib/types";
import { useCartDrawer } from "./cart-drawer";
import { isColorOption, swatch } from "./colors";
import { EASE_OUT } from "./motion";
import { PdpGallery } from "./pdp-gallery";
import { ProductImage } from "./product-card";
import { MaskedHeading } from "./shop-heading";
import { RollingNumber } from "./shop-rolling-number";
import { WishlistButton } from "./wishlist-button";
import { RichText } from "@/components/ui/rich-text";
import { Stars } from "./reviews";
import type { RatingSummary } from "@/lib/reviews";

type AddState = "idle" | "loading" | "added";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite";

/** Same rounding as <Price>: whole-number percent off MRP. */
const percentOff = (price: number, mrp: number) => (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

/**
 * True once `target` has scrolled up past the top of the viewport — and the
 * footer is not on screen (so the sticky bar never covers it).
 */
function useScrolledPast(target: RefObject<HTMLElement | null>) {
  const [past, setPast] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const watch = new IntersectionObserver(([entry]) => {
      if (entry) setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    watch.observe(el);
    const footer = document.querySelector("footer");
    const footerWatch = footer
      ? new IntersectionObserver(([entry]) => {
          if (entry) setFooterVisible(entry.isIntersecting);
        })
      : null;
    if (footer) footerWatch?.observe(footer);
    return () => {
      watch.disconnect();
      footerWatch?.disconnect();
    };
  }, [target]);
  return past && !footerVisible;
}

function AddButton({ state, label, disabled, onClick, className }: { state: AddState; label: string; disabled: boolean; onClick: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <m.button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "loading"}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={clsx(
        "relative flex items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white transition-colors duration-500",
        FOCUS_RING,
        state === "added" ? "bg-success" : state === "loading" ? "cursor-wait bg-ink" : disabled ? "cursor-not-allowed bg-ink/35" : "bg-ink hover:bg-ink/90",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={state === "idle" ? `idle-${label}` : state}
          className="flex items-center gap-2 whitespace-nowrap"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -18, opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
        >
          {state === "loading" ? (
            <>
              <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
              {t("Adding…")}
            </>
          ) : state === "added" ? (
            <>
              <m.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 15 }} className="grid place-items-center">
                <Check size={18} strokeWidth={2.75} aria-hidden="true" />
              </m.span>
              {t("Added")}
            </>
          ) : (
            <>
              <ShoppingBag size={16} className="hidden sm:block" aria-hidden="true" />
              {label}
            </>
          )}
        </m.span>
      </AnimatePresence>
    </m.button>
  );
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex h-14 shrink-0 items-center rounded-full border border-black/10 bg-white">
      <button type="button" aria-label={t("Decrease quantity")} disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))} className={clsx("grid h-full w-10 place-items-center rounded-l-full text-ink/60 transition hover:text-ink disabled:opacity-30 sm:w-12", FOCUS_RING)}>
        <Minus size={14} />
      </button>
      <span className="grid w-7 place-items-center text-sm font-semibold tabular-nums" aria-live="polite">
        <RollingNumber value={value} />
      </span>
      <button type="button" aria-label={t("Increase quantity")} disabled={value >= 10} onClick={() => onChange(Math.min(10, value + 1))} className={clsx("grid h-full w-10 place-items-center rounded-r-full text-ink/60 transition hover:text-ink disabled:opacity-30 sm:w-12", FOCUS_RING)}>
        <Plus size={14} />
      </button>
    </div>
  );
}

function StickyBar({ name, image, detail, price, state, label, disabled, onAdd }: { name: string; image: ImageView | null; detail: string; price: number; state: AddState; label: string; disabled: boolean; onAdd: () => void }) {
  return (
    <m.div
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      initial={{ y: "120%" }}
      animate={{ y: 0 }}
      exit={{ y: "120%" }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-[1.75rem] border border-black/5 bg-white/90 p-2 shadow-neu-lg backdrop-blur-xl">
        <span className="h-12 w-10 shrink-0 overflow-hidden rounded-xl bg-offwhite">
          <ProductImage image={image} alt="" sizes="48px" className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold">{name}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
            <RollingNumber value={price} format={money} className="font-bold" />
            {detail && <span className="truncate text-ink/50">· {detail}</span>}
          </p>
        </div>
        <AddButton state={state} label={label} disabled={disabled} onClick={onAdd} className="h-12 shrink-0 px-5" />
      </div>
    </m.div>
  );
}

export function ProductPurchase({ product, rating }: { product: ProductDetail; rating?: Pick<RatingSummary, "average" | "count"> | null }) {
  const { t, tn, tx } = useI18n();
  const toast = useToast();
  const add = useAddToCart();
  const { openCart } = useCartDrawer();
  const initial = product.variants.find((v) => v.isDefault && v.inStock) ?? product.variants.find((v) => v.inStock) ?? product.variants[0]!;
  const [selected, setSelected] = useState<Record<string, string>>(initial.options);
  const [qty, setQty] = useState(1);
  const [gallery, setGallery] = useState({ index: 0, direction: 0 });
  const [added, setAdded] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const buyRow = useRef<HTMLDivElement>(null);
  const showBar = useScrolledPast(buyRow);

  useEffect(
    () => () => {
      clearTimeout(openTimer.current);
      clearTimeout(resetTimer.current);
    },
    [],
  );

  const variant = useMemo(
    () => product.variants.find((v) => product.options.every((o) => v.options[o.name] === selected[o.name])) ?? (product.options.length ? undefined : product.variants[0]),
    [product, selected],
  );

  // Is a value selectable given the other current selections?
  const available = (optionName: string, value: string) =>
    product.variants.some((v) => v.options[optionName] === value && v.inStock && product.options.every((o) => o.name === optionName || v.options[o.name] === selected[o.name]));

  const images = product.images.length ? product.images : [null];

  const select = (optionName: string, value: string) => {
    const next = { ...selected, [optionName]: value };
    setSelected(next);
    // Show the photo tagged to the chosen size and colour; picking a colour otherwise shows any photo of that colour.
    const exact = product.variants.find((v) => product.options.every((o) => v.options[o.name] === next[o.name]));
    let i = exact ? product.images.findIndex((img) => img.variantId === exact.id) : -1;
    if (i < 0 && isColorOption(optionName)) {
      const ids = new Set(product.variants.filter((v) => v.options[optionName] === value).map((v) => v.id));
      i = product.images.findIndex((img) => img.variantId && ids.has(img.variantId));
    }
    if (i >= 0 && i !== gallery.index) setGallery({ index: i, direction: i > gallery.index ? 1 : -1 });
  };

  const addToCart = () => {
    if (!variant) return toast(t("Choose your options first"), "info");
    add.mutate(
      { variantId: variant.id, quantity: qty },
      {
        onSuccess: () => {
          setAdded(true);
          clearTimeout(openTimer.current);
          clearTimeout(resetTimer.current);
          openTimer.current = setTimeout(openCart, 650);
          resetTimer.current = setTimeout(() => setAdded(false), 2400);
        },
        onError: (e) => toast(errorMessage(e), "error"),
      },
    );
  };

  const state: AddState = add.isPending ? "loading" : added ? "added" : "idle";
  const label = !variant ? t("Select options") : variant.inStock ? t("Add to bag") : t("Out of stock");
  const disabled = !variant?.inStock;
  const price = variant?.sellingPrice ?? product.sellingPrice;
  const mrp = variant?.mrp ?? product.mrp;
  const off = percentOff(price, mrp);
  const detail = product.options.map((o) => tx(selected[o.name])).filter(Boolean).join(" · ");

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
        {/* Gallery */}
        <div className="min-w-0 lg:col-span-7">
          <PdpGallery
            images={images}
            name={product.name}
            index={gallery.index}
            direction={gallery.direction}
            onChange={(index, direction) => setGallery({ index, direction })}
            badges={off > 0 ? <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-neu">−{off}%</span> : null}
          />
        </div>

        {/* Buy box */}
        <div className="min-w-0 lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            {product.brand ? (
              <Link href={`/products?brand=${encodeURIComponent(product.brand.slug)}`} className="eyebrow link-draw rounded-sm hover:text-ink">
                {product.brand.name}
              </Link>
            ) : (
              <p className="eyebrow">{tx(product.category.name)}</p>
            )}
            <MaskedHeading className="mt-3 text-[clamp(2.1rem,3.8vw,3.4rem)] font-bold leading-[0.95] tracking-tighter" delay={0.1}>
              {product.name}
            </MaskedHeading>
            {rating?.average != null && rating.count > 0 && (
              <a href="#reviews" className="mt-3 inline-flex animate-rise items-center gap-2 text-sm text-ink/60 transition-colors hover:text-ink [animation-delay:140ms]">
                <Stars value={rating.average} size={15} />
                <span className="font-semibold tabular-nums text-ink">{rating.average.toFixed(1)}</span>
                <span className="underline decoration-accent/50 underline-offset-4">{tn(rating.count, "{n} review", "{n} reviews")}</span>
              </a>
            )}

            {/* Price (CSS entrance: visible without waiting for JavaScript) */}
            <div className="animate-rise [animation-delay:180ms]">
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <RollingNumber value={price} format={money} className="text-3xl font-bold tracking-tight tabular-nums" />
                <AnimatePresence initial={false} mode="popLayout">
                  {off > 0 && (
                    <m.span key={`${mrp}-${off}`} className="flex items-center gap-3" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
                      <s className="text-base text-ink/35 tabular-nums">{money(mrp)}</s>
                      <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">{t("{percent}% off", { percent: off })}</span>
                    </m.span>
                  )}
                </AnimatePresence>
              </div>
              <p className="mt-1.5 text-xs text-ink/45">{t("Inclusive of all taxes")}</p>
              <RichText html={product.shortDescription} className="mt-6 max-w-prose text-sm leading-relaxed text-ink/65" />
            </div>

            {/* Options */}
            {product.options.map((o) => {
              const color = isColorOption(o.name);
              return (
                <fieldset key={o.name} className="mt-7">
                  <legend className="flex items-center gap-2 text-sm font-semibold">
                    {tx(o.name)}
                    <span className="relative overflow-hidden font-normal text-ink/55">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <m.span key={selected[o.name] ?? "none"} className="inline-block" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
                          {tx(selected[o.name]) ?? "—"}
                        </m.span>
                      </AnimatePresence>
                    </span>
                  </legend>
                  <div className={clsx("mt-3 flex flex-wrap", color ? "gap-3" : "gap-2")}>
                    {o.values.map((value) => {
                      const active = selected[o.name] === value;
                      const enabled = available(o.name, value);
                      const a11yLabel = enabled ? tx(value) : t("{value} — out of stock", { value: tx(value) });
                      return color ? (
                        <button
                          key={value}
                          type="button"
                          onClick={() => select(o.name, value)}
                          aria-pressed={active}
                          aria-label={a11yLabel}
                          title={a11yLabel}
                          className={clsx("group/swatch relative grid h-11 w-11 place-items-center rounded-full", FOCUS_RING)}
                        >
                          {active && <m.span layoutId={`pdp-swatch-${o.name}`} className="absolute -inset-[3px] rounded-full border-2 border-ink" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                          <span
                            className={clsx("h-9 w-9 rounded-full ring-1 ring-inset ring-black/10 transition-transform duration-300 group-hover/swatch:scale-105", !enabled && "opacity-40")}
                            style={{ backgroundColor: swatch(value) }}
                          />
                          {!enabled && <span aria-hidden="true" className="pointer-events-none absolute h-[1.5px] w-11 -rotate-45 rounded-full bg-ink/60" />}
                        </button>
                      ) : (
                        <button
                          key={value}
                          type="button"
                          onClick={() => select(o.name, value)}
                          aria-pressed={active}
                          aria-label={a11yLabel}
                          title={a11yLabel}
                          className={clsx(
                            "relative h-11 min-w-[3.25rem] rounded-full px-4 text-sm font-semibold transition-colors duration-300",
                            FOCUS_RING,
                            active ? "text-on-accent" : enabled ? "border border-black/10 bg-white hover:border-accent" : "border border-dashed border-black/15 text-ink/35 hover:border-ink/40",
                          )}
                        >
                          {active && <m.span layoutId={`pdp-pill-${o.name}`} className={clsx("absolute inset-0 rounded-full", enabled ? "bg-accent" : "bg-accent/45")} transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                          <span className={clsx("relative", !enabled && "line-through decoration-1")}>{tx(value)}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

            {/* Quantity, add to bag, wishlist */}
            <div ref={buyRow} className="mt-8 flex items-stretch gap-3">
              <QuantityStepper value={qty} onChange={setQty} />
              <AddButton state={state} label={label} disabled={disabled} onClick={addToCart} className="h-14 min-w-0 flex-1 px-5" />
              <WishlistButton productId={product.id} productName={product.name} size={19} className={clsx("h-14 w-14 shrink-0 border border-black/10 bg-white hover:border-ink/40", FOCUS_RING)} />
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              {state === "added" ? t("Added {name} to your bag", { name: product.name }) : ""}
            </p>

            <AnimatePresence initial={false}>
              {variant?.lowStock && (
                <m.p
                  key="low"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                  className="overflow-hidden"
                >
                  <span className="mt-4 flex items-center gap-2 text-sm font-medium text-warning">
                    <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" />
                    {t("Only a few left in this size")}
                  </span>
                </m.p>
              )}
            </AnimatePresence>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              {variant && <p className="text-xs text-ink/40">SKU {variant.sku}</p>}
              {add.isSuccess && (
                <Link href="/cart" className="link-draw text-sm font-semibold">
                  {t("View bag and checkout →")}
                </Link>
              )}
            </div>

            {/* Promises */}
            <ul className="mt-8 grid overflow-hidden rounded-3xl bg-white shadow-neu sm:grid-cols-2">
              {[
                { icon: Truck, title: t("Tracked delivery"), body: t("Shipping calculated at checkout") },
                { icon: RotateCcw, title: t("Easy returns"), body: t("Request from your account") },
              ].map(({ icon: Icon, title, body }, i) => (
                <li key={title} className={clsx("group flex items-center gap-3.5 p-4", i > 0 && "border-t border-black/5 sm:border-l sm:border-t-0")}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-offwhite transition-colors duration-500 group-hover:bg-ink group-hover:text-white">
                    <Icon size={17} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-ink/55">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink/40">{t("Prices from {amount}", { amount: money(Math.min(...product.variants.map((v) => v.sellingPrice))) })}</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showBar && (
          <StickyBar key="bar" name={product.name} image={images[gallery.index] ?? null} detail={detail} price={price} state={state} label={label} disabled={disabled} onAdd={addToCart} />
        )}
      </AnimatePresence>
    </>
  );
}
