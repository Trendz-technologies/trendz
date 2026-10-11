"use client";

import { PageHeader, useListState } from "@/components/admin/page";
import { BulkGenerate, LabelPrinter } from "@/components/admin/catalog-codes-tools";
import { EmptyState, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";

type Tab = "generate" | "labels";

export default function CodesPage() {
  const { can } = useAuth();
  const canManage = can("codes.manage");
  const canPrint = can("products.read");
  const { filters, set } = useListState({ tab: "" });
  const tab: Tab = canManage && filters.tab !== "labels" ? "generate" : "labels";

  return (
    <>
      <PageHeader title="Codes & labels" description="Generate QR codes and barcodes in bulk, and print shelf or product labels." />
      {canManage && canPrint && (
        <div className="mb-6">
          <Tabs
            value={tab}
            onChange={(t) => set({ tab: t })}
            tabs={[
              { value: "generate", label: "Bulk generate" },
              { value: "labels", label: "Print labels" },
            ]}
          />
        </div>
      )}
      {tab === "generate" && canManage ? (
        <BulkGenerate />
      ) : canPrint ? (
        <LabelPrinter />
      ) : (
        <EmptyState title="You don't have access to codes" body="Ask an administrator for the products.read or codes.manage permission." />
      )}
    </>
  );
}
