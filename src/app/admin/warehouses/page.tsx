"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Warehouse as WarehouseIcon } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { qty, useWarehouses } from "@/components/admin/inventory-shared";
import type { Warehouse } from "@/components/admin/inventory-types";
import { WarehouseFormModal } from "@/components/admin/inventory-warehouse-form";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, StatusBadge } from "@/components/ui";

export default function WarehousesPage() {
  const router = useRouter();
  const q = useWarehouses();
  const [editing, setEditing] = useState<Warehouse | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Stores and fulfilment centres that hold stock. Online orders are allocated by priority."
        actions={
          <Can permission="warehouses.write">
            <Button icon={<Plus size={15} />} onClick={() => setEditing("new")}>
              New warehouse
            </Button>
          </Can>
        }
      />
      <Card>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data}
            rowKey={(w) => w.id}
            onRowClick={(w) => router.push(`/admin/warehouses/${w.id}`)}
            empty={
              <EmptyState
                icon={<WarehouseIcon size={22} />}
                title="No warehouses yet"
                body="Add at least one warehouse to start tracking stock."
                action={
                  <Can permission="warehouses.write">
                    <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing("new")}>
                      New warehouse
                    </Button>
                  </Can>
                }
              />
            }
            columns={[
              {
                key: "name",
                header: "Warehouse",
                cell: (w) => (
                  <div>
                    <p className="font-medium">{w.name}</p>
                    <p className="font-mono text-xs text-ink/50">{w.code}</p>
                  </div>
                ),
              },
              {
                key: "location",
                header: "Location",
                cell: (w) => (
                  <div className="text-sm">
                    <p>{w.city}</p>
                    <p className="text-xs text-ink/50">
                      {w.state} {w.postalCode}
                    </p>
                  </div>
                ),
              },
              {
                key: "contact",
                header: "Contact",
                cell: (w) =>
                  w.contactName || w.contactPhone ? (
                    <div className="text-sm">
                      <p>{w.contactName ?? "—"}</p>
                      {w.contactPhone && <p className="text-xs text-ink/50">{w.contactPhone}</p>}
                    </div>
                  ) : (
                    <span className="text-ink/35">—</span>
                  ),
              },
              { key: "gstin", header: "GSTIN", cell: (w) => (w.gstin ? <span className="font-mono text-xs">{w.gstin}</span> : <span className="text-ink/35">—</span>) },
              { key: "priority", header: "Priority", align: "right", cell: (w) => w.priority },
              { key: "online", header: "Online", cell: (w) => (w.isOnlineFulfillment ? <Badge tone="info">Fulfils online</Badge> : <Badge>Store only</Badge>) },
              { key: "bins", header: "Bins", align: "right", cell: (w) => w.locationCount },
              {
                key: "stock",
                header: "On hand",
                align: "right",
                cell: (w) => (
                  <div>
                    <p>{qty(w.onHand)}</p>
                    {w.reserved > 0 && <p className="text-xs text-ink/50">{qty(w.reserved)} reserved</p>}
                  </div>
                ),
              },
              { key: "status", header: "Status", cell: (w) => <StatusBadge status={w.status} /> },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (w) => (
                  <Can permission="warehouses.write">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${w.name}`}
                      icon={<Pencil size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(w);
                      }}
                    />
                  </Can>
                ),
              },
            ]}
          />
        )}
      </Card>
      {editing && <WarehouseFormModal warehouse={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(w) => editing === "new" && router.push(`/admin/warehouses/${w.id}`)} />}
    </>
  );
}
