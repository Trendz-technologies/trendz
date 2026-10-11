"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, FileCheck2, Lock, PackageCheck, Pencil, Send } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { ButtonLink, DetailList, detailedError, qty } from "@/components/admin/inventory-shared";
import { ReceiveGoodsModal } from "@/components/admin/inventory-po-receive";
import type { PoDetail } from "@/components/admin/inventory-types";
import { Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Spinner, Stat, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { date, dateTime, moneyExact, percent, titleCase } from "@/lib/format";

type Transition = "submit" | "approve" | "cancel" | "close";

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "purchase-orders", "detail", id], queryFn: () => api.get<PoDetail>(`/purchase-orders/${id}`) });
  const [confirm, setConfirm] = useState<Transition | null>(null);
  const [receiving, setReceiving] = useState(false);

  const transition = useMutation({
    mutationFn: (action: Transition) => api.post<PoDetail>(`/purchase-orders/${id}/${action}`),
    onSuccess: (po) => {
      void qc.invalidateQueries({ queryKey: ["admin", "purchase-orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      setConfirm(null);
      toast(`${po.number} is now ${titleCase(po.status).toLowerCase()}`);
    },
    onError: (e) => toast(detailedError(e), "error"),
  });

  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner />;
  const po = q.data;
  const ordered = po.items.reduce((s, i) => s + i.quantityOrdered, 0);
  const received = po.items.reduce((s, i) => s + i.quantityReceived, 0);
  const pending = po.items.reduce((s, i) => s + i.quantityPending, 0);
  const itemById = new Map(po.items.map((i) => [i.id, i]));
  const canReceive = (po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED") && pending > 0;

  const copy: Record<Transition, { title: string; body: string; label: string; tone: "primary" | "danger" }> = {
    submit: { title: `Submit ${po.number} for approval?`, body: "Once submitted the purchase order can no longer be edited.", label: "Submit", tone: "primary" },
    approve: { title: `Approve ${po.number}?`, body: `Approves an order of ${qty(ordered)} unit(s) worth ${moneyExact(po.grandTotal)} from ${po.supplier.name}. Goods can then be received against it.`, label: "Approve", tone: "primary" },
    cancel: { title: `Cancel ${po.number}?`, body: "The purchase order will be cancelled. This cannot be undone.", label: "Cancel PO", tone: "danger" },
    close: {
      title: `Close ${po.number}?`,
      body: pending > 0 ? `${qty(pending)} unit(s) are still pending and will no longer be expected from the supplier. Closing cannot be undone.` : "All goods have been received. Closing marks the order as complete.",
      label: "Close PO",
      tone: pending > 0 ? "danger" : "primary",
    },
  };

  const timeline = [
    { label: "Created", at: po.createdAt },
    { label: "Submitted", at: po.submittedAt },
    { label: "Approved", at: po.approvedAt },
    { label: "First receipt", at: po.receipts.length ? po.receipts[po.receipts.length - 1]!.receivedAt : null },
    { label: "Closed", at: po.closedAt },
    { label: "Cancelled", at: po.cancelledAt },
  ].filter((e) => e.at);

  return (
    <>
      <PageHeader
        title={po.number}
        description={
          <>
            {po.supplier.name} → {po.warehouse.name}
          </>
        }
        back={{ href: "/admin/purchase-orders", label: "Purchase orders" }}
        actions={
          <>
            <StatusBadge status={po.status} />
            {po.status === "DRAFT" && (
              <Can permission="purchases.write">
                <ButtonLink href={`/admin/purchase-orders/${po.id}/edit`} variant="outline" icon={<Pencil size={15} />}>
                  Edit
                </ButtonLink>
              </Can>
            )}
            {(po.status === "DRAFT" || po.status === "SUBMITTED" || po.status === "APPROVED") && (
              <Can permission="purchases.approve">
                <Button variant="outline" icon={<Ban size={15} />} onClick={() => setConfirm("cancel")}>
                  Cancel
                </Button>
              </Can>
            )}
            {(po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED") && (
              <Can permission="purchases.approve">
                <Button variant="outline" icon={<Lock size={15} />} onClick={() => setConfirm("close")}>
                  Close
                </Button>
              </Can>
            )}
            {po.status === "DRAFT" && (
              <Can permission="purchases.write">
                <Button icon={<Send size={15} />} onClick={() => setConfirm("submit")}>
                  Submit for approval
                </Button>
              </Can>
            )}
            {po.status === "SUBMITTED" && (
              <Can permission="purchases.approve">
                <Button icon={<CheckCircle2 size={15} />} onClick={() => setConfirm("approve")}>
                  Approve
                </Button>
              </Can>
            )}
            {canReceive && (
              <Can permission="purchases.receive">
                <Button icon={<PackageCheck size={15} />} onClick={() => setReceiving(true)}>
                  Receive goods
                </Button>
              </Can>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ordered" value={`${qty(ordered)} units`} hint={`${po.items.length} line(s)`} />
        <Stat label="Received" value={`${qty(received)} units`} hint={ordered ? `${Math.round((received / ordered) * 100)}% of order` : undefined} />
        <Stat label="Pending" value={`${qty(pending)} units`} hint={po.status === "CLOSED" || po.status === "CANCELLED" ? "No longer expected" : undefined} />
        <Stat label="Grand total" value={moneyExact(po.grandTotal)} hint="Incl. GST and shipping" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card title="Items">
            <DataTable
              rows={po.items}
              rowKey={(i) => i.id}
              columns={[
                {
                  key: "item",
                  header: "Item",
                  cell: (i) => (
                    <div className="min-w-0 max-w-64">
                      <p className="font-medium">{i.description}</p>
                      <p className="font-mono text-xs text-ink/50">{i.sku}</p>
                    </div>
                  ),
                },
                { key: "ord", header: "Ordered", align: "right", cell: (i) => qty(i.quantityOrdered) },
                { key: "rec", header: "Received", align: "right", cell: (i) => qty(i.quantityReceived) },
                {
                  key: "pend",
                  header: "Pending",
                  align: "right",
                  cell: (i) => (i.quantityPending > 0 ? <span className="font-semibold text-warning">{qty(i.quantityPending)}</span> : <span className="text-ink/35">0</span>),
                },
                { key: "cost", header: "Unit cost", align: "right", cell: (i) => moneyExact(i.unitCost) },
                { key: "gst", header: "GST", align: "right", cell: (i) => <span title={moneyExact(i.taxAmount)}>{percent(i.taxRateBps)}</span> },
                { key: "total", header: "Line total", align: "right", cell: (i) => <span className="font-medium">{moneyExact(i.lineTotal)}</span> },
              ]}
            />
            <dl className="ml-auto mt-4 max-w-xs space-y-2 border-t border-black/5 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/55">Subtotal (excl. GST)</dt>
                <dd className="tabular-nums">{moneyExact(po.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/55">GST</dt>
                <dd className="tabular-nums">{moneyExact(po.taxTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/55">Shipping</dt>
                <dd className="tabular-nums">{moneyExact(po.shippingCost)}</dd>
              </div>
              <div className="flex justify-between border-t border-black/5 pt-2 text-base font-semibold">
                <dt>Grand total</dt>
                <dd className="tabular-nums">{moneyExact(po.grandTotal)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Goods received notes">
            {po.receipts.length === 0 ? (
              <EmptyState
                icon={<FileCheck2 size={22} />}
                title="Nothing received yet"
                body={po.status === "APPROVED" ? "Use “Receive goods” when the delivery arrives." : po.status === "DRAFT" || po.status === "SUBMITTED" ? "Goods can be received once the order is approved." : undefined}
              />
            ) : (
              <ol className="space-y-4">
                {po.receipts.map((r) => {
                  const good = r.items.reduce((s, i) => s + i.quantityReceived, 0);
                  const bad = r.items.reduce((s, i) => s + i.quantityDamaged, 0);
                  return (
                    <li key={r.id} className="rounded-2xl border border-black/5 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold">{r.number}</p>
                        <p className="text-xs text-ink/55">{dateTime(r.receivedAt)}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-ink/55">
                        {qty(good)} good{bad > 0 ? ` · ${qty(bad)} damaged` : ""}
                      </p>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {r.items.map((ri) => {
                          const item = itemById.get(ri.purchaseOrderItemId);
                          return (
                            <li key={ri.id} className="flex justify-between gap-3">
                              <span className="min-w-0 truncate">
                                {item?.description ?? "Item"} <span className="font-mono text-xs text-ink/45">{item?.sku}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-ink/70">
                                {qty(ri.quantityReceived)}
                                {ri.quantityDamaged > 0 && <span className="text-danger"> + {qty(ri.quantityDamaged)} damaged</span>}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {r.notes && <p className="mt-3 whitespace-pre-wrap text-xs text-ink/60">{r.notes}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Details">
            <DetailList
              items={[
                {
                  label: "Supplier",
                  value: (
                    <Link href={`/admin/suppliers/${po.supplier.id}`} className="link">
                      {po.supplier.name}
                    </Link>
                  ),
                },
                { label: "Supplier GSTIN", value: po.supplier.gstin ? <span className="font-mono text-xs">{po.supplier.gstin}</span> : "Unregistered" },
                {
                  label: "Deliver to",
                  value: (
                    <Link href={`/admin/warehouses/${po.warehouse.id}`} className="link">
                      {po.warehouse.code} · {po.warehouse.name}
                    </Link>
                  ),
                },
                { label: "Order date", value: date(po.orderDate) },
                { label: "Expected delivery", value: date(po.expectedDeliveryDate) },
              ]}
            />
          </Card>
          <Card title="Timeline">
            <ol className="space-y-3 text-sm">
              {timeline.map((e) => (
                <li key={e.label} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${e.label === "Cancelled" ? "bg-danger" : "bg-success"}`} aria-hidden />
                  <span className="font-medium">{e.label}</span>
                  <span className="ml-auto text-xs text-ink/55">{dateTime(e.at)}</span>
                </li>
              ))}
            </ol>
          </Card>
          {po.notes && (
            <Card title="Notes">
              <p className="whitespace-pre-wrap text-sm text-ink/70">{po.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          open
          title={copy[confirm].title}
          body={copy[confirm].body}
          confirmLabel={copy[confirm].label}
          tone={copy[confirm].tone}
          loading={transition.isPending}
          onConfirm={() => transition.mutate(confirm)}
          onClose={() => !transition.isPending && setConfirm(null)}
        />
      )}
      {receiving && <ReceiveGoodsModal po={po} onClose={() => setReceiving(false)} />}
    </>
  );
}
