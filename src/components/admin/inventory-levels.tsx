"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { SearchInput, useListState } from "@/components/admin/page";
import { Card, DataTable, EmptyState, ErrorState, Pagination, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { AdjustInitial } from "./inventory-adjust";
import { StockBreakdownModal } from "./inventory-breakdown";
import { LevelBadge, qty, useWarehouses, variantLabel, WarehouseOptions } from "./inventory-shared";
import type { LevelRow } from "./inventory-types";

const STATUS_FILTERS = [
  { value: "all", label: "All stock statuses" },
  { value: "in_stock", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
] as const;

export function InventoryLevelsTab({ onAdjust, onViewLedger }: { onAdjust: (initial: AdjustInitial) => void; onViewLedger: (sku: string) => void }) {
  const { page, filters, set, setPage } = useListState({ warehouseId: "", q: "", status: "all" });
  const status = STATUS_FILTERS.some((s) => s.value === filters.status) ? filters.status : "all";
  const warehouses = useWarehouses();
  const warehouse = warehouses.data?.find((w) => w.id === filters.warehouseId);
  const [selected, setSelected] = useState<LevelRow | null>(null);

  const q = useQuery({
    queryKey: ["admin", "inventory", "levels", page, filters.warehouseId, filters.q, status],
    queryFn: () => api.page<LevelRow[]>("/inventory", { page, limit: 25, warehouseId: filters.warehouseId || undefined, q: filters.q || undefined, status }),
    placeholderData: keepPreviousData,
  });
  const filtered = !!(filters.q || filters.warehouseId || status !== "all");

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Search SKU or product" />
        <Select aria-label="Warehouse" className="sm:w-60" value={filters.warehouseId} onChange={(e) => set({ warehouseId: e.target.value })}>
          <option value="">All warehouses</option>
          <WarehouseOptions />
        </Select>
        <Select aria-label="Stock status" className="sm:w-48" value={status} onChange={(e) => set({ status: e.target.value === "all" ? "" : e.target.value })}>
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      {warehouse && (
        <p className="mb-3 text-xs text-ink/55">
          Quantities are for <span className="font-semibold text-ink">{warehouse.code} · {warehouse.name}</span> only.
        </p>
      )}
      {q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <DataTable
          loading={q.isLoading}
          rows={q.data?.data}
          rowKey={(r) => r.variantId}
          onRowClick={setSelected}
          empty={
            <EmptyState
              icon={<Boxes size={22} />}
              title={filtered ? "No stock matches these filters" : "No variants yet"}
              body={filtered ? "Try a different search, warehouse or status." : "Stock levels appear here once products have variants."}
            />
          }
          columns={[
            { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
            {
              key: "product",
              header: "Product",
              cell: (r) => (
                <div className="min-w-0 max-w-72">
                  <p className="truncate font-medium">{r.productName}</p>
                  {r.title !== "Default" && <p className="truncate text-xs text-ink/50">{r.title}</p>}
                </div>
              ),
            },
            { key: "onHand", header: "On hand", align: "right", cell: (r) => qty(r.onHand) },
            { key: "reserved", header: "Reserved", align: "right", cell: (r) => qty(r.reserved) },
            { key: "available", header: "Available", align: "right", cell: (r) => <span className={r.available <= 0 ? "font-semibold text-danger" : "font-semibold"}>{qty(r.available)}</span> },
            { key: "damaged", header: "Damaged", align: "right", cell: (r) => (r.damaged ? qty(r.damaged) : <span className="text-ink/35">0</span>) },
            { key: "threshold", header: "Low at", align: "right", cell: (r) => <span className="text-ink/55">{qty(r.lowStockThreshold)}</span> },
            { key: "status", header: "Status", cell: (r) => <LevelBadge status={r.status} /> },
            { key: "value", header: "Stock value", align: "right", cell: (r) => (r.stockValue == null ? <span className="text-ink/35" title="No cost price set">—</span> : money(r.stockValue)) },
          ]}
        />
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />

      {selected && (
        <StockBreakdownModal
          variantId={selected.variantId}
          title={variantLabel(selected.productName, selected.title)}
          onClose={() => setSelected(null)}
          onAdjust={(variant) => {
            setSelected(null);
            onAdjust({ variant, warehouseId: filters.warehouseId || undefined });
          }}
          onViewLedger={(sku) => {
            setSelected(null);
            onViewLedger(sku);
          }}
        />
      )}
    </Card>
  );
}
