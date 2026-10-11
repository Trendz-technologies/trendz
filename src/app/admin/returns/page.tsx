"use client";

import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { Can, PageHeader, useListState } from "@/components/admin/page";
import { ReturnDesk } from "@/components/admin/sales-return-desk";
import { enumOptions, FilterBar, FilterSelect, RowLink } from "@/components/admin/sales-shared";
import { RETURN_STATUSES, type ReturnCondition, type ReturnStatus } from "@/components/admin/sales-types";
import { Card, DataTable, EmptyState, ErrorState, Pagination, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";

interface ReturnRow {
  id: string;
  returnNumber: string;
  orderId: string;
  status: ReturnStatus;
  reason: string;
  createdAt: string;
  order: { orderNumber: string; customerName: string | null };
  items: { quantity: number; condition: ReturnCondition | null }[];
}

const DEFAULTS = { status: "" };

export default function ReturnsPage() {
  const router = useRouter();
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const q = useQuery({
    queryKey: ["admin", "returns", page, filters],
    queryFn: () => api.page<ReturnRow[]>("/returns", { page, limit: 25, status: filters.status }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Returns" description="Customer return requests and counter returns. Approve, inspect on arrival, then refund." />
      <div className="space-y-6">
        <Can permission="returns.manage">
          <ReturnDesk />
        </Can>
        <Card title="Return requests">
          <FilterBar active={!!filters.status} onClear={() => set(DEFAULTS)}>
            <FilterSelect label="Return status" allLabel="All statuses" value={filters.status} onChange={(v) => set({ status: v })} options={enumOptions(RETURN_STATUSES)} />
          </FilterBar>
          {q.error ? (
            <ErrorState error={q.error} retry={() => q.refetch()} />
          ) : (
            <DataTable
              loading={q.isLoading}
              rows={q.data?.data}
              rowKey={(r) => r.id}
              onRowClick={(r) => router.push(`/admin/returns/${r.id}`)}
              empty={<EmptyState icon={<RotateCcw size={22} />} title={filters.status ? "No returns with this status" : "No returns yet"} />}
              columns={[
                { key: "number", header: "Return", cell: (r) => <RowLink href={`/admin/returns/${r.id}`}>{r.returnNumber}</RowLink> },
                {
                  key: "order",
                  header: "Order",
                  cell: (r) => (
                    <div>
                      <RowLink href={`/admin/orders/${r.orderId}`} className="font-normal">
                        {r.order.orderNumber}
                      </RowLink>
                      <p className="max-w-40 truncate text-xs text-ink/50">{r.order.customerName ?? "—"}</p>
                    </div>
                  ),
                },
                {
                  key: "reason",
                  header: "Reason",
                  cell: (r) => (
                    <p className="max-w-64 truncate text-ink/70" title={r.reason}>
                      {r.reason}
                    </p>
                  ),
                },
                {
                  key: "units",
                  header: "Units",
                  align: "right",
                  cell: (r) => {
                    const units = r.items.reduce((s, i) => s + i.quantity, 0);
                    const damaged = r.items.filter((i) => i.condition && i.condition !== "GOOD").reduce((s, i) => s + i.quantity, 0);
                    return (
                      <div>
                        <p>{units}</p>
                        {damaged > 0 && <p className="text-[11px] text-danger">{damaged} damaged</p>}
                      </div>
                    );
                  },
                },
                { key: "created", header: "Requested", cell: (r) => <span className="whitespace-nowrap text-ink/70">{dateTime(r.createdAt)}</span> },
                { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              ]}
            />
          )}
          <Pagination meta={q.data?.meta} onPage={setPage} />
        </Card>
      </div>
    </>
  );
}
