"use client";

import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, RefreshCw } from "lucide-react";
import { Can, PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { ChannelBadge, DateRange, dayEndIso, dayStartIso, enumOptions, FilterBar, FilterSelect, Mono, providerLabel, RowLink, useInvalidateSales } from "@/components/admin/sales-shared";
import { PAYMENT_PROVIDERS, PAYMENT_STATUSES, type StaffPayment } from "@/components/admin/sales-types";
import { Button, Card, DataTable, EmptyState, ErrorState, Pagination, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { dateTime, moneyExact } from "@/lib/format";

type PaymentRow = StaffPayment & { order: { id: string; orderNumber: string; customerName: string | null; channel: "ONLINE" | "POS" } };

const DEFAULTS = { q: "", status: "", provider: "", from: "", to: "" };
const RECONCILABLE = new Set(["CREATED", "PENDING", "FAILED"]);

export default function PaymentsPage() {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const q = useQuery({
    queryKey: ["admin", "payments", page, filters],
    queryFn: () =>
      api.page<PaymentRow[]>("/payments", { page, limit: 25, q: filters.q, status: filters.status, provider: filters.provider, from: dayStartIso(filters.from), to: dayEndIso(filters.to) }),
    placeholderData: keepPreviousData,
  });
  const filtered = Object.values(filters).some(Boolean);

  const reconcile = useMutation({
    mutationFn: (p: PaymentRow) => api.post<{ result: "paid" | "unpaid" }>(`/payments/${p.id}/reconcile`),
    onSuccess: (r, p) => {
      toast(r.result === "paid" ? `${p.order.orderNumber}: payment captured — order marked as paid` : `${p.order.orderNumber}: no captured payment at the gateway yet`, r.result === "paid" ? "success" : "info");
      void invalidate(p.orderId);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <>
      <PageHeader title="Payments" description="Every payment attempt — gateway and counter. Reconcile asks Razorpay whether an open payment was actually captured." />
      <Card>
        <FilterBar active={filtered} onClear={() => set(DEFAULTS)}>
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Order no., gateway id or reference" />
          <FilterSelect label="Payment status" allLabel="All statuses" value={filters.status} onChange={(v) => set({ status: v })} options={enumOptions(PAYMENT_STATUSES)} />
          <FilterSelect label="Provider" allLabel="All providers" value={filters.provider} onChange={(v) => set({ provider: v })} options={enumOptions(PAYMENT_PROVIDERS, providerLabel)} />
          <DateRange from={filters.from} to={filters.to} onChange={(v) => set(v)} />
        </FilterBar>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/admin/orders/${p.orderId}`)}
            empty={<EmptyState icon={<CreditCard size={22} />} title={filtered ? "No payments match these filters" : "No payments yet"} />}
            columns={[
              { key: "created", header: "Created", cell: (p) => <span className="whitespace-nowrap text-ink/70">{dateTime(p.createdAt)}</span> },
              {
                key: "order",
                header: "Order",
                cell: (p) => (
                  <div>
                    <RowLink href={`/admin/orders/${p.orderId}`}>{p.order.orderNumber}</RowLink>
                    <p className="flex items-center gap-1.5 text-xs text-ink/50">
                      <span className="max-w-36 truncate">{p.order.customerName ?? "—"}</span>
                      <ChannelBadge channel={p.order.channel} />
                    </p>
                  </div>
                ),
              },
              {
                key: "provider",
                header: "Provider",
                cell: (p) => (
                  <div>
                    <p>{providerLabel(p.provider)}</p>
                    <p className="text-xs text-ink/50">{p.method ?? "—"}</p>
                  </div>
                ),
              },
              {
                key: "ids",
                header: "Gateway / reference",
                cell: (p) => (
                  <div className="max-w-52 space-y-0.5">
                    {p.razorpayPaymentId && <Mono className="block">{p.razorpayPaymentId}</Mono>}
                    {p.razorpayOrderId && <Mono className="block">{p.razorpayOrderId}</Mono>}
                    {p.referenceNumber && <Mono className="block">Ref {p.referenceNumber}</Mono>}
                    {p.failureReason && <p className="truncate text-[11px] text-danger" title={p.failureReason}>{p.failureReason}</p>}
                    {!p.razorpayPaymentId && !p.razorpayOrderId && !p.referenceNumber && !p.failureReason && <span className="text-ink/30">—</span>}
                  </div>
                ),
              },
              { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
              { key: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-semibold">{moneyExact(p.amount)}</span> },
              { key: "refunded", header: "Refunded", align: "right", cell: (p) => (p.amountRefunded ? <span className="text-danger">{moneyExact(p.amountRefunded)}</span> : <span className="text-ink/30">—</span>) },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (p) =>
                  p.provider === "RAZORPAY" && RECONCILABLE.has(p.status) && p.razorpayOrderId ? (
                    <Can permission="payments.manage">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<RefreshCw size={13} />}
                        loading={reconcile.isPending && reconcile.variables?.id === p.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          reconcile.mutate(p);
                        }}
                      >
                        Reconcile
                      </Button>
                    </Can>
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
