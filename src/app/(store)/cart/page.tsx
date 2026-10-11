"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { Check, CircleAlert, Loader2, Minus, Plus, ShoppingBag, Sparkles, TicketPercent, Trash2, X } from "lucide-react";
import { CtaLink, delay, FreeShippingMeter, GhostLink, RollingNumber } from "@/components/store/checkout-ui";
import { Doodle } from "@/components/store/doodle";
import { EASE_OUT, SplitWords } from "@/components/store/motion";
import { OrderSummary } from "@/components/store/order-summary";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useApplyCoupon, useCart, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from "@/lib/cart";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { Cart } from "@/lib/types";

type Line = Cart["items"][number];

const SHAKE = { x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.45 } };

export default function CartPage() {
  const { data: cart, isLoading } = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const apply = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const toast = useToast();
  const { t, tr } = useI18n();
  const [code, setCode] = useState("");
  // Bumped when a coupon is rejected: alternating variant names replay the shake.
  const [shakes, setShakes] = useState(0);

  if (isLoading || !cart) return <BagSkeleton />;
  if (!cart.items.length) return <EmptyBag />;

  const hasIssues = cart.items.some((i) => i.issue);
  const threshold = cart.shipping.freeShippingThreshold;
  const invalidCoupon = cart.coupon && !cart.coupon.valid && cart.coupon.message ? cart.coupon.message : null;

  return (
    <div className="container-x py-10 md:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("Shopping bag")}</p>
          <h1 className="mt-2 flex flex-wrap items-baseline gap-x-4 text-4xl font-bold tracking-tighter md:text-5xl">
            <SplitWords text={t("Your bag")} />
            <span className="text-xl font-semibold tracking-tight text-ink/35 md:text-2xl">
              {cart.itemCount === 1 ? tr("{n} item", { n: <RollingNumber value={cart.itemCount} /> }) : tr("{n} items", { n: <RollingNumber value={cart.itemCount} /> })}
            </span>
          </h1>
        </div>
        <Link href="/products" className="link-draw text-sm font-semibold">
          {t("Continue shopping")}
        </Link>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        {/* Clip sideways so a line sliding out never causes a horizontal scrollbar. */}
        <section aria-label={t("Items in your bag")} className="-mx-4 min-w-0 overflow-x-clip px-4">
          {!!threshold && (
            <div className="mb-4 animate-rise rounded-3xl bg-white p-5 shadow-neu sm:p-6">
              <FreeShippingMeter threshold={threshold} left={cart.shipping.amountToFreeShipping} />
            </div>
          )}
          <ul>
            {/* Lines present on first render enter via CSS; only later changes use motion. */}
            <AnimatePresence initial={false}>
              {cart.items.map((item, i) => (
                <BagLine
                  key={item.itemId}
                  item={item}
                  index={i}
                  updating={update.isPending}
                  pending={(update.isPending && update.variables?.itemId === item.itemId) || (remove.isPending && remove.variables === item.itemId)}
                  onDecrease={() => update.mutate({ itemId: item.itemId, quantity: item.quantity - 1 }, { onError: (e) => toast(errorMessage(e), "error") })}
                  onIncrease={() => update.mutate({ itemId: item.itemId, quantity: item.quantity + 1 }, { onError: (e) => toast(errorMessage(e), "error") })}
                  onRemove={() => remove.mutate(item.itemId)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>

        <aside className="animate-rise space-y-4 lg:sticky lg:top-28" style={delay(100)}>
          {/* Coupon */}
          <div className="rounded-3xl bg-white p-6 shadow-neu sm:p-7">
            <p className="eyebrow flex items-center gap-2">
              <TicketPercent size={14} /> {t("Coupon")}
            </p>
            <div className="mt-4">
              <AnimatePresence mode="wait" initial={false}>
                {cart.coupon?.valid ? (
                  <m.div
                    key="applied"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-success/40 bg-success/10 px-4 py-3 text-sm"
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                  >
                    <span className="flex min-w-0 items-center gap-3 text-success">
                      <span className="grid h-8 w-8 shrink-0 animate-fade place-items-center rounded-full bg-success text-white" style={delay(150)}>
                        <Check size={15} strokeWidth={3} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold tracking-wide">{cart.coupon.code}</span>
                        <span className="block text-xs font-medium">{t("saved {amount}", { amount: money(cart.coupon.discount) })}</span>
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={t("Remove coupon")}
                      onClick={() => removeCoupon.mutate()}
                      disabled={removeCoupon.isPending}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/50 transition duration-300 hover:rotate-90 hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 disabled:opacity-40"
                    >
                      {removeCoupon.isPending ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                    </button>
                  </m.div>
                ) : (
                  <m.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
                    <m.form
                      className="relative"
                      initial={false}
                      animate={shakes ? `shake${shakes % 2}` : "rest"}
                      variants={{ rest: { x: 0 }, shake0: SHAKE, shake1: SHAKE }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!code.trim()) return;
                        apply.mutate(code.trim(), {
                          onSuccess: () => toast(t("Coupon applied")),
                          onError: (err) => {
                            toast(errorMessage(err), "error");
                            setShakes((n) => n + 1);
                          },
                        });
                      }}
                    >
                      <label htmlFor="coupon" className="sr-only">
                        {t("Coupon code")}
                      </label>
                      <input
                        id="coupon"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder={t("Coupon code")}
                        autoComplete="off"
                        aria-invalid={!!invalidCoupon || undefined}
                        aria-describedby={invalidCoupon ? "coupon-message" : undefined}
                        className={clsx("input h-12 rounded-full pl-5 pr-28 font-semibold tracking-wide placeholder:font-normal placeholder:tracking-normal", invalidCoupon && "border-warning/60")}
                      />
                      <button
                        type="submit"
                        disabled={apply.isPending}
                        className="absolute inset-y-1.5 right-1.5 flex items-center gap-1.5 rounded-full bg-ink px-5 text-xs font-semibold text-white transition hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35 disabled:bg-ink/50"
                      >
                        {apply.isPending && <Loader2 size={13} className="animate-spin" />}
                        {t("Apply")}
                      </button>
                    </m.form>
                  </m.div>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {invalidCoupon && (
                  <m.p
                    key={invalidCoupon}
                    id="coupon-message"
                    className="flex items-start gap-2 overflow-hidden text-xs font-medium text-warning"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: EASE_OUT }}
                  >
                    <CircleAlert size={14} className="mt-3 shrink-0" />
                    <span className="pt-3">{invalidCoupon}</span>
                  </m.p>
                )}
              </AnimatePresence>
            </div>
            <Link href="/offers" className="link-draw mt-4 inline-block text-xs font-medium text-ink/55 hover:text-ink">
              {t("See available offers")}
            </Link>
          </div>

          <OrderSummary totals={cart} shippingLabel={t("Shipping (estimated)")} shippingHint={false} />

          <AnimatePresence initial={false}>
            {hasIssues && (
              <m.p
                key="issues"
                role="status"
                className="flex items-start gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <CircleAlert size={16} className="mt-0.5 shrink-0" /> {t("Some items need attention before checkout.")}
              </m.p>
            )}
          </AnimatePresence>
          {hasIssues ? (
            <button type="button" disabled className="flex h-13 w-full cursor-not-allowed items-center justify-center rounded-full bg-ink/35 text-sm font-semibold text-white">
              {t("Checkout")}
            </button>
          ) : (
            <CtaLink href="/checkout" className="w-full">
              {t("Checkout")}
            </CtaLink>
          )}
        </aside>
      </div>
    </div>
  );
}

function BagLine({
  item,
  index,
  updating,
  pending,
  onDecrease,
  onIncrease,
  onRemove,
}: {
  item: Line;
  index: number;
  updating: boolean;
  pending: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  return (
    <m.li
      layout
      className="pb-4"
      // Lines added later (after the first render) slide in; first-render lines use the CSS entrance below.
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0, x: 0, transition: { duration: 0.65, ease: EASE_OUT } }}
      // Slide away first, then collapse the gap it leaves behind.
      exit={{
        opacity: 0,
        x: 120,
        height: 0,
        paddingBottom: 0,
        transition: {
          opacity: { duration: 0.3 },
          x: { duration: 0.4, ease: EASE_OUT },
          height: { duration: 0.4, ease: EASE_OUT, delay: 0.2 },
          paddingBottom: { duration: 0.4, ease: EASE_OUT, delay: 0.2 },
        },
      }}
      transition={{ layout: { duration: 0.5, ease: EASE_OUT } }}
    >
      {/* CSS entrance on its own wrapper so it never fights motion's exit / layout styles. */}
      <div className="animate-rise" style={delay(80 + Math.min(index, 6) * 60)}>
      <article className={clsx("flex gap-4 rounded-3xl bg-white p-4 shadow-neu transition-opacity duration-300 sm:gap-5 sm:p-5", pending && "opacity-60")} aria-busy={pending || undefined}>
        <Link href={`/products/${item.slug}`} className="group/img relative block h-32 w-24 shrink-0 overflow-hidden rounded-2xl bg-offwhite sm:h-36 sm:w-28" tabIndex={-1} aria-hidden="true">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/img:scale-105" />
          ) : (
            <span className="grid h-full w-full place-items-center text-ink/20">
              <ShoppingBag size={24} strokeWidth={1.5} />
            </span>
          )}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/products/${item.slug}`} className="line-clamp-2 font-semibold leading-snug hover:underline sm:line-clamp-1">
                {item.name}
              </Link>
              <p className="mt-0.5 text-sm text-ink/55">{item.variantTitle}</p>
              {item.autoDiscountName && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                  <Sparkles size={12} /> {t("{name} applied", { name: item.autoDiscountName })}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label={t("Remove {name}", { name: item.name })}
              onClick={onRemove}
              className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {item.issue && (
              <m.p
                key="issue"
                className="overflow-hidden"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <span className="mt-2 flex items-center gap-1.5 rounded-xl bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning">
                  <CircleAlert size={13} className="shrink-0" /> {item.issue}
                </span>
              </m.p>
            )}
          </AnimatePresence>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
            <div className="flex items-center rounded-full border border-black/10 bg-offwhite/70 p-0.5" role="group" aria-label={t("Quantity of {name}", { name: item.name })}>
              <button
                type="button"
                aria-label={t("Decrease")}
                disabled={updating}
                onClick={onDecrease}
                className="grid h-9 w-9 place-items-center rounded-full text-ink/60 transition hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:text-ink/25 disabled:hover:bg-transparent"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
                <RollingNumber value={item.quantity} className="justify-center" />
              </span>
              <button
                type="button"
                aria-label={t("Increase")}
                disabled={updating || item.quantity >= item.maxQuantity}
                onClick={onIncrease}
                className="grid h-9 w-9 place-items-center rounded-full text-ink/60 transition hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:text-ink/25 disabled:hover:bg-transparent"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="text-right">
              <RollingNumber value={item.lineTotal} format={money} className="font-bold" />
              {item.discountAmount > 0 && <s className="block text-xs text-ink/40">{money(item.gross)}</s>}
            </div>
          </div>
        </div>
      </article>
      </div>
    </m.li>
  );
}

function EmptyBag() {
  const { t } = useI18n();
  return (
    <div className="container-x py-12 md:py-20">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-white px-6 py-16 text-center shadow-neu md:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 animate-float rounded-full bg-sand/60 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 animate-float rounded-full bg-mist blur-3xl [animation-delay:-3s]" />
        <Doodle art="hanger" className="absolute -bottom-8 -left-4 w-40 -rotate-12 text-gold/35 sm:w-52 md:left-10 md:w-64" />
        <Doodle art="heart" className="absolute -top-2 right-0 w-32 rotate-12 text-accent/35 sm:w-40 md:right-12 md:top-6 md:w-52" />
        <div className="relative mx-auto w-fit animate-float [animation-delay:-1s]">
          <span className="relative grid h-24 w-24 animate-rise place-items-center rounded-full bg-offwhite shadow-neu">
            <ShoppingBag size={36} strokeWidth={1.4} />
            <span className="absolute right-1 top-1 grid h-6 min-w-6 animate-fade place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white" style={delay(450)}>
              0
            </span>
          </span>
        </div>
        <div className="relative">
          <p className="eyebrow mt-10">{t("Shopping bag")}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tighter md:text-5xl">
            <SplitWords text={t("Your bag is empty")} delay={0.1} />
          </h1>
          <p className="mx-auto mt-4 max-w-sm animate-rise text-sm text-ink/55" style={delay(350)}>
            {t("Find something you love and it will show up here.")}
          </p>
          <div className="mt-9 flex animate-rise flex-wrap justify-center gap-3" style={delay(450)}>
            <CtaLink href="/products">{t("Start shopping")}</CtaLink>
            <GhostLink href="/offers">{t("See offers")}</GhostLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function BagSkeleton() {
  const { t } = useI18n();
  return (
    <div className="container-x py-10 md:py-14" aria-busy="true">
      <p role="status" className="sr-only">
        {t("Loading your bag…")}
      </p>
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-4 h-11 w-60" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <div className="skeleton h-20 rounded-3xl" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4 rounded-3xl bg-white p-4 shadow-neu sm:gap-5 sm:p-5">
              <div className="skeleton h-32 w-24 shrink-0 sm:h-36 sm:w-28" />
              <div className="flex flex-1 flex-col py-1">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton mt-2.5 h-3 w-1/3" />
                <div className="mt-auto flex items-end justify-between">
                  <div className="skeleton h-10 w-28 rounded-full" />
                  <div className="skeleton h-4 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="skeleton h-36 rounded-3xl" />
          <div className="skeleton h-72 rounded-3xl" />
          <div className="skeleton h-13 rounded-full" />
        </div>
      </div>
    </div>
  );
}
