"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { CircleX, Download, ExternalLink, MapPin, Receipt, RotateCcw, Truck, XCircle } from "lucide-react";
import { AccountHeader, DetailSkeleton, Panel, StaggerList, StaggerRow, StatusTrack, Thumb } from "@/components/store/account-ui";
import { delay } from "@/components/store/checkout-ui";
import { PayButton } from "@/components/store/pay-button";
import { ConfirmDialog, StatusBadge, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, download, errorMessage } from "@/lib/api";
import { date, dateTime, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { Order, OrderStatus } from "@/lib/types";
import { ReviewButton } from "@/components/store/reviews";
import { reviewKeys, type AccountReviews } from "@/lib/reviews";

const FLOW: OrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

const outlineBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-black/15 px-5 text-sm font-semibold transition hover:border-ink hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25";

export default function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const toast = useToast();
  const { t, ts, locale } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["order", orderNumber], queryFn: () => api.get<Order>(`/account/orders/${orderNumber}`) });
  // Once the order is delivered its items can be reviewed from here; this is what the customer has written so far.
  const reviews = useQuery({ queryKey: reviewKeys.account, queryFn: () => api.get<AccountReviews>("/account/reviews"), enabled: !!q.data?.deliveredAt });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: () => api.post<Order>(`/account/orders/${orderNumber}/cancel`, { reason }),
    onSuccess: (o) => {
      qc.setQueryData(["order", orderNumber], o);
      setCancelOpen(false);
      toast(o.paymentStatus === "PAID" || o.amountRefunded ? t("Order cancelled. Your refund has been initiated.") : t("Order cancelled"));
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  if (q.isLoading || !q.data) return <DetailSkeleton label={t("Loading your order")} />;
  const o = q.data;
  const reached = FLOW.indexOf(o.status);
  const cancelled = o.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <AccountHeader eyebrow={t("Order")} title={o.orderNumber} long back={{ href: "/account/orders", label: t("All orders") }} description={t("Placed {date}", { date: dateTime(o.placedAt, locale) })}>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status={o.status} />
          <StatusBadge status={o.paymentStatus} />
        </div>
      </AccountHeader>

      {o.canPay && (
        <Panel eyebrow={t("Action needed")} title={t("Complete your payment")} className="ring-2 ring-accent/30" delay={0}>
          <p className="mb-5 text-sm text-ink/60">
            {o.reservationExpiresAt
              ? t("This order is reserved until {date}. Pay now to confirm it.", { date: dateTime(o.reservationExpiresAt, locale) })
              : t("This order is reserved until shortly. Pay now to confirm it.")}
          </p>
          <div className="max-w-sm">
            <PayButton orderId={o.id} amount={o.grandTotal} onOutcome={(r) => (r.status === "paid" ? q.refetch() : r.status === "failed" ? toast(r.message, "error") : undefined)} />
          </div>
        </Panel>
      )}

      {cancelled && (
        <Panel delay={0.05}>
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
              <CircleX size={20} strokeWidth={1.75} />
            </span>
            <div className="text-sm">
              <p className="font-semibold">{o.cancelledAt ? t("This order was cancelled on {date}.", { date: date(o.cancelledAt, locale) }) : t("This order was cancelled.")}</p>
              {o.cancelReason && <p className="mt-1 text-ink/60">{t("Reason: {reason}", { reason: o.cancelReason })}</p>}
              {o.amountRefunded > 0 && <p className="mt-1 text-ink/60">{t("{amount} has been refunded to your original payment method.", { amount: money(o.amountRefunded) })}</p>}
            </div>
          </div>
        </Panel>
      )}

      {!cancelled && o.status !== "PENDING" && (
        <Panel eyebrow={t("Progress")} title={ts(o.status)} delay={0.05}>
          <StatusTrack steps={FLOW.map((s) => ts(s))} current={reached} label={t("Order progress")} />
          {o.shipments.map((s) => (
            <div key={s.id} className="mt-7 rounded-2xl bg-offwhite p-4 text-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2">
                  <Truck size={16} strokeWidth={1.75} />
                  <span className="font-semibold">{s.courierName ?? t("Courier")}</span> <span className="text-ink/50">· {s.awb != null ? `AWB ${s.awb}` : t("AWB pending")}</span>
                </p>
                {s.trackingUrl && (
                  <a
                    href={s.trackingUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35"
                  >
                    {t("Track")} <ExternalLink size={12} />
                  </a>
                )}
              </div>
              {s.events.length > 0 && (
                <StaggerList className="relative mt-4 space-y-3 border-l-2 border-black/10 pl-5">
                  {s.events.slice(0, 6).map((e, i) => (
                    <StaggerRow key={e.id} className="relative text-xs">
                      <span aria-hidden="true" className={clsx("absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-offwhite", i === 0 ? "animate-pulse-dot bg-accent" : "bg-ink/25")} />
                      <span className="font-semibold">{e.rawStatus}</span>
                      {e.location ? ` · ${e.location}` : ""} <span className="text-ink/45">· {dateTime(e.occurredAt, locale)}</span>
                    </StaggerRow>
                  ))}
                </StaggerList>
              )}
            </div>
          ))}
        </Panel>
      )}

      <Panel title={t("Items")} padded={false} delay={0.1}>
        <StaggerList className="divide-y divide-black/5">
          {o.items.map((i) => (
            <StaggerRow key={i.id} className="flex items-center gap-4 px-5 py-4 sm:px-7">
              <Thumb src={i.imageUrl} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{i.productName}</p>
                <p className="text-ink/55">
                  {i.variantTitle} · {t("Qty {n}", { n: i.quantity })} · SKU {i.sku}
                </p>
                {i.returnedQuantity > 0 && <p className="text-xs text-ink/50">{t("{n} returned", { n: i.returnedQuantity })}</p>}
                {o.deliveredAt && reviews.data?.enabled && (
                  <ReviewButton className="mt-2" target={{ productId: i.productId, productName: i.productName }} review={reviews.data.reviews.find((r) => r.productId === i.productId) ?? null} />
                )}
              </div>
              <span className="text-sm font-semibold tabular-nums">{money(i.lineTotal)}</span>
            </StaggerRow>
          ))}
        </StaggerList>
        <dl className="space-y-2 border-t border-dashed border-black/10 px-5 py-5 text-sm sm:px-7">
          <Row label={t("Subtotal")} value={money(o.subtotal)} />
          {o.discountTotal > 0 && <Row label={o.couponCode ? t("Discounts ({code})", { code: o.couponCode }) : t("Discounts")} value={`− ${money(o.discountTotal)}`} />}
          <Row label={t("Shipping")} value={o.shippingTotal ? money(o.shippingTotal) : t("Free")} />
          <Row label={t("GST included")} value={money(o.taxTotal)} />
          <Row label={t("Total")} value={money(o.grandTotal)} strong />
          {o.amountRefunded > 0 && <Row label={t("Refunded")} value={money(o.amountRefunded)} />}
        </dl>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        {o.shippingAddress && (
          <Panel eyebrow={t("Delivery address")} delay={0.15}>
            <div className="flex gap-3 text-sm">
              <MapPin size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink/40" />
              <p className="leading-relaxed text-ink/70">
                <span className="font-semibold text-ink">{o.shippingAddress.fullName}</span>
                <br />
                {[o.shippingAddress.line1, o.shippingAddress.line2, o.shippingAddress.landmark].filter(Boolean).join(", ")}
                <br />
                {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.postalCode}
                <br />
                {o.shippingAddress.phone}
              </p>
            </div>
          </Panel>
        )}
        <Panel eyebrow={t("Payment & documents")} delay={0.2}>
          <ul className="space-y-3 text-sm">
            {o.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="capitalize">
                  {p.method ?? p.provider} {p.paidAt ? `· ${date(p.paidAt, locale)}` : ""}
                </span>
                <StatusBadge status={p.status} />
              </li>
            ))}
            {o.refunds.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-ink/70">
                <span>
                  {t("Refund {number}", { number: r.refundNumber })} · {money(r.amount)}
                </span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
          {o.invoice && (
            <button
              type="button"
              className={clsx(outlineBtn, "group mt-5 h-10 max-w-full text-xs")}
              onClick={() => download(`/account/orders/${o.orderNumber}/invoice.pdf`, `${o.invoice!.invoiceNumber.replace(/\//g, "-")}.pdf`).catch((e) => toast(errorMessage(e), "error"))}
            >
              <Download size={14} className="shrink-0 transition-transform duration-300 group-hover:translate-y-0.5" />
              <span className="truncate">{t("Download invoice {number}", { number: o.invoice.invoiceNumber })}</span>
            </button>
          )}
          {!o.payments.length && !o.refunds.length && !o.invoice && (
            <p className="flex items-center gap-2 text-sm text-ink/50">
              <Receipt size={15} /> {t("Nothing here yet.")}
            </p>
          )}
        </Panel>
      </div>

      {(o.canReturn || o.canCancel || (o.returnWindowEnds && o.status === "DELIVERED")) && (
        <div className="flex animate-rise flex-wrap items-center gap-3" style={delay(300)}>
          {o.canReturn && (
            <Link href={`/account/returns/new?order=${o.orderNumber}`} className={outlineBtn}>
              <RotateCcw size={15} /> {t("Return items")}
            </Link>
          )}
          {o.canCancel && (
            <button type="button" className={clsx(outlineBtn, "hover:border-danger hover:text-danger")} onClick={() => setCancelOpen(true)}>
              <XCircle size={15} /> {t("Cancel order")}
            </button>
          )}
          {o.returnWindowEnds && o.status === "DELIVERED" && <p className="text-xs text-ink/50">{t("Returns accepted until {date}", { date: date(o.returnWindowEnds, locale) })}</p>}
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title={t("Cancel this order?")}
        body={o.paymentStatus === "PAID" ? t("You will receive a full refund to your original payment method.") : t("Your reserved items will be released.")}
        confirmLabel={t("Cancel order")}
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => (reason.trim().length >= 3 ? cancel.mutate() : toast(t("Tell us why you are cancelling"), "info"))}
        onClose={() => setCancelOpen(false)}
      >
        <label htmlFor="reason" className="label mt-4">
          {t("Reason")}
        </label>
        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("e.g. ordered the wrong size")} className="min-h-16" />
      </ConfirmDialog>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={clsx("flex justify-between gap-4", strong && "pt-2 text-base font-bold")}>
      <dt className={strong ? "" : "text-ink/60"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
