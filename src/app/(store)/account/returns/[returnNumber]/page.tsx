"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareText, Wallet } from "lucide-react";
import { AccountHeader, DetailSkeleton, Panel, StaggerList, StaggerRow, StatusTrack, Thumb } from "@/components/store/account-ui";
import { StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

interface ReturnDetail {
  returnNumber: string;
  status: string;
  reason: string;
  customerNotes: string | null;
  adminNotes: string | null;
  requestedAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  order: { orderNumber: string };
  items: { id: string; quantity: number; condition: string | null; refundAmount: number; orderItem: { productName: string; variantTitle: string; imageUrl: string | null } }[];
  refunds: { id: string; refundNumber: string; amount: number; status: string; createdAt: string }[];
}

const STEPS = ["REQUESTED", "APPROVED", "RECEIVED", "REFUNDED"];

export default function ReturnDetailPage({ params }: { params: Promise<{ returnNumber: string }> }) {
  const { returnNumber } = use(params);
  const { t, tr, tx, ts, locale } = useI18n();
  const q = useQuery({ queryKey: ["return", returnNumber], queryFn: () => api.get<ReturnDetail>(`/account/returns/${encodeURIComponent(returnNumber)}`) });
  if (q.isLoading || !q.data) return <DetailSkeleton label={t("Loading your return")} />;
  const r = q.data;
  const step = STEPS.indexOf(r.status === "CLOSED" ? "REFUNDED" : r.status);

  return (
    <div className="space-y-6">
      <AccountHeader
        eyebrow={t("Return")}
        title={r.returnNumber}
        long
        back={{ href: "/account/returns", label: t("All returns") }}
        description={tr("For order {order} · requested {date}", {
          order: (
            <Link href={`/account/orders/${r.order.orderNumber}`} className="link">
              {r.order.orderNumber}
            </Link>
          ),
          date: dateTime(r.requestedAt, locale),
        })}
      >
        <div className="mt-4">
          <StatusBadge status={r.status} />
        </div>
      </AccountHeader>

      {r.status !== "REJECTED" && r.status !== "CANCELLED" && (
        <Panel eyebrow={t("Progress")} title={tx(r.reason)}>
          <StatusTrack steps={STEPS.map((s) => ts(s))} current={step} label={t("Return progress")} />
        </Panel>
      )}
      {r.adminNotes && (
        <Panel eyebrow={t("Message from our team")} delay={0.05}>
          <div className="flex gap-3">
            <MessageSquareText size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink/40" />
            <p className="text-sm leading-relaxed text-ink/70">{r.adminNotes}</p>
          </div>
        </Panel>
      )}
      <Panel title={t("Items")} padded={false} delay={0.1}>
        <StaggerList className="divide-y divide-black/5 pb-1">
          {r.items.map((i) => (
            <StaggerRow key={i.id} className="flex items-center gap-4 px-5 py-4 text-sm sm:px-7">
              <Thumb src={i.orderItem.imageUrl} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{i.orderItem.productName}</span>
                <span className="text-ink/50">
                  {i.orderItem.variantTitle} × {i.quantity}
                </span>
              </span>
              {i.condition && <StatusBadge status={i.condition} />}
            </StaggerRow>
          ))}
        </StaggerList>
      </Panel>
      {r.refunds.length > 0 && (
        <Panel eyebrow={t("Refund")} delay={0.15}>
          <ul className="space-y-3">
            {r.refunds.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/10 text-success">
                    <Wallet size={16} strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="font-semibold">{f.refundNumber}</span> · {money(f.amount)} <span className="text-ink/50">· {dateTime(f.createdAt, locale)}</span>
                  </span>
                </span>
                <StatusBadge status={f.status} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink/50">{t("Refunds to cards and UPI usually reach your account in 5–7 business days.")}</p>
        </Panel>
      )}
    </div>
  );
}
