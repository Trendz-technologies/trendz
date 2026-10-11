"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/page";
import { OrderActions } from "@/components/admin/sales-order-actions";
import { OrderItemsCard, OrderTimelineCard } from "@/components/admin/sales-order-items";
import { OrderPaymentsCard } from "@/components/admin/sales-order-payments";
import { OrderShipmentsCard } from "@/components/admin/sales-order-shipments";
import { OrderCustomerCard, OrderDocumentsCard } from "@/components/admin/sales-order-side";
import { ChannelBadge } from "@/components/admin/sales-shared";
import type { StaffOrder } from "@/components/admin/sales-types";
import { ErrorState, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, moneyExact } from "@/lib/format";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery({ queryKey: ["admin", "order", id], queryFn: () => api.get<StaffOrder>(`/orders/${id}`) });

  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner label="Loading order" />;
  const o = q.data;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={o.orderNumber}
        description={
          <>
            Placed {dateTime(o.placedAt)} · {moneyExact(o.grandTotal)}
          </>
        }
        actions={<OrderActions order={o} onRefresh={() => void q.refetch()} refreshing={q.isFetching} />}
      />
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2 text-xs text-ink/50">
        <ChannelBadge channel={o.channel} />
        <span className="ml-1">Order</span> <StatusBadge status={o.status} />
        <span className="ml-1">Payment</span> <StatusBadge status={o.paymentStatus} />
        {o.channel === "ONLINE" && (
          <>
            <span className="ml-1">Shipping</span> <StatusBadge status={o.shippingStatus} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <OrderItemsCard order={o} />
          <OrderPaymentsCard order={o} />
          {o.channel === "ONLINE" && <OrderShipmentsCard order={o} />}
        </div>
        <div className="min-w-0 space-y-6">
          <OrderCustomerCard order={o} />
          <OrderDocumentsCard order={o} />
          <OrderTimelineCard order={o} />
        </div>
      </div>
    </>
  );
}
