"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { Card, DataTable, EmptyState, ErrorState, Pagination, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date, money } from "@/lib/format";

interface CustomerRow {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  profile: { firstName: string | null; lastName: string | null } | null;
  orders: number;
  spent: number;
  lastOrderAt: string | null;
}

export default function CustomersPage() {
  const router = useRouter();
  const { page, filters, set, setPage } = useListState({ q: "" });
  const q = useQuery({ queryKey: ["admin", "customers", page, filters], queryFn: () => api.page<CustomerRow[]>("/customers", { page, limit: 25, q: filters.q }) });

  return (
    <>
      <PageHeader title="Customers" description="Registered storefront customers and their lifetime value." />
      <Card>
        <div className="mb-4">
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Name, email or phone" />
        </div>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(c) => c.id}
            onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
            empty={<EmptyState title="No customers found" />}
            columns={[
              {
                key: "name",
                header: "Customer",
                cell: (c) => (
                  <div>
                    <p className="font-medium">{[c.profile?.firstName, c.profile?.lastName].filter(Boolean).join(" ") || "—"}</p>
                    <p className="text-xs text-ink/50">{c.email ?? c.phone}</p>
                  </div>
                ),
              },
              { key: "phone", header: "Phone", cell: (c) => c.phone ?? "—" },
              { key: "orders", header: "Orders", align: "right", cell: (c) => c.orders },
              { key: "spent", header: "Net spent", align: "right", cell: (c) => money(c.spent) },
              { key: "last", header: "Last order", cell: (c) => date(c.lastOrderAt) },
              { key: "joined", header: "Joined", cell: (c) => date(c.createdAt) },
              { key: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
