"use client";

import { useState } from "react";
import { ArrowLeftRight, SlidersHorizontal } from "lucide-react";
import { Can, PageHeader, useListState } from "@/components/admin/page";
import { AdjustStockModal, type AdjustInitial } from "@/components/admin/inventory-adjust";
import { InventoryLedgerTab } from "@/components/admin/inventory-ledger";
import { InventoryLevelsTab } from "@/components/admin/inventory-levels";
import { ButtonLink } from "@/components/admin/inventory-shared";
import { InventoryTransfersTab } from "@/components/admin/inventory-transfers";
import { Button, Tabs } from "@/components/ui";

type Tab = "levels" | "ledger" | "transfers";
const TABS: { value: Tab; label: string }[] = [
  { value: "levels", label: "Levels" },
  { value: "ledger", label: "Ledger" },
  { value: "transfers", label: "Transfers" },
];

export default function InventoryPage() {
  // Tab-specific filters are listed here so switching tabs can reset them.
  const { filters, set } = useListState({ tab: "levels", q: "", status: "", type: "", sku: "", from: "", to: "", tstatus: "" });
  const tab: Tab = TABS.some((t) => t.value === filters.tab) ? (filters.tab as Tab) : "levels";
  const [adjust, setAdjust] = useState<AdjustInitial | null>(null);

  const switchTab = (next: Tab, extra: { sku?: string } = {}) =>
    set({ tab: next === "levels" ? "" : next, q: "", status: "", type: "", sku: extra.sku ?? "", from: "", to: "", tstatus: "" });

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock on hand across warehouses, every stock movement, and transfers between locations."
        actions={
          <>
            <Can permission="inventory.transfer">
              <ButtonLink href="/admin/inventory/transfers/new" variant="outline" icon={<ArrowLeftRight size={15} />}>
                New transfer
              </ButtonLink>
            </Can>
            <Can permission="inventory.adjust">
              <Button icon={<SlidersHorizontal size={15} />} onClick={() => setAdjust({})}>
                Adjust stock
              </Button>
            </Can>
          </>
        }
      />
      <div className="mb-4 w-fit max-w-full">
        <Tabs value={tab} onChange={(t) => switchTab(t)} tabs={TABS} />
      </div>
      {tab === "levels" && <InventoryLevelsTab onAdjust={setAdjust} onViewLedger={(sku) => switchTab("ledger", { sku })} />}
      {tab === "ledger" && <InventoryLedgerTab />}
      {tab === "transfers" && <InventoryTransfersTab />}
      {adjust && <AdjustStockModal initial={adjust} onClose={() => setAdjust(null)} />}
    </>
  );
}
