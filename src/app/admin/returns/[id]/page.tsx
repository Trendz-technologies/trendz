"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { PageHeader } from "@/components/admin/page";
import { ReturnActions, returnRefundIssued } from "@/components/admin/sales-return-actions";
import { ChannelBadge, DefinitionList, Mono, Notice } from "@/components/admin/sales-shared";
import type { ReturnDetail, ReturnStatus } from "@/components/admin/sales-types";
import { Badge, Card, DataTable, ErrorState, Spinner, Stat, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, moneyExact } from "@/lib/format";

const NEXT_STEP: Partial<Record<ReturnStatus, string>> = {
  REQUESTED: "Review the request: approve it to collect the items, or reject it with a reason for the customer.",
  APPROVED: "Waiting for the items. When they arrive, receive them and record each item's condition.",
  PICKUP_SCHEDULED: "A pickup is scheduled. When the items arrive, receive them and record each item's condition.",
  RECEIVED: "Items are back in stock. Refund the customer, then close the return.",
  REFUNDED: "Refund issued. Close the return to finish.",
};

const CONDITION_TONE = { GOOD: "success", DAMAGED: "danger", DEFECTIVE: "danger" } as const;

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery({ queryKey: ["admin", "return", id], queryFn: () => api.get<ReturnDetail>(`/returns/${id}`) });
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner label="Loading return" />;
  const rr = q.data;
  const units = rr.items.reduce((s, i) => s + i.quantity, 0);
  const refunded = rr.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amount, 0);
  const failed = rr.refunds.filter((r) => r.status === "FAILED");

  const steps: { label: string; at: string | null; done: boolean }[] = [
    { label: "Requested", at: rr.requestedAt, done: true },
    { label: rr.status === "REJECTED" ? "Rejected" : "Approved", at: rr.status === "REJECTED" ? rr.closedAt : rr.approvedAt, done: !!rr.approvedAt || rr.status === "REJECTED" },
    { label: "Received", at: rr.receivedAt, done: !!rr.receivedAt },
    { label: "Refunded", at: rr.refunds.find((r) => r.status !== "FAILED")?.createdAt ?? null, done: refunded > 0 },
    { label: "Closed", at: rr.status === "CLOSED" ? rr.closedAt : null, done: rr.status === "CLOSED" },
  ].filter((s) => rr.status !== "REJECTED" || ["Requested", "Rejected"].includes(s.label));

  return (
    <>
      <PageHeader
        back={{ href: "/admin/returns", label: "Returns" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {rr.returnNumber} <StatusBadge status={rr.status} />
          </span>
        }
        description={
          <>
            Order{" "}
            <Link href={`/admin/orders/${rr.order.id}`} className="link">
              {rr.order.orderNumber}
            </Link>{" "}
            · requested {dateTime(rr.requestedAt)}
          </>
        }
        actions={<ReturnActions rr={rr} />}
      />

      {rr.status === "RECEIVED" && returnRefundIssued(rr) && rr.refundableAmount === 0 ? (
        <Notice className="mb-6">A refund has already been issued for this return (see Refunds below). Close the return to finish.</Notice>
      ) : (
        NEXT_STEP[rr.status] && <Notice className="mb-6">{NEXT_STEP[rr.status]}</Notice>
      )}
      {failed.length > 0 && (
        <Notice tone="danger" className="mb-6">
          {failed.length === 1 ? `Refund ${failed[0]!.refundNumber} failed` : `${failed.length} refunds failed`}
          {failed[0]!.failureReason && `: ${failed[0]!.failureReason}`}.{" "}
          <Link href="/admin/refunds?status=FAILED" className="underline">
            Retry from Refunds
          </Link>
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Units" value={units} hint={`${rr.items.length} line(s)`} />
        <Stat label="Value of returned items" value={moneyExact(rr.refundableAmount)} />
        <Stat label="Refunded" value={moneyExact(refunded)} hint={refunded > 0 && refunded < rr.refundableAmount ? "Partial refund" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card title="Items">
            <DataTable
              rows={rr.items}
              rowKey={(i) => i.id}
              columns={[
                {
                  key: "item",
                  header: "Item",
                  cell: (i) => (
                    <div className="flex items-center gap-3">
                      {i.orderItem.imageUrl ? <img src={i.orderItem.imageUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-xl bg-offwhite object-cover" /> : <span className="h-10 w-10 shrink-0 rounded-xl bg-offwhite" />}
                      <div className="min-w-0">
                        <p className="font-medium">{i.orderItem.productName}</p>
                        <p className="text-xs text-ink/50">
                          {i.orderItem.variantTitle !== "Default" && <>{i.orderItem.variantTitle} · </>}
                          <span className="font-mono">{i.orderItem.sku}</span>
                        </p>
                        {i.reason && <p className="text-xs text-ink/60">“{i.reason}”</p>}
                      </div>
                    </div>
                  ),
                },
                { key: "qty", header: "Qty", align: "right", cell: (i) => `${i.quantity} of ${i.orderItem.quantity}` },
                { key: "value", header: "Value", align: "right", cell: (i) => moneyExact(Math.round((i.orderItem.lineTotal * i.quantity) / i.orderItem.quantity)) },
                {
                  key: "condition",
                  header: "Condition",
                  cell: (i) => (i.condition ? <Badge tone={CONDITION_TONE[i.condition]}>{i.condition.toLowerCase()}</Badge> : <span className="text-ink/35">Not inspected</span>),
                },
                {
                  key: "stock",
                  header: "Stock",
                  cell: (i) =>
                    i.condition ? (
                      <div className="text-xs">
                        <p>{i.restockedQuantity > 0 ? `${i.restockedQuantity} back to sellable` : i.condition === "GOOD" ? "Held in returned stock" : "Moved to damaged"}</p>
                        {i.warehouse && <p className="text-ink/50">{i.warehouse.code}</p>}
                      </div>
                    ) : (
                      <span className="text-ink/35">—</span>
                    ),
                },
                { key: "refund", header: "Refund share", align: "right", cell: (i) => (i.refundAmount ? moneyExact(i.refundAmount) : <span className="text-ink/35">—</span>) },
              ]}
            />
          </Card>

          {rr.refunds.length > 0 && (
            <Card title="Refunds">
              <ul className="divide-y divide-black/5 text-sm">
                {rr.refunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        {r.refundNumber} <StatusBadge status={r.status} />
                      </p>
                      <p className="text-xs text-ink/50">{dateTime(r.createdAt)}</p>
                      {r.razorpayRefundId && <Mono>{r.razorpayRefundId}</Mono>}
                      {r.failureReason && <p className="text-xs text-danger">{r.failureReason}</p>}
                    </div>
                    <span className="font-semibold tabular-nums">{moneyExact(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Request">
            <DefinitionList
              rows={[
                { label: "Customer", value: rr.order.customerName ?? "—" },
                { label: "Email", value: rr.order.customerEmail ?? "—", hidden: !rr.order.customerEmail },
                { label: "Phone", value: rr.order.customerPhone ?? "—", hidden: !rr.order.customerPhone },
                { label: "Channel", value: <ChannelBadge channel={rr.order.channel} /> },
                { label: "Order status", value: <StatusBadge status={rr.order.status} /> },
              ]}
            />
            <div className="mt-4 space-y-3 border-t border-black/5 pt-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Reason</p>
                <p className="mt-0.5 text-ink/80">{rr.reason}</p>
              </div>
              {rr.customerNotes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Customer notes</p>
                  <p className="mt-0.5 whitespace-pre-line text-ink/80">{rr.customerNotes}</p>
                </div>
              )}
              {rr.adminNotes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Staff notes</p>
                  <p className="mt-0.5 whitespace-pre-line text-ink/80">{rr.adminNotes}</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Progress">
            <ol className="space-y-3">
              {steps.map((s) => (
                <li key={s.label} className="flex items-start gap-3 text-sm">
                  <span className={clsx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", s.done ? (s.label === "Rejected" ? "bg-danger" : "bg-ink") : "border border-black/20 bg-white")} aria-hidden />
                  <div>
                    <p className={clsx("font-medium", !s.done && "text-ink/40")}>{s.label}</p>
                    {s.at && <p className="text-xs text-ink/50">{dateTime(s.at)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
