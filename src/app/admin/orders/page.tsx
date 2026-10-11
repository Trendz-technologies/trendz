"use client";

import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { ChannelBadge, DateRange, dayEndIso, dayStartIso, enumOptions, FilterBar, FilterSelect, RowLink } from "@/components/admin/sales-shared";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/components/admin/sales-types";
import { Card, DataTable, EmptyState, ErrorState, Pagination, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, money, pluralize } from "@/lib/format";
import type { OrderListItem } from "@/lib/types";

const DEFAULTS = { q: "", status: "", paymentStatus: "", channel: "", from: "", to: "" };

export default function OrdersPage() {
  const router = useRouter();
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const q = useQuery({
    queryKey: ["admin", "orders", page, filters],
    queryFn: () =>
      api.page<OrderListItem[]>("/orders", {
        page,
        limit: 25,
        q: filters.q,
        status: filters.status,
        paymentStatus: filters.paymentStatus,
        channel: filters.channel,
        from: dayStartIso(filters.from),
        to: dayEndIso(filters.to),
      }),
    placeholderData: keepPreviousData,
  });
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader title="Orders" description="Online and in-store orders. Open an order to fulfil, ship, refund or cancel it." />
      <Card>
        <FilterBar active={filtered} onClear={() => set(DEFAULTS)}>
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Order no., customer, email or phone" />
          <FilterSelect label="Order status" allLabel="All statuses" value={filters.status} onChange={(v) => set({ status: v })} options={enumOptions(ORDER_STATUSES)} />
          <FilterSelect label="Payment status" allLabel="All payments" value={filters.paymentStatus} onChange={(v) => set({ paymentStatus: v })} options={enumOptions(PAYMENT_STATUSES)} />
          <FilterSelect
            label="Channel"
            allLabel="All channels"
            value={filters.channel}
            onChange={(v) => set({ channel: v })}
            options={[
              { value: "ONLINE", label: "Online" },
              { value: "POS", label: "In-store (POS)" },
            ]}
          />
          <DateRange from={filters.from} to={filters.to} onChange={(v) => set(v)} />
        </FilterBar>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(o) => o.id}
            onRowClick={(o) => router.push(`/admin/orders/${o.id}`)}
            empty={<EmptyState icon={<ShoppingCart size={22} />} title={filtered ? "No orders match these filters" : "No orders yet"} body={filtered ? "Try a different search or clear the filters." : undefined} />}
            columns={[
              {
                key: "order",
                header: "Order",
                cell: (o) => (
                  <div className="flex items-center gap-3">
                    {o.items[0]?.imageUrl ? <img src={o.items[0].imageUrl} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-lg bg-offwhite object-cover" /> : <span className="h-9 w-9 shrink-0 rounded-lg bg-offwhite" />}
                    <div className="min-w-0">
                      <RowLink href={`/admin/orders/${o.id}`}>{o.orderNumber}</RowLink>
                      <p className="max-w-48 truncate text-xs text-ink/50">
                        {o.items[0]?.productName ?? "—"}
                        {o._count.items > 1 && ` + ${o._count.items - 1} more`}
                      </p>
                    </div>
                  </div>
                ),
              },
              { key: "placed", header: "Placed", cell: (o) => <span className="whitespace-nowrap text-ink/70">{dateTime(o.placedAt)}</span> },
              {
                key: "customer",
                header: "Customer",
                cell: (o) => (
                  <div className="min-w-0">
                    <p className="max-w-44 truncate">{o.customerName ?? (o.channel === "POS" ? "Walk-in" : "—")}</p>
                    <p className="max-w-44 truncate text-xs text-ink/50">{o.customerEmail ?? o.customerPhone ?? ""}</p>
                  </div>
                ),
              },
              { key: "channel", header: "Channel", cell: (o) => <ChannelBadge channel={o.channel} /> },
              { key: "items", header: "Items", align: "right", cell: (o) => pluralize(o._count.items, "line") },
              { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
              { key: "payment", header: "Payment", cell: (o) => <StatusBadge status={o.paymentStatus} /> },
              { key: "total", header: "Total", align: "right", cell: (o) => <span className="font-semibold">{money(o.grandTotal)}</span> },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
