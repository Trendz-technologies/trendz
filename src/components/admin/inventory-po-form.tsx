"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Info, Trash2 } from "lucide-react";
import { Button, Card, Field, Input, MoneyInput, Select, StatusBadge, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { moneyExact, percent } from "@/lib/format";
import { applyApiErrors, ButtonLink, FormError, qty, SearchCombobox, useWarehouses, VariantPicker, WarehouseOptions } from "./inventory-shared";
import type { PoDetail, Supplier, SupplierRow } from "./inventory-types";

const COMMON_GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];

const schema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  warehouseId: z.string().min(1, "Select the receiving warehouse"),
  expectedDeliveryDate: z.string(),
  shippingCost: z.number().int().min(0, "Cannot be negative").max(100_000_000, "Too large").nullable(),
  notes: z.string().max(2000, "2,000 characters at most"),
  items: z
    .array(
      z.object({
        variantId: z.string(),
        sku: z.string(),
        label: z.string(),
        quantity: z.number({ error: "Enter a quantity" }).int("Whole numbers only").min(1, "At least 1").max(1_000_000, "At most 1,000,000"),
        unitCost: z.number({ error: "Enter the unit cost" }).int().min(0, "Cannot be negative").max(100_000_000, "Too large"),
        gstRate: z
          .number({ error: "Enter the GST rate" })
          .min(0, "0 or more")
          .max(100, "At most 100%")
          .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "At most 2 decimals"),
      }),
    )
    .min(1, "Add at least one item")
    .max(500, "At most 500 lines per purchase order"),
});
type Values = z.infer<typeof schema>;
const FIELDS = ["supplierId", "warehouseId", "expectedDeliveryDate", "shippingCost", "notes", "items"];

/** Same rounding as the API (half away from zero, once per amount). */
const applyBps = (amount: number, bps: number) => {
  const v = (amount * bps) / 10_000;
  return Math.sign(v) * Math.round(Math.abs(v));
};
const toBps = (rate: number) => Math.round(rate * 100);
const ok = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

function SupplierField({ supplier, loading, onChange, invalid }: { supplier: Supplier | undefined; loading: boolean; onChange: (id: string) => void; invalid?: boolean }) {
  if (loading) return <div className="input text-ink/45">Loading supplier…</div>;
  if (supplier) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3.5 py-2.5">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">
            {supplier.name} <span className="font-mono text-xs text-ink/50">{supplier.code}</span>
          </p>
          <p className="truncate text-xs text-ink/55">
            {supplier.gstin ? `GSTIN ${supplier.gstin}` : "Unregistered"}
            {supplier.state ? ` · ${supplier.state}` : ""}
            {supplier.paymentTermsDays != null ? ` · Net ${supplier.paymentTermsDays}` : ""}
          </p>
          {supplier.status !== "ACTIVE" && <p className="text-xs text-danger">This supplier is inactive — choose another.</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange("")}>
          Change
        </Button>
      </div>
    );
  }
  return (
    <SearchCombobox<SupplierRow>
      id="po-supplier"
      label="Supplier"
      placeholder="Type to search suppliers by name, code or GSTIN…"
      invalid={invalid}
      queryKey={["admin", "suppliers", "picker"]}
      search={async (term) => (await api.page<SupplierRow[]>("/suppliers", { q: term, status: "ACTIVE", limit: 8 })).data}
      optionKey={(s) => s.id}
      onSelect={(s) => onChange(s.id)}
      emptyText="No active suppliers match"
      renderOption={(s) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {s.name} <span className="font-mono text-xs text-ink/50">{s.code}</span>
          </p>
          <p className="truncate text-xs text-ink/55">{[s.gstin, s.city, s.state].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      )}
    />
  );
}

type SavedPo = Pick<PoDetail, "id" | "number" | "status" | "subtotal" | "taxTotal" | "shippingCost" | "grandTotal">;

