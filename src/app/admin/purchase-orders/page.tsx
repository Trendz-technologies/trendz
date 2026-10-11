"use client";

import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, X } from "lucide-react";
import { Can, PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { ButtonLink, qty } from "@/components/admin/inventory-shared";
import { PO_STATUSES, type PoRow, type Supplier } from "@/components/admin/inventory-types";
import { Card, DataTable, EmptyState, ErrorState, Pagination, Select, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date, money, titleCase } from "@/lib/format";

function Progress({ received, ordered }: { received: number; ordered: number }) {
  const pct = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0;
  return (
    <div className="min-w-24">
      <p className="text-xs tabular-nums text-ink/60">
        {qty(received)} / {qty(ordered)}
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/6" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Received">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-ink/60"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { page, filters, set, setPage } = useListState({ q: "", status: "", supplierId: "" });
  const status = (PO_STATUSES as string[]).includes(filters.status) ? filters.status : "";
  const supplier = useQuery({
    queryKey: ["admin", "suppliers", "detail", filters.supplierId],
    queryFn: () => api.get<Supplier>(`/suppliers/${filters.supplierId}`),
    enabled: !!filters.supplierId,
  });

  const q = useQuery({
    queryKey: ["admin", "purchase-orders", "list", page, filters.q, status, filters.supplierId],
    queryFn: () => api.page<PoRow[]>("/purchase-orders", { page, limit: 25, q: filters.q || undefined, status: status || undefined, supplierId: filters.supplierId || undefined }),
    placeholderData: keepPreviousData,
  });
  const filtered = !!(filters.q || status || filters.supplierId);

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Order stock from suppliers, get approval and receive goods into a warehouse."
        actions={
          <Can permission="purchases.write">
            <ButtonLink href="/admin/purchase-orders/new" icon={<Plus size={15} />}>
              New purchase order
            </ButtonLink>
          </Can>
        }
      />
      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Search PO number" />
          <Select aria-label="Status" className="sm:w-52" value={status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">All statuses</option>
            {PO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </Select>
          {filters.supplierId && (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-black/5 py-1 pl-3 pr-1 text-xs font-medium sm:self-auto">
              Supplier: {supplier.data?.name ?? "…"}
              <button type="button" aria-label="Clear supplier filter" className="rounded-full p-1 hover:bg-black/10" onClick={() => set({ supplierId: "" })}>
                <X size={12} />
              </button>
            </span>
          )}
        </div>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/admin/purchase-orders/${p.id}`)}
            empty={
              <EmptyState
                icon={<ClipboardList size={22} />}
                title={filtered ? "No purchase orders match these filters" : "No purchase orders yet"}
                body={filtered ? undefined : "Raise a purchase order to restock from a supplier."}
                action={
                  !filtered && (
                    <Can permission="purchases.write">
                      <ButtonLink href="/admin/purchase-orders/new" size="sm" icon={<Plus size={14} />}>
                        New purchase order
                      </ButtonLink>
                    </Can>
                  )
                }
              />
            }
            columns={[
              { key: "number", header: "PO", cell: (p) => <span className="font-medium">{p.number}</span> },
              {
                key: "supplier",
                header: "Supplier",
                cell: (p) => (
                  <div className="min-w-0 max-w-56">
                    <p className="truncate">{p.supplier.name}</p>
                    <p className="font-mono text-xs text-ink/50">{p.supplier.code}</p>
                  </div>
                ),
              },
              { key: "warehouse", header: "Deliver to", cell: (p) => <span title={p.warehouse.name}>{p.warehouse.code}</span> },
              { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
              { key: "ordered", header: "Ordered", cell: (p) => <span className="whitespace-nowrap">{date(p.orderDate)}</span> },
              { key: "eta", header: "Expected", cell: (p) => <span className="whitespace-nowrap">{date(p.expectedDeliveryDate)}</span> },
              { key: "received", header: "Received", cell: (p) => <Progress received={p.quantityReceived} ordered={p.quantityOrdered} /> },
              { key: "total", header: "Total", align: "right", cell: (p) => <span className="font-medium">{money(p.grandTotal)}</span> },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
