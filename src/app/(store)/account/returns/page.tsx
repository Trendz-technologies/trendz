"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { AccountHeader, EmptyPanel, Panel, RowArrow, RowsSkeleton, StaggerList, StaggerRow } from "@/components/store/account-ui";
import { CtaLink } from "@/components/store/checkout-ui";
import { Pagination, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

interface ReturnRow {
  id: string;
  returnNumber: string;
  status: string;
  reason: string;
  createdAt: string;
  order: { orderNumber: string };
  items: { quantity: number }[];
}

export default function MyReturnsPage() {
  const { t, tn, tx, locale } = useI18n();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["my-returns", page], queryFn: () => api.page<ReturnRow[]>("/account/returns", { page, limit: 10 }) });
  return (
    <div className="space-y-8">
      <AccountHeader eyebrow={t("Returns")} title={t("Returns & refunds")} description={t("To start a return, open a delivered order and choose “Return items”.")} />
      {!q.isLoading && !q.data?.data.length ? (
        <EmptyPanel
          icon={<RotateCcw size={28} strokeWidth={1.5} />}
          title={t("No returns")}
          body={t("Returns you request will appear here with their refund status.")}
          action={
            <CtaLink href="/account/orders" tone="light">
              {t("View your orders")}
            </CtaLink>
          }
        />
      ) : (
        <Panel padded={false}>
          {q.isLoading ? (
            <RowsSkeleton thumb={false} label={t("Loading your returns")} />
          ) : (
            <StaggerList key={page} className="divide-y divide-black/5 py-1">
              {q.data?.data.map((r) => (
                <StaggerRow key={r.id}>
                  <Link
                    href={`/account/returns/${r.returnNumber}`}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-offwhite/70 focus-visible:bg-offwhite focus-visible:outline-none sm:px-7"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-offwhite transition-colors duration-500 group-hover:bg-ink group-hover:text-white">
                      <RotateCcw size={17} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.returnNumber}</p>
                      <p className="truncate text-xs text-ink/55">
                        {t("Order {number}", { number: r.order.orderNumber })} · {date(r.createdAt, locale)} · {tn(r.items.reduce((s, i) => s + i.quantity, 0), "{n} item", "{n} items")} · {tx(r.reason)}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                    <RowArrow className="hidden sm:grid" />
                  </Link>
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
