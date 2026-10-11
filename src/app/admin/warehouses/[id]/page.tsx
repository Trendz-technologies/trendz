"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, History, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { ButtonLink, DetailList, qty, useWarehouses } from "@/components/admin/inventory-shared";
import type { WarehouseDetail, WarehouseLocation } from "@/components/admin/inventory-types";
import { LocationFormModal, WarehouseFormModal } from "@/components/admin/inventory-warehouse-form";
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Spinner, Stat, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { plainText } from "@/lib/rich-text";

export default function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "warehouse", id], queryFn: () => api.get<WarehouseDetail>(`/warehouses/${id}`) });
  const locations = useQuery({ queryKey: ["admin", "warehouse", id, "locations"], queryFn: () => api.get<WarehouseLocation[]>(`/warehouses/${id}/locations`) });
  const summary = useWarehouses().data?.find((w) => w.id === id);
  const [editing, setEditing] = useState(false);
  const [location, setLocation] = useState<WarehouseLocation | "new" | null>(null);
  const [deleting, setDeleting] = useState<WarehouseLocation | null>(null);

  const remove = useMutation({
    mutationFn: (loc: WarehouseLocation) => api.delete(`/warehouses/${id}/locations/${loc.id}`),
    onSuccess: (_d, loc) => {
      void qc.invalidateQueries({ queryKey: ["admin", "warehouse", id] });
      void qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      setDeleting(null);
      toast(`Location ${loc.code} deleted`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner />;
  const w = q.data;

  return (
    <>
      <PageHeader
        title={w.name}
        description={
          <>
            <span className="font-mono">{w.code}</span> · {w.city}, {w.state}
          </>
        }
        back={{ href: "/admin/warehouses", label: "Warehouses" }}
        actions={
          <>
            <StatusBadge status={w.status} />
            <ButtonLink href={`/admin/inventory?warehouseId=${w.id}`} variant="outline" icon={<Boxes size={15} />}>
              View stock
            </ButtonLink>
            <ButtonLink href={`/admin/inventory?tab=ledger&warehouseId=${w.id}`} variant="outline" icon={<History size={15} />}>
              Ledger
            </ButtonLink>
            <Can permission="warehouses.write">
              <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </Can>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Units on hand" value={summary ? qty(summary.onHand) : "—"} />
        <Stat label="Reserved for orders" value={summary ? qty(summary.reserved) : "—"} />
        <Stat label="Allocation priority" value={w.priority} hint={w.isOnlineFulfillment ? "Fulfils online orders" : "Not used for online orders"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          title="Bin locations"
          actions={
            <Can permission="warehouses.write">
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setLocation("new")}>
                Add location
              </Button>
            </Can>
          }
        >
          {locations.error ? (
            <ErrorState error={locations.error} retry={() => locations.refetch()} />
          ) : (
            <DataTable
              loading={locations.isLoading}
              rows={locations.data}
              rowKey={(l) => l.id}
              empty={<EmptyState icon={<MapPin size={22} />} title="No locations yet" body="Add aisles, racks or bins to record where stock sits in this warehouse." />}
              columns={[
                { key: "code", header: "Code", cell: (l) => <span className="font-mono text-sm font-medium">{l.code}</span> },
                { key: "name", header: "Name", cell: (l) => l.name ?? <span className="text-ink/35">—</span> },
                { key: "desc", header: "Description", cell: (l) => <span className="line-clamp-2 text-ink/60">{plainText(l.description) || "—"}</span> },
                { key: "status", header: "Status", cell: (l) => (l.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>) },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  cell: (l) => (
                    <Can permission="warehouses.write">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" aria-label={`Edit ${l.code}`} icon={<Pencil size={14} />} onClick={() => setLocation(l)} />
                        <Button variant="ghost" size="sm" aria-label={`Delete ${l.code}`} icon={<Trash2 size={14} />} onClick={() => setDeleting(l)} />
                      </div>
                    </Can>
                  ),
                },
              ]}
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Address">
            <address className="text-sm not-italic leading-relaxed text-ink/75">
              {w.addressLine1}
              {w.addressLine2 && (
                <>
                  <br />
                  {w.addressLine2}
                </>
              )}
              <br />
              {w.city}, {w.state} {w.postalCode}
              <br />
              <span className="text-ink/50">GST state code {w.stateCode}</span>
            </address>
          </Card>
          <Card title="Contact & tax">
            <DetailList
              items={[
                { label: "Contact", value: w.contactName ?? "—" },
                { label: "Phone", value: w.contactPhone ? <a href={`tel:${w.contactPhone}`} className="link">{w.contactPhone}</a> : "—" },
                { label: "Email", value: w.contactEmail ? <a href={`mailto:${w.contactEmail}`} className="link">{w.contactEmail}</a> : "—" },
                { label: "GSTIN", value: w.gstin ? <span className="font-mono text-xs">{w.gstin}</span> : "—" },
                { label: "Updated", value: dateTime(w.updatedAt) },
              ]}
            />
          </Card>
        </div>
      </div>

      {editing && <WarehouseFormModal warehouse={w} onClose={() => setEditing(false)} />}
      {location && <LocationFormModal warehouseId={w.id} location={location === "new" ? null : location} onClose={() => setLocation(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete location ${deleting?.code ?? ""}?`}
        body="Stock assigned to this bin stays in the warehouse but loses its bin assignment. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