export function PurchaseOrderForm({ po, initialSupplierId }: { po?: PoDetail; initialSupplierId?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const warehouses = useWarehouses();
  const [saved, setSaved] = useState<{ po: SavedPo; estimate: number } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: po
      ? {
          supplierId: po.supplierId,
          warehouseId: po.warehouseId,
          expectedDeliveryDate: po.expectedDeliveryDate?.slice(0, 10) ?? "",
          shippingCost: po.shippingCost,
          notes: po.notes ?? "",
          items: po.items.map((i) => ({ variantId: i.variantId, sku: i.sku, label: i.description, quantity: i.quantityOrdered, unitCost: i.unitCost, gstRate: i.taxRateBps / 100 })),
        }
      : { supplierId: initialSupplierId ?? "", warehouseId: "", expectedDeliveryDate: "", shippingCost: 0, notes: "", items: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const supplierId = useWatch({ control, name: "supplierId" });
  const warehouseId = useWatch({ control, name: "warehouseId" });
  const items = useWatch({ control, name: "items" });
  const shipping = useWatch({ control, name: "shippingCost" });

  const supplier = useQuery({ queryKey: ["admin", "suppliers", "detail", supplierId], queryFn: () => api.get<Supplier>(`/suppliers/${supplierId}`), enabled: !!supplierId });
  const warehouse = warehouses.data?.find((w) => w.id === warehouseId);

  // Live estimate; the server recalculates on save.
  const lines = (items ?? []).map((i) => {
    if (!ok(i.quantity) || !ok(i.unitCost)) return null;
    const net = i.quantity * i.unitCost;
    const tax = ok(i.gstRate) ? applyBps(net, toBps(i.gstRate)) : 0;
    return { net, tax, total: net + tax };
  });
  const subtotal = lines.reduce((s, l) => s + (l?.net ?? 0), 0);
  const taxTotal = lines.reduce((s, l) => s + (l?.tax ?? 0), 0);
  const grandTotal = subtotal + taxTotal + (ok(shipping) ? shipping : 0);
  const units = (items ?? []).reduce((s, i) => s + (ok(i.quantity) ? i.quantity : 0), 0);
  const interState = supplier.data?.stateCode && warehouse?.stateCode ? supplier.data.stateCode !== warehouse.stateCode : null;

  const submit = handleSubmit(async (v) => {
    const body = {
      supplierId: v.supplierId,
      warehouseId: v.warehouseId,
      expectedDeliveryDate: v.expectedDeliveryDate || null,
      shippingCost: v.shippingCost ?? 0,
      notes: v.notes.trim() || null,
      items: v.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitCost: i.unitCost, taxRateBps: toBps(i.gstRate) })),
    };
    try {
      const res = po ? await api.put<SavedPo>(`/purchase-orders/${po.id}`, body) : await api.post<SavedPo>("/purchase-orders", body);
      void qc.invalidateQueries({ queryKey: ["admin", "purchase-orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      if (po) {
        toast(`${res.number} updated · total ${moneyExact(res.grandTotal)}`);
        router.push(`/admin/purchase-orders/${res.id}`);
      } else {
        toast(`${res.number} saved as a draft`);
        setSaved({ po: res, estimate: grandTotal });
      }
    } catch (err) {
      applyApiErrors(err, setError, FIELDS);
    }
  });

  if (saved) {
    const p = saved.po;
    return (
      <Card className="mx-auto max-w-xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <CheckCircle2 size={36} className="text-success" aria-hidden />
          <h2 className="text-lg font-semibold">Purchase order {p.number} saved</h2>
          <StatusBadge status={p.status} />
          <p className="text-sm text-ink/55">Totals below were calculated by the server.</p>
        </div>
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/55">Subtotal (excl. GST)</dt>
            <dd className="tabular-nums">{moneyExact(p.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/55">GST</dt>
            <dd className="tabular-nums">{moneyExact(p.taxTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/55">Shipping</dt>
            <dd className="tabular-nums">{moneyExact(p.shippingCost)}</dd>
          </div>
          <div className="flex justify-between border-t border-black/5 pt-2 text-base font-semibold">
            <dt>Grand total</dt>
            <dd className="tabular-nums">{moneyExact(p.grandTotal)}</dd>
          </div>
        </dl>
        {p.grandTotal !== saved.estimate && <p className="mt-3 text-xs text-warning">The server total differs from the on-screen estimate ({moneyExact(saved.estimate)}); the server figure is authoritative.</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset({ supplierId: "", warehouseId: "", expectedDeliveryDate: "", shippingCost: 0, notes: "", items: [] });
              setSaved(null);
            }}
          >
            Create another
          </Button>
          <ButtonLink href={`/admin/purchase-orders/${p.id}`}>Open purchase order</ButtonLink>
        </div>
      </Card>
    );
  }

  const itemsError = errors.items?.message ?? errors.items?.root?.message;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Card title="Supplier & delivery">
          <div className="space-y-4">
            <Field label="Supplier" htmlFor="po-supplier" error={errors.supplierId?.message ?? (supplier.error ? "Could not load the supplier" : undefined)} required>
              <SupplierField
                supplier={supplier.data}
                loading={!!supplierId && supplier.isLoading}
                invalid={!!errors.supplierId}
                onChange={(id) => {
                  setValue("supplierId", id, { shouldDirty: true });
                  if (id) clearErrors("supplierId");
                }}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Receiving warehouse" htmlFor="po-warehouse" error={errors.warehouseId?.message} required>
                <Controller
                  control={control}
                  name="warehouseId"
                  render={({ field }) => (
                    <Select id="po-warehouse" invalid={!!errors.warehouseId} {...field}>
                      <option value="">Select warehouse…</option>
                      <WarehouseOptions activeOnly />
                    </Select>
                  )}
                />
              </Field>
              <Field label="Expected delivery" htmlFor="po-eta" error={errors.expectedDeliveryDate?.message}>
                <Input id="po-eta" type="date" invalid={!!errors.expectedDeliveryDate} {...register("expectedDeliveryDate")} />
              </Field>
            </div>
            {interState != null && (
              <p className="flex items-center gap-1.5 text-xs text-ink/55">
                <Info size={13} aria-hidden />
                {interState ? "Inter-state purchase — IGST applies." : "Intra-state purchase — CGST + SGST apply."}
              </p>
            )}
          </div>
        </Card>

        <Card title="Line items" actions={fields.length > 0 && <span className="text-xs text-ink/50">{fields.length} line(s) · {qty(units)} units</span>}>
          <VariantPicker
            label="Add product variant"
            excludeIds={fields.map((f) => f.variantId)}
            invalid={!!itemsError}
            onSelect={(v) => {
              const prev = items?.[items.length - 1];
              append({
                variantId: v.variantId,
                sku: v.sku,
                label: v.label,
                quantity: 1,
                // Pre-fill from the variant's cost price when it can be derived.
                unitCost: v.row.stockValue != null && v.row.onHand > 0 ? Math.round(v.row.stockValue / v.row.onHand) : Number.NaN,
                gstRate: prev && ok(prev.gstRate) ? prev.gstRate : Number.NaN,
              });
            }}
          />
          {itemsError && <p className="mt-1 text-xs text-danger">{itemsError}</p>}

          {fields.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink/50">Search above to add the variants you are ordering.</p>
          ) : (
            <div className="-mx-5 mt-4 overflow-x-auto">
              <table className="w-full min-w-180 text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
                    <th className="px-5 py-2.5 font-semibold">Item</th>
                    <th className="w-28 px-2 py-2.5 font-semibold">Qty</th>
                    <th className="w-40 px-2 py-2.5 font-semibold">Unit cost (excl. GST)</th>
                    <th className="w-28 px-2 py-2.5 font-semibold">GST %</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Line total</th>
                    <th className="w-12 px-5 py-2.5" aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => {
                    const e = errors.items?.[i];
                    const line = lines[i];
                    return (
                      <tr key={f.id} className="border-b border-black/4 align-top last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium">{f.label}</p>
                          <p className="font-mono text-xs text-ink/50">{f.sku}</p>
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" inputMode="numeric" min={1} step={1} aria-label={`Quantity for ${f.sku}`} invalid={!!e?.quantity} {...register(`items.${i}.quantity`, { valueAsNumber: true })} />
                          {e?.quantity && <p className="mt-1 text-xs text-danger">{e.quantity.message}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <Controller
                            control={control}
                            name={`items.${i}.unitCost`}
                            render={({ field }) => (
                              <MoneyInput
                                aria-label={`Unit cost for ${f.sku}`}
                                invalid={!!e?.unitCost}
                                value={ok(field.value) ? field.value : null}
                                onChange={(p) => field.onChange(p ?? Number.NaN)}
                                onBlur={field.onBlur}
                                name={field.name}
                              />
                            )}
                          />
                          {e?.unitCost && <p className="mt-1 text-xs text-danger">{e.unitCost.message}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step="0.01"
                            list="po-gst-rates"
                            aria-label={`GST rate for ${f.sku}`}
                            invalid={!!e?.gstRate}
                            {...register(`items.${i}.gstRate`, { valueAsNumber: true })}
                          />
                          {e?.gstRate && <p className="mt-1 text-xs text-danger">{e.gstRate.message}</p>}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums">
                          {line ? (
                            <>
                              <p className="font-medium">{moneyExact(line.total)}</p>
                              {line.tax > 0 && <p className="text-xs text-ink/50">incl. {moneyExact(line.tax)} GST</p>}
                            </>
                          ) : (
                            <span className="text-ink/35">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="sm" aria-label={`Remove ${f.sku}`} icon={<Trash2 size={14} />} onClick={() => remove(i)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="po-gst-rates">
                {COMMON_GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {percent(r * 100)}
                  </option>
                ))}
              </datalist>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Summary">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/55">Subtotal (excl. GST)</dt>
              <dd className="tabular-nums">{moneyExact(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/55">GST</dt>
              <dd className="tabular-nums">{moneyExact(taxTotal)}</dd>
            </div>
          </dl>
          <Field label="Shipping / freight" htmlFor="po-shipping" error={errors.shippingCost?.message} className="mt-4">
            <Controller
              control={control}
              name="shippingCost"
              render={({ field }) => <MoneyInput id="po-shipping" invalid={!!errors.shippingCost} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />}
            />
          </Field>
          <div className="mt-4 flex justify-between border-t border-black/5 pt-3 text-base font-semibold">
            <span>Estimated total</span>
            <span className="tabular-nums">{moneyExact(grandTotal)}</span>
          </div>
          <p className="mt-1 text-xs text-ink/45">Final totals are calculated by the server when you save.</p>
        </Card>
        <Card title="Notes">
          <Field htmlFor="po-notes" error={errors.notes?.message} hint="Visible to your team — e.g. delivery instructions">
            <Textarea id="po-notes" aria-label="Notes" rows={3} invalid={!!errors.notes} {...register("notes")} />
          </Field>
        </Card>
        <FormError message={errors.root?.message} />
        <div className="flex flex-wrap justify-end gap-2">
          {po ? (
            <ButtonLink href={`/admin/purchase-orders/${po.id}`} variant="outline">
              Cancel
            </ButtonLink>
          ) : (
            <ButtonLink href="/admin/purchase-orders" variant="outline">
              Cancel
            </ButtonLink>
          )}
          <Button type="submit" loading={isSubmitting}>
            {po ? "Save changes" : "Save as draft"}
          </Button>
        </div>
        {!po && (
          <p className="text-right text-xs text-ink/45">Drafts can be edited until they are submitted for approval.</p>
        )}
      </div>
    </form>
  );
}
