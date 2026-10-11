"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { ButtonLink } from "@/components/admin/inventory-shared";
import { PurchaseOrderForm } from "@/components/admin/inventory-po-form";
import type { PoDetail } from "@/components/admin/inventory-types";
import { Card, EmptyState, ErrorState, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";

export default function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery({ queryKey: ["admin", "purchase-orders", "detail", id], queryFn: () => api.get<PoDetail>(`/purchase-orders/${id}`) });

  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner />;
  const po = q.data;

  return (
    <>
      <PageHeader title={`Edit ${po.number}`} description="Only draft purchase orders can be edited." back={{ href: `/admin/purchase-orders/${po.id}`, label: po.number }} actions={<StatusBadge status={po.status} />} />
      <Can
        permission="purchases.write"
        fallback={
          <Card>
            <EmptyState icon={<Lock size={22} />} title="You can’t edit purchase orders" body="Ask an administrator for the purchases.write permission." />
          </Card>
        }
      >
        {po.status === "DRAFT" ? (
          // Keyed by updatedAt so a refetch after another save re-initialises the form.
          <PurchaseOrderForm key={po.updatedAt} po={po} />
        ) : (
          <Card>
            <EmptyState
              icon={<Lock size={22} />}
              title="This purchase order can no longer be edited"
              body="It has been submitted. Cancel it and raise a new one if the order needs to change."
              action={
                <ButtonLink href={`/admin/purchase-orders/${po.id}`} size="sm" variant="outline">
                  Back to {po.number}
                </ButtonLink>
              }
            />
          </Card>
        )}
      </Can>
    </>
  );
}
