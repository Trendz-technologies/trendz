"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { Can, PageHeader, useListState } from "@/components/admin/page";
import { ButtonLink, DetailList, qty } from "@/components/admin/inventory-shared";
import { SupplierFormModal } from "@/components/admin/inventory-supplier-form";
import type { PurchaseHistoryRow, Supplier } from "@/components/admin/inventory-types";
import { Button, Card, DataTable, EmptyState, ErrorState, Pagination, Spinner, Stat, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date, money } from "@/lib/format";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { page, setPage } = useListState({});
  const [editing, setEditing] = useState(false);
  const q = useQuery({ queryKey: ["admin", "suppliers", "detail", id], queryFn: () => api.get<Supplier>(`/suppliers/${id}`) });
  const history = useQuery({
    queryKey: ["admin", "suppliers", "history", id, page],
    queryFn: () => api.page<PurchaseHistoryRow[]>(`/suppliers/${id}/purchase-history`, { page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner />;
  const s = q.data;
  const meta = history.data?.meta;
  const totalPurchased = typeof meta?.totalPurchased === "number" ? meta.totalPurchased : null;
  const orderCount = typeof meta?.orderCount === "number" ? meta.orderCount : null;
  const address = [s.addressLine1, s.addressLine2, [s.city, s.state].filter(Boolean).join(", "), s.postalCode].filter(Boolean);

  return (
    <>
      <PageHeader
        title={s.name}
        description={
          <>
            <span className="font-mono">{s.code}</span>
            {s.companyName && s.companyName !== s.name ? ` · ${s.companyName}` : ""}
          </>
        }
        back={{ href: "/admin/suppliers", label: "Suppliers" }}
        actions={
          <>
            <StatusBadge status={s.status} />
            <Can permission="suppliers.write">
              <Button variant="outline" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </Can>
            {s.status === "ACTIVE" && (
              <Can permission="purchases.write">
                <ButtonLink href={`/admin/purchase-orders/new?supplierId=${s.id}`} icon={<Plus size={15} />}>
                  New purchase order
                </ButtonLink>
              </Can>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total purchased" value={totalPurchased == null ? "—" : money(totalPurchased)} hint="Excludes drafts and cancelled POs" />
        <Stat label="Purchase orders" value={orderCount == null ? "—" : orderCount} hint={meta ? `${meta.total} including drafts / cancelled` : undefined} />
        <Stat label="Payment terms" value={s.paymentTermsDays != null ? `Net ${s.paymentTermsDays} days` : "—"} hint={s.paymentTerms ?? undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          title="Purchase history"
          actions={
            meta && meta.total > 0 ? (
              <Link href={`/admin/purchase-orders?supplierId=${s.id}`} className="link text-xs">
                Open in purchase orders
              </Link>
            ) : undefined
          }
        >
          {history.error ? (
            <ErrorState error={history.error} retry={() => history.refetch()} />
          ) : (
            <DataTable
              loading={history.isLoading}
              rows={history.data?.data}
              rowKey={(o) => o.id}
              onRowClick={(o) => router.push(`/admin/purchase-orders/${o.id}`)}
              empty={<EmptyState icon={<ClipboardList size={22} />} title="No purchase orders yet" body="Purchase orders raised against this supplier will appear here." />}
              columns={[
                { key: "number", header: "PO", cell: (o) => <span className="font-medium">{o.number}</span> },
                { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
                { key: "date", header: "Ordered", cell: (o) => <span className="whitespace-nowrap">{date(o.orderDate)}</span> },
                { key: "eta", header: "Expected", cell: (o) => <span className="whitespace-nowrap">{date(o.expectedDeliveryDate)}</span> },
                { key: "ordered", header: "Ordered qty", align: "right", cell: (o) => qty(o.quantityOrdered) },
                { key: "received", header: "Received", align: "right", cell: (o) => qty(o.quantityReceived) },
                {
                  key: "pending",
                  header: "Pending",
                  align: "right",
                  cell: (o) => (o.quantityPending > 0 && o.status !== "CANCELLED" && o.status !== "CLOSED" ? <span className="font-semibold text-warning">{qty(o.quantityPending)}</span> : <span className="text-ink/35">{qty(o.quantityPending)}</span>),
                },
                { key: "total", header: "Total", align: "right", cell: (o) => money(o.grandTotal) },
              ]}
            />
          )}
          <Pagination meta={meta} onPage={setPage} />
        </Card>

        <div className="space-y-6">
          <Card title="Contact">
            <DetailList
              items={[
                { label: "Contact person", value: s.contactPerson ?? "—" },
                { label: "Phone", value: s.phone ? <a href={`tel:${s.phone}`} className="link">{s.phone}</a> : "—" },
                { label: "Email", value: s.email ? <a href={`mailto:${s.email}`} className="link">{s.email}</a> : "—" },
              ]}
            />
          </Card>
          <Card title="Tax & address">
            <DetailList
              items={[
                { label: "GSTIN", value: s.gstin ? <span className="font-mono text-xs">{s.gstin}</span> : "Unregistered" },
                { label: "GST state code", value: s.stateCode ?? "—" },
              ]}
            />
            <address className="mt-4 border-t border-black/5 pt-4 text-sm not-italic leading-relaxed text-ink/75">
              {address.length ? address.map((l, i) => <span key={i} className="block">{l}</span>) : <span className="text-ink/45">No address on file</span>}
            </address>
          </Card>
          {s.notes && (
            <Card title="Notes">
              <p className="whitespace-pre-wrap text-sm text-ink/70">{s.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {editing && <SupplierFormModal supplier={s} onClose={() => setEditing(false)} />}
    </>
  );
}
