"use client";

import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { PurchaseOrderForm } from "@/components/admin/inventory-po-form";
import { Card, EmptyState } from "@/components/ui";

export default function NewPurchaseOrderPage() {
  const params = useSearchParams();
  const supplierId = params.get("supplierId") ?? undefined;
  return (
    <>
      <PageHeader title="New purchase order" description="Saved as a draft; submit it for approval when it is ready." back={{ href: "/admin/purchase-orders", label: "Purchase orders" }} />
      <Can
        permission="purchases.write"
        fallback={
          <Card>
            <EmptyState icon={<Lock size={22} />} title="You can’t create purchase orders" body="Ask an administrator for the purchases.write permission." />
          </Card>
        }
      >
        <PurchaseOrderForm initialSupplierId={supplierId} />
      </Can>
    </>
  );
}
