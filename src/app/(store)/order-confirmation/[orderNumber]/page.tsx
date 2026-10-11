"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { m } from "motion/react";
import { Mail, MapPin, Package, Truck } from "lucide-react";
import { CtaLink, delay, DrawnCheck, GhostLink } from "@/components/store/checkout-ui";
import { EASE_OUT, SplitWords } from "@/components/store/motion";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { msg } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { Order } from "@/lib/types";

export default function ConfirmationPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  return (
    <RequireAuth>
      <Confirmation orderNumber={orderNumber} />
    </RequireAuth>
  );
}

// Little bits of colour that burst out once as the check finishes drawing (decorative only).
const BURST = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
  const dist = i % 2 ? 62 : 78;
  return { x: Math.round(Math.cos(angle) * dist), y: Math.round(Math.sin(angle) * dist), color: ["bg-accent", "bg-ink", "bg-success", "bg-sand"][i % 4], size: i % 3 ? "h-1.5 w-1.5" : "h-2 w-2" };
});

const NEXT_STEPS = [
  { icon: Mail, text: msg("Your confirmation is on its way by email or SMS.") },
  { icon: Package, text: msg("We pack your order with care.") },
  { icon: Truck, text: msg("Track every step from your account.") },
];

function Confirmation({ orderNumber }: { orderNumber: string }) {
  const { data: order, isLoading } = useQuery({ queryKey: ["order", orderNumber], queryFn: () => api.get<Order>(`/account/orders/${orderNumber}`) });
  const { t, tn, tr } = useI18n();
  if (isLoading || !order) return <ConfirmationSkeleton />;
  const address = order.shippingAddress;
  const contact = order.customerEmail ?? order.customerPhone;

  // The order details use CSS entrances (never hidden waiting for JavaScript);
  // only the decorative check mark and its burst are driven by motion.
  return (
    <div className="container-x max-w-3xl py-12 md:py-20">
      <section className="relative overflow-hidden rounded-[2.5rem] bg-white px-6 py-12 text-center shadow-neu sm:px-12 md:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 animate-float rounded-full bg-success/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 animate-float rounded-full bg-sand/50 blur-3xl [animation-delay:-3s]" />

        <div aria-hidden="true" className="relative mx-auto grid h-24 w-24 place-items-center">
          {BURST.map((b, i) => (
            <m.span
              key={i}
              className={`absolute left-1/2 top-1/2 -ml-1 -mt-1 rounded-full ${b.color} ${b.size}`}
              initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
              animate={{ x: b.x, y: b.y, scale: [0, 1.2, 0.6], opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, ease: EASE_OUT, delay: 1 + i * 0.015 }}
            />
          ))}
          <span className="absolute inset-0 animate-fade rounded-full bg-success/10" />
          <DrawnCheck className="relative h-20 w-20 text-success" delay={0.25} />
        </div>

        <p className="eyebrow relative mt-8 animate-rise" style={delay(300)}>
          {t("Order confirmed")}
        </p>
        <h1 className="relative mx-auto mt-3 max-w-xl text-[clamp(2rem,5.5vw,3.25rem)] font-bold leading-[1.02] tracking-tighter">
          <SplitWords text={t("Thank you! Your order is confirmed.")} delay={0.35} />
        </h1>
        <p className="relative mx-auto mt-5 max-w-md animate-rise text-sm leading-relaxed text-ink/60" style={delay(650)}>
          {contact != null
            ? tr("Order {number} · {amount} paid. A confirmation has been sent to {contact}.", { number: <strong className="text-ink">{order.orderNumber}</strong>, amount: money(order.grandTotal), contact })
            : tr("Order {number} · {amount} paid. A confirmation has been sent to you.", { number: <strong className="text-ink">{order.orderNumber}</strong>, amount: money(order.grandTotal) })}
        </p>
      </section>

      <section className="mt-6 animate-rise rounded-3xl bg-white p-6 shadow-neu sm:p-8" style={delay(800)}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">{t("Your order")}</p>
          <p className="text-xs text-ink/45">{tn(order.items.length, "{n} item", "{n} items")}</p>
        </div>
        <ul className="mt-3 divide-y divide-black/5">
          {order.items.map((i, idx) => (
            <li key={i.id} className="flex animate-rise items-center gap-4 py-3.5 text-sm" style={delay(900 + Math.min(idx, 6) * 60)}>
              <div className="h-16 w-13 shrink-0 overflow-hidden rounded-xl bg-offwhite">{i.imageUrl && <img src={i.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}</div>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{i.productName}</span>
                <span className="text-ink/50">
                  {i.variantTitle} × {i.quantity}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-black/10 pt-4">
          <span className="text-sm font-semibold">{t("Total")}</span>
          <span className="text-xl font-bold tabular-nums">{money(order.grandTotal)}</span>
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {address && (
          <section className="animate-rise rounded-3xl bg-white p-6 shadow-neu sm:p-7" style={delay(950)}>
            <p className="eyebrow flex items-center gap-2">
              <MapPin size={13} /> {t("Delivering to")}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink/65">
              <span className="font-semibold text-ink">{address.fullName}</span>
              <br />
              {[address.line1, address.line2, address.landmark].filter(Boolean).join(", ")}
              <br />
              {address.city}, {address.state} {address.postalCode}
            </p>
          </section>
        )}
        <section className={`on-dark gold-frame animate-rise rounded-3xl bg-ink p-6 text-white shadow-neu-lg sm:p-7 ${address ? "" : "md:col-span-2"}`} style={delay(1050)}>
          <p className="eyebrow text-white/50">{t("What happens next")}</p>
          <ol className="mt-4 space-y-3.5 text-sm">
            {NEXT_STEPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10">
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <span className="text-white/80">{t(text)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="mt-10 flex animate-rise flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center" style={delay(1150)}>
        <CtaLink href={`/account/orders/${order.orderNumber}`}>{t("Track this order")}</CtaLink>
        <GhostLink href="/products">{t("Continue shopping")}</GhostLink>
      </div>
    </div>
  );
}

function ConfirmationSkeleton() {
  const { t } = useI18n();
  return (
    <div className="container-x max-w-3xl py-12 md:py-20" aria-busy="true">
      <p role="status" className="sr-only">
        {t("Loading your order…")}
      </p>
      <div className="flex flex-col items-center rounded-[2.5rem] bg-white px-6 py-14 shadow-neu">
        <div className="skeleton h-20 w-20 rounded-full" />
        <div className="skeleton mt-8 h-3 w-28" />
        <div className="skeleton mt-4 h-10 w-full max-w-md" />
        <div className="skeleton mt-4 h-3.5 w-3/4 max-w-sm" />
      </div>
      <div className="skeleton mt-6 h-56 rounded-3xl" />
    </div>
  );
}
