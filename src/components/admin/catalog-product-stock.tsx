"use client";

import { clsx } from "clsx";
import { Boxes } from "lucide-react";
import { Badge, Card, EmptyState, StatusBadge } from "@/components/ui";
import type { AdminProduct, AdminVariant, WarehouseStock } from "./catalog-shared";

const level = (v: AdminVariant) => (v.stock.available <= 0 ? "out" : v.stock.available <= v.stock.lowStockThreshold ? "low" : "ok");

/** Read-only stock per variant and warehouse (adjustments happen in Inventory). */
export function ProductStock({ product }: { product: AdminProduct }) {
  const warehouses = new Map<string, Pick<WarehouseStock, "id" | "code" | "name">>();
  for (const v of product.variants) for (const w of v.stock.warehouses) warehouses.set(w.id, { id: w.id, code: w.code, name: w.name });
  const columns = [...warehouses.values()].sort((a, b) => a.code.localeCompare(b.code));
  const total = product.variants.reduce((s, v) => s + v.stock.available, 0);

  return (
    <Card
      padded={false}
      title={
        <div>
          <h2 className="text-sm font-semibold">Stock</h2>
          <p className="mt-0.5 text-xs text-ink/50">
            {total.toLocaleString("en-IN")} available across {columns.length} warehouse{columns.length === 1 ? "" : "s"}. Adjust stock from Inventory.
          </p>
        </div>
      }
    >
      {!product.variants.length ? (
        <EmptyState title="No variants" icon={<Boxes size={22} />} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
                <th className="px-5 py-2.5 font-semibold">Variant</th>
                <th className="px-3 py-2.5 text-right font-semibold">On hand</th>
                <th className="px-3 py-2.5 text-right font-semibold">Reserved</th>
                <th className="px-3 py-2.5 text-right font-semibold">Available</th>
                <th className="px-3 py-2.5 text-right font-semibold">Low at</th>
                {columns.map((w) => (
                  <th key={w.id} className="whitespace-nowrap px-3 py-2.5 text-right font-semibold" title={w.name}>
                    {w.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => {
                const state = level(v);
                return (
                  <tr key={v.id} className="border-b border-black/[0.04] last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{v.title}</span>
                        {v.status !== "ACTIVE" && <StatusBadge status={v.status} />}
                        {state === "out" && <Badge tone="danger">Out of stock</Badge>}
                        {state === "low" && <Badge tone="warning">Low</Badge>}
                      </div>
                      <p className="font-mono text-xs text-ink/50">{v.sku}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{v.stock.onHand}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink/60">{v.stock.reserved}</td>
                    <td className={clsx("px-3 py-3 text-right font-semibold tabular-nums", state === "out" && "text-danger", state === "low" && "text-warning")}>{v.stock.available}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink/50">{v.stock.lowStockThreshold}</td>
                    {columns.map((w) => {
                      const s = v.stock.warehouses.find((x) => x.id === w.id);
                      return (
                        <td key={w.id} className="px-3 py-3 text-right tabular-nums" title={s ? `On hand ${s.onHand} · reserved ${s.reserved} · damaged ${s.damaged}` : undefined}>
                          {s ? s.available : <span className="text-ink/30">—</span>}
                          {s && s.damaged > 0 && <span className="ml-1 text-[11px] text-danger">({s.damaged} dmg)</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
