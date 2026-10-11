"use client";

import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, Truck } from "lucide-react";
import { Can, useListState } from "@/components/admin/page";
import { Card, DataTable, EmptyState, ErrorState, Pagination, Select, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date, dateTime, titleCase } from "@/lib/format";
import { ButtonLink, qty, WarehouseOptions } from "./inventory-shared";
import { TRANSFER_STATUSES, type TransferRow } from "./inventory-types";

function lastEvent(t: TransferRow) {
  if (t.cancelledAt) return `Cancelled ${dateTime(t.cancelledAt)}`;
  if (t.receivedAt) return `Received ${dateTime(t.receivedAt)}`;
  if (t.dispatchedAt) return `Dispatched ${dateTime(t.dispatchedAt)}`;
  return "Not dispatched";
}

export function InventoryTransfersTab() {
  const router = useRouter();
  const { page, filters, set, setPage } = useListState({ tstatus: "", warehouseId: "" });
  const status = (TRANSFER_STATUSES as string[]).includes(filters.tstatus) ? filters.tstatus : "";

  const q = useQuery({
    queryKey: ["admin", "inventory", "transfers", page, status, filters.warehouseId],
    queryFn: () => api.page<TransferRow[]>("/inventory/transfers", { page, limit: 25, status: status || undefined, warehouseId: filters.warehouseId || undefined }),
    placeholderData: keepPreviousData,
  });
  const filtered = !!(status || filters.warehouseId);

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select aria-label="Transfer status" className="sm:w-52" value={status} onChange={(e) => set({ tstatus: e.target.value })}>
          <option value="">All statuses</option>
          {TRANSFER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </Select>
        <Select aria-label="Warehouse" className="sm:w-60" value={filters.warehouseId} onChange={(e) => set({ warehouseId: e.target.value })}>
          <option value="">Any warehouse</option>
          <WarehouseOptions />
        </Select>
      </div>
      {q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <DataTable
          loading={q.isLoading}
          rows={q.data?.data}
          rowKey={(t) => t.id}
          onRowClick={(t) => router.push(`/admin/inventory/transfers/${t.id}`)}
          empty={
            <EmptyState
              icon={<Truck size={22} />}
              title={filtered ? "No transfers match these filters" : "No transfers yet"}
              body={filtered ? undefined : "Move stock between warehouses with a transfer."}
              action={
                !filtered && (
                  <Can permission="inventory.transfer">
                    <ButtonLink href="/admin/inventory/transfers/new" size="sm" icon={<Plus size={14} />}>
                      New transfer
                    </ButtonLink>
                  </Can>
                )
              }
            />
          }
          columns={[
            { key: "number", header: "Transfer", cell: (t) => <span className="font-medium">{t.number}</span> },
            {
              key: "route",
              header: "Route",
              cell: (t) => (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span title={t.fromWarehouse.name}>{t.fromWarehouse.code}</span>
                  <ArrowRight size={13} className="text-ink/40" aria-label="to" />
                  <span title={t.toWarehouse.name}>{t.toWarehouse.code}</span>
                </span>
              ),
            },
            { key: "lines", header: "Lines", align: "right", cell: (t) => t.items.length },
            {
              key: "units",
              header: "Units",
              align: "right",
              cell: (t) => {
                const sent = t.items.reduce((s, i) => s + i.quantity, 0);
                if (t.status !== "RECEIVED") return qty(sent);
                const got = t.items.reduce((s, i) => s + i.receivedQuantity, 0);
                return got === sent ? qty(sent) : <span title="Received / dispatched" className="text-warning">{qty(got)} / {qty(sent)}</span>;
              },
            },
            { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} /> },
            { key: "created", header: "Created", cell: (t) => <span className="whitespace-nowrap">{date(t.createdAt)}</span> },
            { key: "last", header: "Last update", cell: (t) => <span className="whitespace-nowrap text-xs text-ink/55">{lastEvent(t)}</span> },
          ]}
        />
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </Card>
  );
}
