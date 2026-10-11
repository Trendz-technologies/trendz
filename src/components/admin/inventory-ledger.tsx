"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { SearchInput, useListState } from "@/components/admin/page";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Input, Pagination, Select, type Tone } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, titleCase } from "@/lib/format";
import { qty, signed, variantLabel, WarehouseOptions } from "./inventory-shared";
import { MOVEMENT_TYPES, type LedgerRow, type MovementType } from "./inventory-types";

const TYPE_TONE: Record<MovementType, Tone> = {
  PURCHASE: "success",
  SALE: "neutral",
  RETURN: "info",
  REFUND: "info",
  DAMAGE: "danger",
  ADJUSTMENT: "warning",
  STOCK_CORRECTION: "warning",
  TRANSFER_IN: "info",
  TRANSFER_OUT: "info",
  RESERVATION: "neutral",
  RESERVATION_RELEASE: "neutral",
};

const BUCKET_LABEL: Record<string, string> = { ON_HAND: "On hand", RESERVED: "Reserved", DAMAGED: "Damaged", RETURNED: "Returned" };

/** Local calendar day (yyyy-mm-dd) → ISO bounds so the "to" day is inclusive. */
const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

function Reference({ r }: { r: LedgerRow }) {
  if (!r.referenceNumber && !r.referenceId) return <span className="text-ink/35">—</span>;
  const label = r.referenceNumber ?? r.referenceId ?? "";
  let href: string | null = null;
  if (r.referenceId && r.referenceType === "ORDER") href = `/admin/orders/${r.referenceId}`;
  else if (r.referenceId && r.referenceType === "TRANSFER") href = `/admin/inventory/transfers/${r.referenceId}`;
  else if (r.referenceId && r.referenceType === "RETURN") href = `/admin/returns/${r.referenceId}`;
  else if (r.referenceType === "GOODS_RECEIPT") {
    // Reference number is "GRN-… / PO-…"; the PO list can search by number.
    const po = label.split(" / ")[1];
    if (po) href = `/admin/purchase-orders?q=${encodeURIComponent(po)}`;
  }
  return (
    <div className="min-w-0">
      {r.referenceType && <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">{titleCase(r.referenceType)}</p>}
      {href ? (
        <Link href={href} className="link whitespace-nowrap text-xs" onClick={(e) => e.stopPropagation()}>
          {label}
        </Link>
      ) : (
        <span className="whitespace-nowrap text-xs">{label}</span>
      )}
    </div>
  );
}

export function InventoryLedgerTab() {
  const { page, filters, set, setPage } = useListState({ warehouseId: "", type: "", sku: "", from: "", to: "" });
  const type = (MOVEMENT_TYPES as readonly string[]).includes(filters.type) ? filters.type : "";
  const rangeInvalid = !!(filters.from && filters.to && filters.from > filters.to);

  const q = useQuery({
    queryKey: ["admin", "inventory", "ledger", page, filters.warehouseId, type, filters.sku, filters.from, filters.to],
    queryFn: () =>
      api.page<LedgerRow[]>("/inventory/transactions", {
        page,
        limit: 50,
        warehouseId: filters.warehouseId || undefined,
        type: type || undefined,
        sku: filters.sku || undefined,
        from: dayStart(filters.from),
        to: dayEnd(filters.to),
      }),
    placeholderData: keepPreviousData,
    enabled: !rangeInvalid,
  });
  const filtered = !!(filters.warehouseId || type || filters.sku || filters.from || filters.to);

  return (
    <Card>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] lg:items-end">
        <div>
          <span className="label" aria-hidden>
            SKU
          </span>
          <SearchInput value={filters.sku} onChange={(v) => set({ sku: v })} placeholder="Filter by SKU" className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="ledger-wh">
            Warehouse
          </label>
          <Select id="ledger-wh" value={filters.warehouseId} onChange={(e) => set({ warehouseId: e.target.value })}>
            <option value="">All warehouses</option>
            <WarehouseOptions />
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="ledger-type">
            Movement
          </label>
          <Select id="ledger-type" value={type} onChange={(e) => set({ type: e.target.value })}>
            <option value="">All movements</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="ledger-from">
            From
          </label>
          <Input id="ledger-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="ledger-to">
            To
          </label>
          <Input id="ledger-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" className="lg:mb-1" onClick={() => set({ warehouseId: "", type: "", sku: "", from: "", to: "" })}>
            Clear filters
          </Button>
        )}
      </div>
      {rangeInvalid ? (
        <EmptyState title="Invalid date range" body="The “From” date must be on or before the “To” date." />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <DataTable
          loading={q.isLoading}
          rows={q.data?.data}
          rowKey={(r) => r.id}
          empty={<EmptyState icon={<ScrollText size={22} />} title={filtered ? "No movements match these filters" : "No stock movements yet"} />}
          columns={[
            { key: "time", header: "Time", cell: (r) => <span className="whitespace-nowrap text-xs text-ink/60">{dateTime(r.createdAt)}</span> },
            { key: "type", header: "Movement", cell: (r) => <Badge tone={TYPE_TONE[r.type] ?? "neutral"}>{titleCase(r.type)}</Badge> },
            {
              key: "item",
              header: "Item",
              cell: (r) => (
                <div className="min-w-0 max-w-60">
                  <p className="truncate text-sm font-medium">{variantLabel(r.variant.product.name, r.variant.title)}</p>
                  <p className="font-mono text-xs text-ink/50">{r.sku}</p>
                </div>
              ),
            },
            { key: "wh", header: "Warehouse", cell: (r) => <span title={r.warehouse.name}>{r.warehouse.code}</span> },
            { key: "bucket", header: "Bucket", cell: (r) => <span className="text-ink/60">{BUCKET_LABEL[r.bucket] ?? r.bucket}</span> },
            {
              key: "qty",
              header: "Qty",
              align: "right",
              cell: (r) => <span className={r.quantity > 0 ? "font-semibold text-success" : r.quantity < 0 ? "font-semibold text-danger" : ""}>{signed(r.quantity)}</span>,
            },
            {
              key: "balance",
              header: "Balance",
              align: "right",
              cell: (r) => (
                <span className="whitespace-nowrap text-ink/60">
                  {qty(r.balanceBefore)} → <span className="font-medium text-ink">{qty(r.balanceAfter)}</span>
                </span>
              ),
            },
            { key: "ref", header: "Reference", cell: (r) => <Reference r={r} /> },
            { key: "user", header: "By", cell: (r) => <span className="whitespace-nowrap text-xs text-ink/60">{r.user ? r.user.name || r.user.email : "System"}</span> },
            { key: "notes", header: "Notes", cell: (r) => <span className="line-clamp-2 max-w-56 text-xs text-ink/60" title={r.notes ?? undefined}>{r.notes ?? "—"}</span> },
          ]}
        />
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </Card>
  );
}
