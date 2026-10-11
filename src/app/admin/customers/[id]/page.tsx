"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/page";
import { Card, DataTable, ErrorState, Spinner, Stat, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date, dateTime, money } from "@/lib/format";
import type { Address } from "@/lib/types";

interface CustomerDetail {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  profile: { firstName: string | null; lastName: string | null; marketingOptIn: boolean } | null;
  addresses: Address[];
  orders: { id: string; orderNumber: string; status: string; paymentStatus: string; grandTotal: number; placedAt: string; channel: string }[];
  returnRequests: { id: string; returnNumber: string; status: string; createdAt: string }[];
  stats: { orders: number; spent: number };
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery({ queryKey: ["admin", "customer", id], queryFn: () => api.get<CustomerDetail>(`/customers/${id}`) });
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner />;
  const c = q.data;
  const name = [c.profile?.firstName, c.profile?.lastName].filter(Boolean).join(" ") || c.email || c.phone || "Customer";

  return (
    <>
      <PageHeader title={name} description={`Customer since ${date(c.createdAt)}`} back={{ href: "/admin/customers", label: "Customers" }} actions={<StatusBadge status={c.status} />} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Paid orders" value={c.stats.orders} />
        <Stat label="Net spent" value={money(c.stats.spent)} />
        <Stat label="Last sign-in" value={c.lastLoginAt ? dateTime(c.lastLoginAt) : "—"} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="Orders">
          <DataTable
            rows={c.orders}
            rowKey={(o) => o.id}
            columns={[
              { key: "n", header: "Order", cell: (o) => <Link href={`/admin/orders/${o.id}`} className="link">{o.orderNumber}</Link> },
              { key: "d", header: "Placed", cell: (o) => date(o.placedAt) },
              { key: "c", header: "Channel", cell: (o) => o.channel },
              { key: "s", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
              { key: "p", header: "Payment", cell: (o) => <StatusBadge status={o.paymentStatus} /> },
              { key: "t", header: "Total", align: "right", cell: (o) => money(o.grandTotal) },
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Card title="Contact">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink/50">Email</dt>
                <dd className="truncate">{c.email ?? "—"} {c.email && (c.emailVerifiedAt ? "✓" : "(unverified)")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink/50">Phone</dt>
                <dd>{c.phone ?? "—"} {c.phone && (c.phoneVerifiedAt ? "✓" : "(unverified)")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink/50">Marketing</dt>
                <dd>{c.profile?.marketingOptIn ? "Opted in" : "No"}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Addresses">
            <ul className="space-y-3 text-sm">
              {c.addresses.map((a) => (
                <li key={a.id}>
                  <p className="font-medium">{a.fullName}</p>
                  <p className="text-ink/60">
                    {a.line1}, {a.city}, {a.state} {a.postalCode} · {a.phone}
                  </p>
                </li>
              ))}
              {!c.addresses.length && <li className="text-ink/50">No saved addresses</li>}
            </ul>
          </Card>
          {c.returnRequests.length > 0 && (
            <Card title="Returns">
              <ul className="space-y-2 text-sm">
                {c.returnRequests.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <Link href={`/admin/returns/${r.id}`} className="link">
                      {r.returnNumber}
                    </Link>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
