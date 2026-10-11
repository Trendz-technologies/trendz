"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Printer } from "lucide-react";
import { Button, EmptyState, ErrorState, Modal, Pagination, Spinner, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";
import { openReceipt } from "./payment";
import type { CheckoutResult, RecentSale } from "./types";

/** Last 24 hours of counter sales at this location (own sales unless the user can read all orders). */
export function RecentSalesDialog({ warehouseId, onCollect, onClose }: { warehouseId: string; onCollect: (sale: CheckoutResult) => void; onClose: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["pos", "recent", warehouseId, page],
    queryFn: () => api.page<RecentSale[]>("/pos/orders", { warehouseId, page, limit: 10 }),
    refetchInterval: 30_000,
  });
  const salesTotal = typeof q.data?.meta.salesTotal === "number" ? q.data.meta.salesTotal : null;

  return (
    <Modal open onClose={onClose} size="lg" title="Recent sales (last 24 hours)">
      {q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data ? (
        <Spinner />
      ) : !q.data.data.length ? (
        <EmptyState title="No sales yet today" />
      ) : (
        <>
          {salesTotal != null && (
            <p className="mb-3 text-sm text-ink/60">
              Paid sales: <strong className="text-ink">{money(salesTotal)}</strong> across {q.data.meta.total} {q.data.meta.total === 1 ? "bill" : "bills"}
            </p>
          )}
          <ul className="divide-y divide-black/5">
            {q.data.data.map((s) => {
              const pending = s.paymentStatus === "PENDING" && s.status === "PENDING";
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-40 flex-1">
                    {can("orders.read") ? (
                      <Link href={`/admin/orders/${s.id}`} className="link font-semibold" target="_blank">
                        {s.orderNumber}
                      </Link>
                    ) : (
                      <p className="font-semibold">{s.orderNumber}</p>
                    )}
                    <p className="text-xs text-ink/50">
                      {dateTime(s.placedAt)} · {s.customerName ?? "Walk-in"} · {s.payments.map((p) => p.provider).join(", ") || "—"}
                    </p>
                  </div>
                  <StatusBadge status={s.paymentStatus} />
                  <p className="w-24 text-right font-semibold tabular-nums">{money(s.grandTotal)}</p>
                  {pending ? (
                    <Button
                      size="sm"
                      icon={<CreditCard size={14} />}
                      onClick={() => onCollect({ order: { id: s.id, orderNumber: s.orderNumber, grandTotal: s.grandTotal, paymentStatus: "PENDING" }, requiresGatewayPayment: true, change: null, nextCartId: "" })}
                    >
                      Collect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Print receipt for ${s.orderNumber}`}
                      icon={<Printer size={14} />}
                      onClick={() => openReceipt(s.id).catch((e) => toast(errorMessage(e), "error"))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination meta={q.data.meta} onPage={setPage} />
        </>
      )}
    </Modal>
  );
}
