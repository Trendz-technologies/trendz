"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { AccountHeader, EmptyPanel, OrderRow, Panel, RowsSkeleton, StaggerList, StaggerRow } from "@/components/store/account-ui";
import { CtaLink } from "@/components/store/checkout-ui";
import { ErrorState, Pagination } from "@/components/ui";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { OrderListItem } from "@/lib/types";

export default function MyOrdersPage() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["my-orders", page], queryFn: () => api.page<OrderListItem[]>("/account/orders", { page, limit: 10 }) });
  const empty = !q.isLoading && !q.error && !q.data?.data.length;

  return (
    <div className="space-y-8">
      <AccountHeader eyebrow={t("Orders")} title={t("Your orders")} description={t("Every order you've placed, newest first. Open one to track it, pay, return or download the invoice.")} />
      {empty ? (
        <EmptyPanel icon={<Package size={28} strokeWidth={1.5} />} title={t("No orders yet")} body={t("Your first order will show up here.")} action={<CtaLink href="/products">{t("Start shopping")}</CtaLink>} />
      ) : (
        <Panel padded={false}>
          {q.isLoading ? (
            <RowsSkeleton rows={4} label={t("Loading your orders")} />
          ) : q.error ? (
            <ErrorState error={q.error} retry={() => q.refetch()} />
          ) : (
            <StaggerList key={page} className="divide-y divide-black/5 py-1">
              {q.data?.data.map((o) => (
                <StaggerRow key={o.id}>
                  <OrderRow
                    order={o}
                    meta={
                      <>
                        {date(o.placedAt, locale)} · {o._count.items > 1 ? t("{name} + {n} more", { name: o.items[0]?.productName ?? "", n: o._count.items - 1 }) : o.items[0]?.productName}
                      </>
                    }
                  />
                </StaggerRow>
              ))}
            </StaggerList>
          )}
        </Panel>
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </div>
  );
}
