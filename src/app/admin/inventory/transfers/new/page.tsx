"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Lock, Trash2 } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { applyApiErrors, ButtonLink, FormError, qty, useVariantStock, VariantPicker, WarehouseOptions } from "@/components/admin/inventory-shared";
import type { TransferDetail } from "@/components/admin/inventory-types";
import { Button, Card, EmptyState, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

const schema = z
  .object({
    fromWarehouseId: z.string().min(1, "Select the source warehouse"),
    toWarehouseId: z.string().min(1, "Select the destination warehouse"),
    notes: z.string().max(500, "500 characters at most"),
    items: z
      .array(
        z.object({
          variantId: z.string(),
          sku: z.string(),
          label: z.string(),
          quantity: z.number({ error: "Enter a quantity" }).int("Whole numbers only").min(1, "At least 1").max(100_000, "At most 100,000"),
        }),
      )
      .min(1, "Add at least one item")
      .max(500, "At most 500 lines per transfer"),
  })
  .refine((v) => !v.fromWarehouseId || v.fromWarehouseId !== v.toWarehouseId, { path: ["toWarehouseId"], message: "Destination must be different from the source" });
type Values = z.infer<typeof schema>;

function SourceAvailability({ variantId, warehouseId, quantity }: { variantId: string; warehouseId: string; quantity: number }) {
  const stock = useVariantStock(variantId);
  if (!warehouseId) return <span className="text-ink/35">—</span>;
  if (stock.isLoading) return <span className="text-ink/40">…</span>;
  if (stock.error) return <span className="text-danger">Error</span>;
  const available = stock.data?.inventoryLevels.find((l) => l.warehouseId === warehouseId)?.available ?? 0;
  const short = Number.isFinite(quantity) && quantity > available;
  return (
    <span className={short ? "font-semibold text-danger" : "text-ink/70"} title={short ? "More than is currently available at the source; dispatch will fail unless stock arrives first" : undefined}>
      {qty(available)}
    </span>
  );
}

export default function NewTransferPage() {
  return (
    <>
      <PageHeader title="New stock transfer" description="Move stock from one warehouse to another." back={{ href: "/admin/inventory?tab=transfers", label: "Transfers" }} />
      <Can
        permission="inventory.transfer"
        fallback={
          <Card>
            <EmptyState icon={<Lock size={22} />} title="You can’t create transfers" body="Ask an administrator for the inventory.transfer permission." />
          </Card>
        }
      >
        <TransferForm />
      </Can>
    </>
  );
}

function TransferForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fromWarehouseId: "", toWarehouseId: "", notes: "", items: [] } });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const from = useWatch({ control, name: "fromWarehouseId" });
  const to = useWatch({ control, name: "toWarehouseId" });
  const items = useWatch({ control, name: "items" });
  const totalUnits = (items ?? []).reduce((s, i) => s + (Number.isFinite(i.quantity) ? i.quantity : 0), 0);

  const submit = handleSubmit(async (v) => {
    try {
      const t = await api.post<TransferDetail>("/inventory/transfers", {
        fromWarehouseId: v.fromWarehouseId,
        toWarehouseId: v.toWarehouseId,
        notes: v.notes.trim() || null,
        items: v.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      void qc.invalidateQueries({ queryKey: ["admin", "inventory"] });
      toast(`Transfer ${t.number} created as a draft`);
      router.push(`/admin/inventory/transfers/${t.id}`);
    } catch (err) {
      applyApiErrors(err, setError, ["fromWarehouseId", "toWarehouseId", "notes", "items"]);
    }
  });

  const itemsError = errors.items?.message ?? errors.items?.root?.message;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card title="Route">
          <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <Field label="From warehouse" htmlFor="from" error={errors.fromWarehouseId?.message} required>
              <Select id="from" invalid={!!errors.fromWarehouseId} {...register("fromWarehouseId")}>
                <option value="">Select source…</option>
                <WarehouseOptions activeOnly />
              </Select>
            </Field>
            <ArrowRight size={18} className="mx-auto hidden text-ink/35 sm:mt-9 sm:block" aria-hidden />
            <Field label="To warehouse" htmlFor="to" error={errors.toWarehouseId?.message} required>
              <Select id="to" invalid={!!errors.toWarehouseId} {...register("toWarehouseId")}>
                <option value="">Select destination…</option>
                <WarehouseOptions activeOnly exclude={from || undefined} />
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Items" actions={fields.length > 0 && <span className="text-xs text-ink/50">{fields.length} line(s) · {qty(totalUnits)} units</span>}>
          <VariantPicker
            warehouseId={from || undefined}
            disabled={!from}
            placeholder={from ? "Search SKU or product to add…" : "Select the source warehouse first"}
            excludeIds={fields.map((f) => f.variantId)}
            invalid={!!itemsError}
            onSelect={(v) => append({ variantId: v.variantId, sku: v.sku, label: v.label, quantity: 1 })}
          />
          {itemsError && <p className="mt-1 text-xs text-danger">{itemsError}</p>}

          {fields.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink/50">No items yet. Search above to add variants from the source warehouse.</p>
          ) : (
            <div className="-mx-5 mt-4 overflow-x-auto">
              <table className="w-full min-w-140 text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
                    <th className="px-5 py-2.5 font-semibold">Item</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Available at source</th>
                    <th className="w-36 px-3 py-2.5 font-semibold">Quantity</th>
                    <th className="w-12 px-5 py-2.5" aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => {
                    const err = errors.items?.[i]?.quantity?.message;
                    return (
                      <tr key={f.id} className="border-b border-black/4 align-top last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium">{f.label}</p>
                          <p className="font-mono text-xs text-ink/50">{f.sku}</p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <SourceAvailability variantId={f.variantId} warehouseId={from} quantity={items?.[i]?.quantity ?? 0} />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            aria-label={`Quantity for ${f.sku}`}
                            invalid={!!err}
                            {...register(`items.${i}.quantity`, { valueAsNumber: true })}
                          />
                          {err && <p className="mt-1 text-xs text-danger">{err}</p>}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="sm" aria-label={`Remove ${f.sku}`} icon={<Trash2 size={14} />} onClick={() => remove(i)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Notes">
          <Field htmlFor="notes" error={errors.notes?.message} hint="Optional — e.g. courier, vehicle or reason">
            <Textarea id="notes" rows={3} aria-label="Notes" invalid={!!errors.notes} {...register("notes")} />
          </Field>
        </Card>
        <Card>
          <div className="space-y-3 text-sm text-ink/60">
            <p>The transfer is saved as a <strong className="text-ink">draft</strong>. No stock moves until you dispatch it, which deducts the units from the source warehouse.</p>
            {from && to && from === to && <p className="text-danger">Source and destination must differ.</p>}
          </div>
          <div className="mt-4">
            <FormError message={errors.root?.message} />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <ButtonLink href="/admin/inventory?tab=transfers" variant="outline">
              Cancel
            </ButtonLink>
            <Button type="submit" loading={isSubmitting}>
              Create transfer
            </Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
