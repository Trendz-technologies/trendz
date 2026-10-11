"use client";

import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ExternalLink, Truck } from "lucide-react";
import { PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { enumOptions, FilterBar, FilterSelect, Mono, RowLink } from "@/components/admin/sales-shared";
import { SHIPMENT_STATUSES, type StaffShipment } from "@/components/admin/sales-types";
import { Badge, Card, DataTable, EmptyState, ErrorState, Pagination, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date, dateTime } from "@/lib/format";

type ShipmentRow = Omit<StaffShipment, "events"> & {
  order: { orderNumber: string; customerName: string | null };
  warehouse: { code: string };
};

const DEFAULTS = { q: "", status: "" };

export default function ShippingPage() {
  const router = useRouter();
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const q = useQuery({
    queryKey: ["admin", "shipments", page, filters],
    queryFn: () => api.page<ShipmentRow[]>("/shipments", { page, limit: 25, q: filters.q, status: filters.status }),
    placeholderData: keepPreviousData,
  });
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader title="Shipping" description="Courier shipments for online orders. Open the order to create shipments, print labels or refresh tracking." />
      <Card>
        <FilterBar active={filtered} onClear={() => set(DEFAULTS)}>
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="AWB or order number" />
          <FilterSelect label="Shipment status" allLabel="All statuses" value={filters.status} onChange={(v) => set({ status: v })} options={enumOptions(SHIPMENT_STATUSES)} />
        </FilterBar>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(s) => s.id}
            onRowClick={(s) => router.push(`/admin/orders/${s.orderId}`)}
            empty={<EmptyState icon={<Truck size={22} />} title={filtered ? "No shipments match these filters" : "No shipments yet"} />}
            columns={[
              {
                key: "awb",
                header: "AWB",
                cell: (s) => (
                  <div>
                    {s.awb ? <Mono className="text-xs text-ink">{s.awb}</Mono> : <span className="text-ink/40">Pending</span>}
                    {s.isReturn && (
                      <div className="mt-0.5">
                        <Badge tone="warning">Return pickup</Badge>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "courier",
                header: "Courier",
                cell: (s) => (
                  <div>
                    <p>{s.courierName ?? "—"}</p>
                    <p className="text-xs text-ink/50">{s.provider === "MOCK" ? "Mock provider" : s.provider === "MANUAL" ? "Manual" : s.provider}</p>
                  </div>
                ),
              },
              {
                key: "order",
                header: "Order",
                cell: (s) => (
                  <div>
                    <RowLink href={`/admin/orders/${s.orderId}`}>{s.order.orderNumber}</RowLink>
                    <p className="max-w-40 truncate text-xs text-ink/50">{s.order.customerName ?? "—"}</p>
                  </div>
                ),
              },
              { key: "warehouse", header: "From", cell: (s) => <span className="font-mono text-xs">{s.warehouse.code}</span> },
              { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
              {
                key: "eta",
                header: "ETA / delivered",
                cell: (s) => <span className="whitespace-nowrap text-ink/70">{s.deliveredAt ? `Delivered ${date(s.deliveredAt)}` : s.estimatedDeliveryAt ? date(s.estimatedDeliveryAt) : "—"}</span>,
              },
              { key: "created", header: "Created", cell: (s) => <span className="whitespace-nowrap text-ink/70">{dateTime(s.createdAt)}</span> },
              {
                key: "track",
                header: "",
                align: "right",
                cell: (s) =>
                  s.trackingUrl ? (
                    <a
                      href={s.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ink/60 hover:text-ink"
                      aria-label={`Track ${s.awb ?? "shipment"}`}
                    >
                      Track <ExternalLink size={12} />
                    </a>
                  ) : null,
              },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
