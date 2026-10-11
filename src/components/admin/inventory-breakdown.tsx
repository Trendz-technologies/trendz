"use client";

import Link from "next/link";
import { History, SlidersHorizontal } from "lucide-react";
import { Can } from "@/components/admin/page";
import { Button, DataTable, EmptyState, ErrorState, Modal, Spinner } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { qty, useVariantStock, variantLabel, type PickedVariant } from "./inventory-shared";

/** Per-warehouse levels and active reservations for one variant. */
export function StockBreakdownModal({
  variantId,
  title,
  onClose,
  onAdjust,
  onViewLedger,
}: {
  variantId: string;
  title: string;
  onClose: () => void;
  onAdjust?: (variant: PickedVariant) => void;
  onViewLedger?: (sku: string) => void;
}) {
  const q = useVariantStock(variantId);
  const v = q.data;
  const warehouseName = (id: string) => {
    const l = v?.inventoryLevels.find((x) => x.warehouseId === id);
    return l ? `${l.warehouse.code} · ${l.warehouse.name}` : "—";
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={v ? variantLabel(v.product.name, v.title) : title}
      size="xl"
      footer={
        <>
          {v && onViewLedger && (
            <Button variant="ghost" icon={<History size={15} />} onClick={() => onViewLedger(v.sku)}>
              View ledger
            </Button>
          )}
          {v && onAdjust && (
            <Can permission="inventory.adjust">
              <Button variant="outline" icon={<SlidersHorizontal size={15} />} onClick={() => onAdjust({ variantId: v.id, sku: v.sku, label: variantLabel(v.product.name, v.title) })}>
                Adjust stock
              </Button>
            </Can>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !v ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-mono text-xs text-ink/55">{v.sku}</p>
            <Link href={`/admin/products/${v.product.id}`} className="link text-xs">
              Open product
            </Link>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "On hand", value: v.totals.onHand },
              { label: "Reserved", value: v.totals.reserved },
              { label: "Available", value: v.totals.available },
              { label: "Damaged", value: v.totals.damaged },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-offwhite px-4 py-3">
                <dt className="text-xs font-medium text-ink/50">{s.label}</dt>
                <dd className={`mt-0.5 text-lg font-bold tabular-nums ${s.label === "Available" && s.value <= 0 ? "text-danger" : ""}`}>{qty(s.value)}</dd>
              </div>
            ))}
          </dl>

          <section>
            <h3 className="mb-2 text-sm font-semibold">By warehouse</h3>
            <div>
              <DataTable
                rows={v.inventoryLevels}
                rowKey={(l) => l.id}
                empty={<EmptyState title="No stock recorded" body="This variant has never been stocked in any warehouse." />}
                columns={[
                  {
                    key: "wh",
                    header: "Warehouse",
                    cell: (l) => (
                      <Link href={`/admin/warehouses/${l.warehouse.id}`} className="font-medium hover:underline">
                        {l.warehouse.code} <span className="font-normal text-ink/55">· {l.warehouse.name}</span>
                      </Link>
                    ),
                  },
                  { key: "bin", header: "Bin", cell: (l) => l.location?.code ?? "—" },
                  { key: "oh", header: "On hand", align: "right", cell: (l) => qty(l.onHand) },
                  { key: "res", header: "Reserved", align: "right", cell: (l) => qty(l.reserved) },
                  { key: "av", header: "Available", align: "right", cell: (l) => <span className={l.available <= 0 ? "font-semibold text-danger" : "font-semibold"}>{qty(l.available)}</span> },
                  { key: "dmg", header: "Damaged", align: "right", cell: (l) => qty(l.damaged) },
                  { key: "ret", header: "Returned", align: "right", cell: (l) => qty(l.returned) },
                  { key: "upd", header: "Updated", cell: (l) => <span className="whitespace-nowrap text-ink/55">{dateTime(l.updatedAt)}</span> },
                ]}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Active reservations</h3>
            {v.reservations.length === 0 ? (
              <p className="text-sm text-ink/50">No units are currently reserved.</p>
            ) : (
              <div>
                <DataTable
                  rows={v.reservations.map((r, i) => ({ ...r, key: `${r.orderId ?? "x"}-${r.warehouseId}-${i}` }))}
                  rowKey={(r) => r.key}
                  columns={[
                    { key: "order", header: "Order", cell: (r) => (r.orderId ? <Link href={`/admin/orders/${r.orderId}`} className="link">View order</Link> : "Cart / POS hold") },
                    { key: "wh", header: "Warehouse", cell: (r) => warehouseName(r.warehouseId) },
                    { key: "q", header: "Quantity", align: "right", cell: (r) => qty(r.quantity) },
                    { key: "exp", header: "Expires", cell: (r) => (r.expiresAt ? dateTime(r.expiresAt) : "Until fulfilled") },
                  ]}
                />
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
