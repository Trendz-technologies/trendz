"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Truck } from "lucide-react";
import { Can, PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { SupplierFormModal } from "@/components/admin/inventory-supplier-form";
import type { SupplierRow } from "@/components/admin/inventory-types";
import { Button, Card, DataTable, EmptyState, ErrorState, Pagination, Select, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";

export default function SuppliersPage() {
  const router = useRouter();
  const { page, filters, set, setPage } = useListState({ q: "", status: "" });
  const status = filters.status === "ACTIVE" || filters.status === "INACTIVE" ? filters.status : "";
  const [editing, setEditing] = useState<SupplierRow | "new" | null>(null);

  const q = useQuery({
    queryKey: ["admin", "suppliers", "list", page, filters.q, status],
    queryFn: () => api.page<SupplierRow[]>("/suppliers", { page, limit: 25, q: filters.q || undefined, status: status || undefined }),
    placeholderData: keepPreviousData,
  });
  const filtered = !!(filters.q || status);

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Vendors you buy stock from, with GST details and payment terms."
        actions={
          <Can permission="suppliers.write">
            <Button icon={<Plus size={15} />} onClick={() => setEditing("new")}>
              New supplier
            </Button>
          </Can>
        }
      />
      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Name, code, company or GSTIN" />
          <Select aria-label="Status" className="sm:w-44" value={status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(s) => s.id}
            onRowClick={(s) => router.push(`/admin/suppliers/${s.id}`)}
            empty={
              <EmptyState
                icon={<Truck size={22} />}
                title={filtered ? "No suppliers match these filters" : "No suppliers yet"}
                action={
                  !filtered && (
                    <Can permission="suppliers.write">
                      <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing("new")}>
                        New supplier
                      </Button>
                    </Can>
                  )
                }
              />
            }
            columns={[
              {
                key: "name",
                header: "Supplier",
                cell: (s) => (
                  <div className="min-w-0 max-w-64">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="truncate text-xs text-ink/50">
                      <span className="font-mono">{s.code}</span>
                      {s.companyName && s.companyName !== s.name ? ` · ${s.companyName}` : ""}
                    </p>
                  </div>
                ),
              },
              {
                key: "contact",
                header: "Contact",
                cell: (s) =>
                  s.contactPerson || s.phone || s.email ? (
                    <div className="min-w-0 max-w-56 text-sm">
                      <p className="truncate">{s.contactPerson ?? s.phone ?? s.email}</p>
                      {s.contactPerson && (s.phone || s.email) && <p className="truncate text-xs text-ink/50">{s.phone ?? s.email}</p>}
                    </div>
                  ) : (
                    <span className="text-ink/35">—</span>
                  ),
              },
              { key: "gstin", header: "GSTIN", cell: (s) => (s.gstin ? <span className="font-mono text-xs">{s.gstin}</span> : <span className="text-ink/35">—</span>) },
              { key: "city", header: "Location", cell: (s) => [s.city, s.state].filter(Boolean).join(", ") || <span className="text-ink/35">—</span> },
              { key: "terms", header: "Terms", cell: (s) => (s.paymentTermsDays != null ? `Net ${s.paymentTermsDays}` : (s.paymentTerms ?? <span className="text-ink/35">—</span>)) },
              { key: "pos", header: "POs", align: "right", cell: (s) => s.purchaseOrderCount },
              { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (s) => (
                  <Can permission="suppliers.write">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${s.name}`}
                      icon={<Pencil size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(s);
                      }}
                    />
                  </Can>
                ),
              },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
      {editing && (
        <SupplierFormModal
          supplier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(s) => editing === "new" && router.push(`/admin/suppliers/${s.id}`)}
        />
      )}
    </>
  );
}
