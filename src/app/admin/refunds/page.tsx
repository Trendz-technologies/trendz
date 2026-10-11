"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { RotateCcw, Undo2 } from "lucide-react";
import { Can, PageHeader, useListState } from "@/components/admin/page";
import { enumOptions, FilterBar, FilterSelect, Mono, providerLabel, RowLink, useInvalidateSales } from "@/components/admin/sales-shared";
import { REFUND_STATUSES, type StaffRefund } from "@/components/admin/sales-types";
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Pagination, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { dateTime, moneyExact } from "@/lib/format";

type RefundRow = StaffRefund & {
  order: { id: string; orderNumber: string; customerName: string | null };
  payment: { provider: string; method: string | null };
};

const DEFAULTS = { status: "" };

export default function RefundsPage() {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const [retrying, setRetrying] = useState<RefundRow | null>(null);
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const q = useQuery({
    queryKey: ["admin", "refunds", page, filters],
    queryFn: () => api.page<RefundRow[]>("/refunds", { page, limit: 25, status: filters.status }),
    placeholderData: keepPreviousData,
  });

  const retry = useMutation({
    mutationFn: (r: RefundRow) => api.post<StaffRefund>(`/refunds/${r.id}/retry`),
    onSuccess: (r) => {
      setRetrying(null);
      toast(r.status === "FAILED" ? `Refund ${r.refundNumber} failed again${r.failureReason ? `: ${r.failureReason}` : ""}` : `Refund ${r.refundNumber} sent to the gateway`, r.status === "FAILED" ? "error" : "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
    onSettled: (_d, _e, r) => void invalidate(r.orderId),
  });

  return (
    <>
      <PageHeader title="Refunds" description="Refunds from cancellations, returns and manual adjustments. Failed gateway refunds can be retried." />
      <Card>
        <FilterBar active={!!filters.status} onClear={() => set(DEFAULTS)}>
          <FilterSelect label="Refund status" allLabel="All statuses" value={filters.status} onChange={(v) => set({ status: v })} options={enumOptions(REFUND_STATUSES)} />
        </FilterBar>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/admin/orders/${r.orderId}`)}
            empty={<EmptyState icon={<Undo2 size={22} />} title={filters.status ? "No refunds with this status" : "No refunds yet"} />}
            columns={[
              {
                key: "number",
                header: "Refund",
                cell: (r) => (
                  <div>
                    <p className="flex items-center gap-2 font-medium">
                      {r.refundNumber}
                      {r.returnRequestId && <Badge>Return</Badge>}
                    </p>
                    {r.razorpayRefundId && <Mono>{r.razorpayRefundId}</Mono>}
                  </div>
                ),
              },
              {
                key: "order",
                header: "Order",
                cell: (r) => (
                  <div>
                    <RowLink href={`/admin/orders/${r.orderId}`}>{r.order.orderNumber}</RowLink>
                    <p className="max-w-40 truncate text-xs text-ink/50">{r.order.customerName ?? "—"}</p>
                  </div>
                ),
              },
              {
                key: "via",
                header: "Via",
                cell: (r) => (
                  <div>
                    <p>{providerLabel(r.payment.provider)}</p>
                    <p className="text-xs text-ink/50">{r.payment.method ?? "—"}</p>
                  </div>
                ),
              },
              {
                key: "reason",
                header: "Reason",
                cell: (r) => (
                  <div className="max-w-64">
                    <p className="truncate text-ink/75" title={r.reason ?? undefined}>
                      {r.reason ?? "—"}
                    </p>
                    {r.failureReason && (
                      <p className="truncate text-xs text-danger" title={r.failureReason}>
                        {r.failureReason}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: "dates",
                header: "Created",
                cell: (r) => (
                  <div className="whitespace-nowrap">
                    <p className="text-ink/70">{dateTime(r.createdAt)}</p>
                    {r.processedAt && <p className="text-xs text-ink/45">processed {dateTime(r.processedAt)}</p>}
                  </div>
                ),
              },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="font-semibold">{moneyExact(r.amount)}</span> },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (r) =>
                  r.status === "FAILED" ? (
                    <Can permission="refunds.create">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<RotateCcw size={13} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRetrying(r);
                        }}
                      >
                        Retry
                      </Button>
                    </Can>
                  ) : null,
              },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
      <ConfirmDialog
        open={!!retrying}
        title={`Retry refund ${retrying?.refundNumber ?? ""}?`}
        body={retrying && <>The payment gateway will be asked again to refund {moneyExact(retrying.amount)} on order {retrying.order.orderNumber}.</>}
        confirmLabel="Retry refund"
        loading={retry.isPending}
        onConfirm={() => retrying && retry.mutate(retrying)}
        onClose={() => setRetrying(null)}
      />
    </>
  );
}
