"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { ArrowUpRight, Check, CircleAlert, Clock, Loader2, Lock, Plus, ShieldCheck, ShoppingBag } from "lucide-react";
import { AddressForm } from "@/components/store/address-form";
import { CheckoutSteps, CtaLink, delay } from "@/components/store/checkout-ui";
import { EASE_OUT, SplitWords } from "@/components/store/motion";
import { OrderSummary } from "@/components/store/order-summary";
import { PayButton } from "@/components/store/pay-button";
import { RequireAuth } from "@/components/require-auth";
import { Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, newIdempotencyKey } from "@/lib/api";
import { CART_KEY, useCart } from "@/lib/cart";
import { money, time } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { Address, Order, PricedLine, QuoteTotals } from "@/lib/types";

type Quote = QuoteTotals & { lines: PricedLine[]; issues: string[]; canPlaceOrder: boolean };

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <Checkout />
    </RequireAuth>
  );
}

function Checkout() {
  const router = useRouter();
  const toast = useToast();
  const { t, tr, locale } = useI18n();
  const qc = useQueryClient();
  const { data: cart, isLoading: cartLoading } = useCart();
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: () => api.get<Address[]>("/account/addresses") });
  const [chosenAddressId, setAddressId] = useState<string | null>(null);
  const [addingNew, setAdding] = useState(false);
  // Default to the default shipping address; with no saved address, show the form.
  const addressId = chosenAddressId ?? (addresses.data?.find((a) => a.isDefaultShipping) ?? addresses.data?.[0])?.id ?? null;
  const adding = addingNew || (!!addresses.data && !addresses.data.length);
  const [notes, setNotes] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // One key per order attempt: retries/double clicks reuse it, so only one order is created.
  const attemptKey = useRef(newIdempotencyKey());

  const quote = useQuery({
    queryKey: ["checkout-quote", addressId, cart?.coupon?.code, cart?.itemCount, cart?.grandTotal],
    queryFn: () => api.post<Quote>("/checkout/quote", { shippingAddressId: addressId }),
    enabled: !!addressId && !!cart?.itemCount && !order,
  });

  const place = useMutation({
    mutationFn: () =>
      api.post<Order>("/orders", { shippingAddressId: addressId, notes: notes || undefined, expectedGrandTotal: quote.data?.grandTotal }, { idempotencyKey: attemptKey.current }),
    onSuccess: (o) => {
      setOrder(o);
      void qc.invalidateQueries({ queryKey: CART_KEY });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "PRICE_CHANGED") {
        toast(err.message, "info");
        attemptKey.current = newIdempotencyKey();
        void quote.refetch();
      } else toast(errorMessage(err), "error");
    },
  });

  if (cartLoading || addresses.isLoading) return <CheckoutSkeleton />;
  if (!order && !cart?.itemCount) return <EmptyCheckout />;

  const step: 0 | 1 | 2 = order ? 2 : addressId && !adding ? 1 : 0;
  const placeDisabled = !quote.data?.canPlaceOrder || adding;
  const placeHint = adding ? t("Save your delivery address to continue.") : quote.isLoading ? t("Calculating your totals…") : quote.data && !quote.data.canPlaceOrder ? t("Resolve the items flagged above to continue.") : null;

  return (
    <div className="container-x py-10 md:py-14">
      <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Lock size={12} /> {t("Secure checkout")}
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tighter md:text-5xl">
            <SplitWords text={t("Checkout")} />
          </h1>
        </div>
        <div className="w-full animate-rise md:max-w-sm" style={delay(150)}>
          <CheckoutSteps current={step} />
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {/* 1 — Address */}
          <Section n={1} title={t("Delivery address")} done={!!addressId && !adding} active={step === 0}>
            <AnimatePresence mode="wait" initial={false}>
              {adding ? (
                <m.div key="form" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: EASE_OUT }}>
                  <AddressForm
                    onSaved={(a) => {
                      void qc.invalidateQueries({ queryKey: ["addresses"] });
                      setAddressId(a.id);
                      setAdding(false);
                    }}
                    onCancel={addresses.data?.length ? () => setAdding(false) : undefined}
                  />
                </m.div>
              ) : (
                <m.div
                  key="list"
                  className="grid gap-3 sm:grid-cols-2"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                >
                  {addresses.data?.map((a) => {
                    const selected = addressId === a.id;
                    return (
                      <label
                        key={a.id}
                        className={clsx(
                          "relative flex gap-3 rounded-2xl border p-4 transition-colors duration-300 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10",
                          selected ? "border-transparent bg-offwhite" : "border-black/10 bg-white",
                          order ? "cursor-default" : "cursor-pointer hover:border-ink/30",
                        )}
                      >
                        <input type="radio" name="address" className="sr-only" checked={selected} onChange={() => setAddressId(a.id)} disabled={!!order} />
                        {selected && (
                          <m.span
                            layoutId="checkout-address-ring"
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-ink"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}
                        <span aria-hidden="true" className={clsx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300", selected ? "border-ink bg-ink" : "border-black/20 bg-white")}>
                          <AnimatePresence initial={false}>
                            {selected && (
                              <m.span key="dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 26 }}>
                                <Check size={11} strokeWidth={3.5} className="text-white" />
                              </m.span>
                            )}
                          </AnimatePresence>
                        </span>
                        <span className="min-w-0 text-sm">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold">{a.fullName}</span>
                            {a.isDefaultShipping && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">{t("Default")}</span>}
                            {a.label && <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/60">{a.label}</span>}
                          </span>
                          <span className="mt-1 block break-words text-ink/65">
                            {[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}, {a.city}, {a.state} {a.postalCode}
                          </span>
                          <span className="mt-1 block text-xs text-ink/45">{a.phone}</span>
                        </span>
                      </label>
                    );
                  })}
                  {!order && (
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      className="group flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 p-4 text-sm font-semibold text-ink/60 transition-colors hover:border-ink hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-offwhite transition-transform duration-500 group-hover:rotate-90">
                        <Plus size={16} />
                      </span>
                      {t("Add a new address")}
                    </button>
                  )}
                </m.div>
              )}
            </AnimatePresence>
          </Section>

          {/* 2 — Review */}
          <Section n={2} title={t("Review items")} done={!!order} active={step === 1}>
            {quote.isLoading && (
              <div aria-busy="true">
                <p role="status" className="sr-only">
                  {t("Calculating totals…")}
                </p>
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3.5">
                    <div className="skeleton h-20 w-16 shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3.5 w-1/2" />
                      <div className="skeleton h-3 w-1/4" />
                    </div>
                    <div className="skeleton h-3.5 w-14" />
                  </div>
                ))}
              </div>
            )}
            {quote.data && (
              <ul className="divide-y divide-black/5">
                {quote.data.lines.map((l, i) => (
                  <li key={l.variantId} className="flex animate-rise items-center gap-4 py-3.5" style={delay(Math.min(i, 6) * 60)}>
                    <div className="relative shrink-0">
                      <div className="h-20 w-16 overflow-hidden rounded-xl bg-offwhite">{l.imageUrl && <img src={l.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}</div>
                      <span aria-hidden="true" className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-bold text-white ring-2 ring-white">
                        {l.quantity}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-semibold">{l.name}</p>
                      <p className="text-ink/55">
                        {l.variantTitle} × {l.quantity}
                      </p>
                      {l.issue && <p className="mt-1 text-xs font-medium text-warning">{l.issue}</p>}
                    </div>
                    <span className="text-sm font-bold tabular-nums">{money(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            )}
            <AnimatePresence initial={false}>
              {!!quote.data?.issues.length && (
                <m.ul
                  key="issues"
                  className="mt-3 space-y-1 rounded-2xl bg-warning/10 p-4 text-sm text-warning"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  {quote.data.issues.map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CircleAlert size={15} className="mt-0.5 shrink-0" /> {i}
                    </li>
                  ))}
                </m.ul>
              )}
            </AnimatePresence>
            {!order && (
              <div className="mt-5">
                <label htmlFor="notes" className="label">
                  {t("Delivery notes (optional)")}
                </label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="min-h-16 rounded-2xl" placeholder={t("e.g. call before delivery")} />
              </div>
            )}
          </Section>

          {/* 3 — Payment */}
          <Section n={3} title={t("Payment")} done={false} active={step === 2}>
            <AnimatePresence mode="wait" initial={false}>
              {order ? (
                <m.div key="pay" className="space-y-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
                  <div className="flex items-start gap-3 rounded-2xl bg-offwhite p-4 text-sm text-ink/65">
                    <Clock size={17} className="mt-0.5 shrink-0 text-ink" />
                    <p>
                      {order.reservationExpiresAt
                        ? tr("Order {number} is reserved for you until {time}. Complete the payment to confirm it.", { number: <strong className="text-ink">{order.orderNumber}</strong>, time: time(order.reservationExpiresAt, locale) })
                        : tr("Order {number} is reserved for you. Complete the payment to confirm it.", { number: <strong className="text-ink">{order.orderNumber}</strong> })}
                    </p>
                  </div>
                  <AnimatePresence initial={false}>
                    {paymentError && (
                      <m.p
                        key={paymentError}
                        role="alert"
                        className="flex items-start gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger"
                        initial={{ opacity: 0, x: 0 }}
                        animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45 }}
                      >
                        <CircleAlert size={16} className="mt-0.5 shrink-0" /> {paymentError}
                      </m.p>
                    )}
                  </AnimatePresence>
                  <PayButton
                    orderId={order.id}
                    amount={order.grandTotal}
                    label={paymentError ? t("Try again") : t("Pay now")}
                    onOutcome={(o) => {
                      if (o.status === "paid") router.replace(`/order-confirmation/${o.orderNumber}`);
                      else if (o.status === "failed") setPaymentError(o.message);
                    }}
                  />
                </m.div>
              ) : (
                <m.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-sm text-ink/55">{t("Pay securely with UPI, cards, netbanking or wallets after placing the order.")}</p>
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label={t("Accepted payment methods")}>
                    {["UPI", t("Cards"), t("Netbanking"), t("Wallets")].map((p) => (
                      <li key={p} className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-ink/60">
                        {p}
                      </li>
                    ))}
                  </ul>
                </m.div>
              )}
            </AnimatePresence>
          </Section>
        </div>

        <aside className="animate-rise space-y-4 lg:sticky lg:top-28" style={delay(200)}>
          {quote.data ? <OrderSummary totals={quote.data} /> : cart && <OrderSummary totals={cart} shippingLabel={t("Shipping (estimated)")} />}
          {!order && (
            <div>
              <button
                type="button"
                onClick={() => place.mutate()}
                disabled={placeDisabled || place.isPending}
                aria-busy={place.isPending || undefined}
                className="group flex h-14 w-full items-center justify-between rounded-full bg-ink py-1.5 pl-7 pr-2 text-sm font-semibold text-white shadow-neu-lg transition-[background-color,box-shadow] duration-300 hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:bg-ink/35 disabled:shadow-none"
              >
                <span>{place.isPending ? t("Placing your order…") : t("Place order")}</span>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-enabled:group-hover:rotate-45">
                  {place.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={17} />}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {placeHint && !place.isPending && (
                  <m.p key={placeHint} className="mt-2 text-center text-xs text-ink/50" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    {placeHint}
                  </m.p>
                )}
              </AnimatePresence>
            </div>
          )}
          <p className="flex items-center justify-center gap-2 text-xs text-ink/45">
            <ShieldCheck size={14} /> {t("Prices and stock are confirmed by our servers.")}
          </p>
        </aside>
      </div>
    </div>
  );
}

function Section({ n, title, done, active, children }: { n: number; title: string; done: boolean; active: boolean; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <section
      aria-labelledby={`checkout-step-${n}`}
      className={clsx("animate-rise rounded-3xl bg-white shadow-neu transition-shadow duration-500", active && "shadow-neu-lg")}
      style={delay(50 + n * 80)}
    >
      <header className="flex items-center gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
        <span
          aria-hidden="true"
          className={clsx(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-500",
            done ? "bg-success text-white" : active ? "bg-ink text-white" : "bg-offwhite text-ink/45",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={done ? "done" : "todo"}
              className="grid place-items-center"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 22 }}
            >
              {done ? <Check size={14} strokeWidth={3} /> : n}
            </m.span>
          </AnimatePresence>
        </span>
        <h2 id={`checkout-step-${n}`} className={clsx("text-lg font-bold tracking-tight transition-colors", !done && !active && "text-ink/70")}>
          {title}
          {done && <span className="sr-only"> {t("(completed)")}</span>}
        </h2>
      </header>
      <div className="p-5 sm:p-7 sm:pt-5">{children}</div>
    </section>
  );
}

function EmptyCheckout() {
  const { t } = useI18n();
  return (
    <div className="container-x py-16 md:py-24">
      <div className="relative mx-auto max-w-xl overflow-hidden rounded-[2.5rem] bg-white px-6 py-16 text-center shadow-neu">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 animate-float rounded-full bg-sand/60 blur-3xl" />
        <span className="relative mx-auto grid h-20 w-20 animate-rise place-items-center rounded-full bg-offwhite shadow-neu">
          <ShoppingBag size={30} strokeWidth={1.5} />
        </span>
        <h1 className="relative mt-8 text-3xl font-bold tracking-tighter md:text-4xl">{t("Your bag is empty")}</h1>
        <p className="relative mt-3 text-sm text-ink/55">{t("Add a few pieces to your bag, then come back to check out.")}</p>
        <CtaLink href="/products" className="relative mt-8">
          {t("Continue shopping")}
        </CtaLink>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  const { t } = useI18n();
  return (
    <div className="container-x py-10 md:py-14" aria-busy="true">
      <p role="status" className="sr-only">
        {t("Loading checkout…")}
      </p>
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="skeleton h-3 w-28" />
          <div className="skeleton mt-4 h-11 w-52" />
        </div>
        <div className="skeleton h-16 w-full rounded-3xl md:max-w-sm" />
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <div className="skeleton h-56 rounded-3xl" />
          <div className="skeleton h-48 rounded-3xl" />
          <div className="skeleton h-28 rounded-3xl" />
        </div>
        <div className="space-y-4">
          <div className="skeleton h-72 rounded-3xl" />
          <div className="skeleton h-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}
