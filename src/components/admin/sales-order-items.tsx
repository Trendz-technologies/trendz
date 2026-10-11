"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Card, DataTable, StatusBadge } from "@/components/ui";
import { dateTime, moneyExact, percent, pluralize } from "@/lib/format";
import type { StaffOrder } from "./sales-types";

/** Line items with their price, discount and GST, followed by the order totals. */
export function OrderItemsCard({ order }: { order: StaffOrder }) {
  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <Card title={`Items · ${pluralize(units, "unit")}`}>
      <DataTable
        rows={order.items}
        rowKey={(i) => i.id}
        columns={[
          {
            key: "item",
            header: "Item",
            cell: (i) => (
              <div className="flex items-center gap-3">
                {i.imageUrl ? <img src={i.imageUrl} alt="" loading="lazy" decoding="async" className="h-11 w-11 shrink-0 rounded-xl bg-offwhite object-cover" /> : <span className="h-11 w-11 shrink-0 rounded-xl bg-offwhite" />}
                <div className="min-w-0">
                  <p className="font-medium">{i.productName}</p>
                  <p className="text-xs text-ink/50">
                    {i.variantTitle !== "Default" && <>{i.variantTitle} · </>}
                    <span className="font-mono">{i.sku}</span>
                    {i.hsnCode && <> · HSN {i.hsnCode}</>}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: "qty",
            header: "Qty",
            align: "right",
            cell: (i) => (
              <div>
                <p>{i.quantity}</p>
                {i.returnedQuantity > 0 && <p className="text-[11px] text-warning">{i.returnedQuantity} returned</p>}
              </div>
            ),
          },
          {
            key: "price",
            header: "Unit price",
            align: "right",
            cell: (i) => (
              <div>
                <p>{moneyExact(i.unitPrice)}</p>
                {i.mrp > i.unitPrice && <p className="text-[11px] text-ink/40 line-through">{moneyExact(i.mrp)}</p>}
              </div>
            ),
          },
          { key: "discount", header: "Discount", align: "right", cell: (i) => (i.discountAmount ? <span className="text-success">−{moneyExact(i.discountAmount)}</span> : <span className="text-ink/30">—</span>) },
          {
            key: "gst",
            header: "GST",
            align: "right",
            cell: (i) => (
              <div>
                <p>{moneyExact(i.taxAmount)}</p>
                <p className="text-[11px] text-ink/45">{percent(i.taxRateBps)}</p>
              </div>
            ),
          },
          { key: "total", header: "Total", align: "right", cell: (i) => <span className="font-semibold">{moneyExact(i.lineTotal)}</span> },
        ]}
      />
      <div className="mt-4 flex justify-end border-t border-black/5 pt-4">
        <OrderTotals order={order} />
      </div>
    </Card>
  );
}

function Row({ label, value, hint, strong, muted }: { label: ReactNode; value: ReactNode; hint?: ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={clsx("flex items-start justify-between gap-6", strong && "border-t border-black/5 pt-2 text-base font-bold", muted && "text-ink/55")}>
      <dt>
        {label}
        {hint && <span className="block text-[11px] font-normal text-ink/45">{hint}</span>}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function OrderTotals({ order: o }: { order: StaffOrder }) {
  const cgst = o.items.reduce((s, i) => s + i.cgstAmount, 0);
  const sgst = o.items.reduce((s, i) => s + i.sgstAmount, 0);
  const igst = o.items.reduce((s, i) => s + i.igstAmount, 0);
  const shippingTax = o.taxTotal - (cgst + sgst + igst);
  const split = [cgst && `CGST ${moneyExact(cgst)}`, sgst && `SGST ${moneyExact(sgst)}`, igst && `IGST ${moneyExact(igst)}`, shippingTax > 0 && `shipping ${moneyExact(shippingTax)}`].filter(Boolean).join(" · ");

  return (
    <dl className="w-full max-w-sm space-y-2 text-sm">
      <Row label="Subtotal" hint={o.pricesIncludeTax ? "Prices include GST" : undefined} value={moneyExact(o.subtotal)} />
      {o.discountTotal > 0 && <Row label="Discount" hint={o.couponCode ? `Coupon ${o.couponCode}` : undefined} value={<span className="text-success">−{moneyExact(o.discountTotal)}</span>} />}
      {o.pricesIncludeTax ? (
        <Row muted label="GST (included)" hint={split || undefined} value={moneyExact(o.taxTotal)} />
      ) : (
        <Row label="GST" hint={split || undefined} value={moneyExact(o.taxTotal)} />
      )}
      {(o.channel === "ONLINE" || o.shippingTotal > 0) && <Row label="Shipping" value={o.shippingTotal ? moneyExact(o.shippingTotal) : "Free"} />}
      {o.roundOff !== 0 && <Row muted label="Round off" value={`${o.roundOff > 0 ? "+" : "−"}${moneyExact(Math.abs(o.roundOff))}`} />}
      <Row strong label="Grand total" value={moneyExact(o.grandTotal)} />
      {o.amountRefunded > 0 && (
        <>
          <Row label="Refunded" value={<span className="text-danger">−{moneyExact(o.amountRefunded)}</span>} />
          <Row label="Net" value={<span className="font-semibold">{moneyExact(o.grandTotal - o.amountRefunded)}</span>} />
        </>
      )}
    </dl>
  );
}

/** Status history, newest first. */
export function OrderTimelineCard({ order }: { order: StaffOrder }) {
  const history = [...order.statusHistory].reverse();
  return (
    <Card title="Timeline">
      <ol className="relative space-y-4 border-l border-black/10 pl-5">
        {history.map((h, i) => (
          <li key={h.id} className="relative">
            <span className={clsx("absolute -left-6.25 top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white", i === 0 ? "bg-ink" : "bg-black/20")} aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={h.toStatus} />
              {h.fromStatus && <span className="text-xs text-ink/40">from {h.fromStatus.replace(/_/g, " ").toLowerCase()}</span>}
            </div>
            {h.note && <p className="mt-1 text-sm text-ink/70">{h.note}</p>}
            <p className="mt-0.5 text-xs text-ink/45">
              {dateTime(h.createdAt)}
              {!h.changedById && h.fromStatus && " · automatic"}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
