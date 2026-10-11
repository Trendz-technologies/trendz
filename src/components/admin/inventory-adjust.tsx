"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowRight, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ADJUST_REASONS, type AdjustReason, type VariantStock } from "./inventory-types";
import { applyApiErrors, FormError, qty, signed, useVariantStock, useWarehouses, VariantPicker, WarehouseOptions, type PickedVariant } from "./inventory-shared";

type Sign = "any" | "positive" | "negative";

export const REASON_CONFIG: Record<AdjustReason, { label: string; hint: string; modes: ("set" | "delta")[]; sign: Sign; bucket: boolean }> = {
  COUNT_CORRECTION: {
    label: "Count correction",
    hint: "The physical count differs from the system. Enter the counted quantity, or the difference.",
    modes: ["set", "delta"],
    sign: "any",
    bucket: true,
  },
  OPENING_STOCK: { label: "Opening stock", hint: "Stock that existed before the store started tracking it here.", modes: ["set", "delta"], sign: "positive", bucket: true },
  DAMAGE: { label: "Damage", hint: "Moves units from sellable stock into the damaged bucket.", modes: ["delta"], sign: "positive", bucket: false },
  LOSS: { label: "Loss / theft", hint: "Removes units that are missing. Enter how many were lost.", modes: ["delta"], sign: "negative", bucket: true },
  EXPIRED: { label: "Expired", hint: "Writes off expired units. Enter how many expired.", modes: ["delta"], sign: "negative", bucket: true },
  FOUND: { label: "Found", hint: "Adds units that turned up (e.g. misplaced stock).", modes: ["delta"], sign: "positive", bucket: true },
  OTHER: { label: "Other", hint: "Any other change — explain it in the notes.", modes: ["delta"], sign: "any", bucket: true },
};

const itemSchema = z.object({
  variantId: z.string(),
  sku: z.string(),
  label: z.string(),
  mode: z.enum(["delta", "set"]),
  bucket: z.enum(["ON_HAND", "DAMAGED"]),
  quantity: z.number({ error: "Enter a quantity" }).int("Whole numbers only").min(-100_000, "At most 100,000").max(100_000, "At most 100,000"),
});

const schema = z
  .object({
    warehouseId: z.string().min(1, "Select a warehouse"),
    reason: z.enum(ADJUST_REASONS),
    notes: z.string().max(500, "500 characters at most"),
    items: z.array(itemSchema).min(1, "Add at least one item").max(500, "At most 500 items per adjustment"),
  })
  .superRefine((v, ctx) => {
    const cfg = REASON_CONFIG[v.reason];
    v.items.forEach((it, i) => {
      const issue = (message: string) => ctx.addIssue({ code: "custom", path: ["items", i, "quantity"], message });
      if (Number.isNaN(it.quantity)) return;
      if (it.mode === "set") {
        if (it.quantity < 0) issue("Counts cannot be negative");
      } else if (cfg.sign === "any") {
        if (it.quantity === 0) issue("Enter a non-zero change");
      } else if (it.quantity <= 0) {
        issue("Enter a positive number of units");
      }
    });
    if (v.reason === "OTHER" && !v.notes.trim()) ctx.addIssue({ code: "custom", path: ["notes"], message: "Explain why stock is being adjusted" });
  });

type Values = z.infer<typeof schema>;
type Item = Values["items"][number];

/** Signed quantity the API expects for this item. */
function apiQuantity(item: Item, reason: AdjustReason) {
  if (item.mode === "set") return item.quantity;
  const sign = REASON_CONFIG[reason].sign;
  return sign === "negative" ? -Math.abs(item.quantity) : sign === "positive" ? Math.abs(item.quantity) : item.quantity;
}

interface Impact {
  lines: { bucket: string; before: number; after: number }[];
  problem?: string;
}

function computeImpact(item: Item, reason: AdjustReason, level: VariantStock["inventoryLevels"][number] | undefined): Impact | null {
  if (Number.isNaN(item.quantity)) return null;
  const onHand = level?.onHand ?? 0;
  const reserved = level?.reserved ?? 0;
  const damaged = level?.damaged ?? 0;
  const q = apiQuantity(item, reason);
  if (reason === "DAMAGE") {
    const after = onHand - q;
    return {
      lines: [
        { bucket: "On hand", before: onHand, after },
        { bucket: "Damaged", before: damaged, after: damaged + q },
      ],
      problem: after < reserved ? `Only ${qty(Math.max(0, onHand - reserved))} unreserved unit(s) can be moved to damaged` : undefined,
    };
  }
  if (item.bucket === "DAMAGED") {
    const after = item.mode === "set" ? q : damaged + q;
    return { lines: [{ bucket: "Damaged", before: damaged, after }], problem: after < 0 ? `Only ${qty(damaged)} damaged unit(s) here` : undefined };
  }
  const after = item.mode === "set" ? q : onHand + q;
  return {
    lines: [{ bucket: "On hand", before: onHand, after }],
    problem: after < onHand && after < reserved ? `${qty(reserved)} unit(s) are reserved for open orders; on hand cannot go below that` : undefined,
  };
}

function LineImpact({ item, reason, warehouseId }: { item: Item; reason: AdjustReason; warehouseId: string }) {
  const stock = useVariantStock(item.variantId);
  if (!warehouseId) return null;
  if (stock.isLoading) return <p className="text-xs text-ink/45">Loading current stock…</p>;
  if (stock.error) return <p className="text-xs text-danger">Could not load current stock</p>;
  const level = stock.data?.inventoryLevels.find((l) => l.warehouseId === warehouseId);
  const impact = computeImpact(item, reason, level);
  if (!impact) return <p className="text-xs text-ink/45">On hand here: {qty(level?.onHand ?? 0)} · reserved {qty(level?.reserved ?? 0)}</p>;
  return (
    <div className="space-y-1 text-xs">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink/60">
        {impact.lines.map((l) => (
          <span key={l.bucket} className="inline-flex items-center gap-1 tabular-nums">
            {l.bucket} {qty(l.before)} <ArrowRight size={11} aria-label="becomes" /> <strong className={l.after < l.before ? "text-danger" : l.after > l.before ? "text-success" : "text-ink"}>{qty(l.after)}</strong>
          </span>
        ))}
        {(level?.reserved ?? 0) > 0 && <span>· {qty(level?.reserved)} reserved</span>}
      </p>
      {impact.problem && (
        <p className="flex items-center gap-1 text-danger">
          <AlertTriangle size={12} aria-hidden /> {impact.problem}
        </p>
      )}
    </div>
  );
}

export interface AdjustInitial {
  warehouseId?: string;
  variant?: PickedVariant;
}

export function AdjustStockModal({ initial, onClose }: { initial?: AdjustInitial; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const warehouses = useWarehouses();
  const [review, setReview] = useState<Values | null>(null);

  const defaultWarehouse = initial?.warehouseId ?? user?.defaultWarehouseId ?? "";
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      warehouseId: defaultWarehouse,
      reason: "COUNT_CORRECTION",
      notes: "",
      items: initial?.variant ? [{ ...initial.variant, mode: "delta", bucket: "ON_HAND", quantity: Number.NaN }] : [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const warehouseId = useWatch({ control, name: "warehouseId" });
  const reason = useWatch({ control, name: "reason" });
  const items = useWatch({ control, name: "items" });
  const cfg = REASON_CONFIG[reason];
  const warehouse = warehouses.data?.find((w) => w.id === warehouseId);

  const onReasonChange = (next: AdjustReason) => {
    const c = REASON_CONFIG[next];
    getValues("items").forEach((it, i) => {
      if (!c.modes.includes(it.mode)) setValue(`items.${i}.mode`, "delta");
      if (c.sign !== "any" && it.quantity < 0) setValue(`items.${i}.quantity`, Math.abs(it.quantity));
    });
  };

  const save = useMutation({
    mutationFn: (v: Values) =>
      api.post<{ id: string; number: string }>("/inventory/adjust", {
        warehouseId: v.warehouseId,
        reason: v.reason,
        notes: v.notes.trim() || null,
        items: v.items.map((i) => ({ variantId: i.variantId, mode: i.mode, bucket: v.reason === "DAMAGE" ? "ON_HAND" : i.bucket, quantity: apiQuantity(i, v.reason) })),
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["admin", "inventory"] });
      void qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      toast(`Adjustment ${res.number} recorded`);
      onClose();
    },
    onError: (err) => {
      setReview(null);
      applyApiErrors(err, setError, ["warehouseId", "reason", "notes", "items"]);
    },
  });

  const toReview = handleSubmit((v) => setReview(v));

  const footer = review ? (
    <>
      <Button variant="ghost" onClick={() => setReview(null)} disabled={save.isPending}>
        Back to edit
      </Button>
      <Button loading={save.isPending} onClick={() => save.mutate(review)}>
        Confirm adjustment
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={toReview}>Review adjustment</Button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={review ? "Confirm stock adjustment" : "Adjust stock"} size="lg" footer={footer}>
      {review ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-offwhite p-4 text-sm">
            <p>
              <span className="font-semibold">{REASON_CONFIG[review.reason].label}</span> at <span className="font-semibold">{warehouse ? `${warehouse.code} · ${warehouse.name}` : "the selected warehouse"}</span>
            </p>
            {review.notes.trim() && <p className="mt-1 text-ink/60">“{review.notes.trim()}”</p>}
            <p className="mt-2 text-xs text-ink/55">Stock changes immediately and every change is recorded in the inventory ledger.</p>
          </div>
          <ul className="divide-y divide-black/5">
            {review.items.map((it) => (
              <li key={it.variantId} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{it.label}</p>
                  <p className="font-mono text-xs text-ink/50">{it.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{it.mode === "set" ? `Set to ${qty(it.quantity)}` : signed(apiQuantity(it, review.reason))}</p>
                  <LineImpact item={it} reason={review.reason} warehouseId={review.warehouseId} />
                </div>
              </li>
            ))}
          </ul>
          <FormError message={errors.root?.message} />
        </div>
      ) : (
        <form onSubmit={toReview} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Warehouse" htmlFor="adj-warehouse" error={errors.warehouseId?.message} required>
              <Controller
                control={control}
                name="warehouseId"
                render={({ field }) => (
                  <Select id="adj-warehouse" invalid={!!errors.warehouseId} {...field}>
                    <option value="">Select a warehouse…</option>
                    <WarehouseOptions activeOnly />
                  </Select>
                )}
              />
            </Field>
            <Field label="Reason" htmlFor="adj-reason" error={errors.reason?.message} hint={cfg.hint} required>
              <Select id="adj-reason" {...register("reason", { onChange: (e: { target: { value: string } }) => onReasonChange(e.target.value as AdjustReason) })}>
                {ADJUST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REASON_CONFIG[r].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <p className="label">Items</p>
            <VariantPicker
              warehouseId={warehouseId || undefined}
              disabled={!warehouseId}
              placeholder={warehouseId ? "Search SKU or product to add…" : "Select a warehouse first"}
              excludeIds={fields.map((f) => f.variantId)}
              invalid={!!errors.items?.message || !!errors.items?.root}
              onSelect={(v) =>
                append({
                  variantId: v.variantId,
                  sku: v.sku,
                  label: v.label,
                  mode: cfg.modes[0]!,
                  bucket: "ON_HAND",
                  // "Set" starts from the current count at this warehouse.
                  quantity: cfg.modes[0] === "set" ? v.row.onHand : Number.NaN,
                })
              }
            />
            {(errors.items?.message || errors.items?.root?.message) && <p className="mt-1 text-xs text-danger">{errors.items?.message ?? errors.items?.root?.message}</p>}
          </div>

          {fields.length > 0 && (
            <ul className="divide-y divide-black/5 rounded-2xl border border-black/5">
              {fields.map((f, i) => {
                const item = items?.[i];
                const qErr = errors.items?.[i]?.quantity?.message;
                const qLabel = item?.mode === "set" ? "New count" : reason === "DAMAGE" ? "Units damaged" : cfg.sign === "negative" ? "Units to remove" : cfg.sign === "positive" ? "Units to add" : "Change (±)";
                return (
                  <li key={f.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{f.label}</p>
                        <p className="font-mono text-xs text-ink/50">{f.sku}</p>
                      </div>
                      <Button variant="ghost" size="sm" aria-label={`Remove ${f.sku}`} icon={<Trash2 size={14} />} onClick={() => remove(i)} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {cfg.modes.length > 1 && (
                        <Field label="Mode" htmlFor={`adj-mode-${i}`}>
                          <Select id={`adj-mode-${i}`} {...register(`items.${i}.mode`)}>
                            <option value="set">Set counted quantity</option>
                            <option value="delta">Add / remove units</option>
                          </Select>
                        </Field>
                      )}
                      {cfg.bucket && (
                        <Field label="Stock bucket" htmlFor={`adj-bucket-${i}`}>
                          <Select id={`adj-bucket-${i}`} {...register(`items.${i}.bucket`)}>
                            <option value="ON_HAND">On hand (sellable)</option>
                            <option value="DAMAGED">Damaged</option>
                          </Select>
                        </Field>
                      )}
                      <Field label={qLabel} htmlFor={`adj-qty-${i}`} error={qErr} hint={item?.mode === "delta" && cfg.sign === "any" ? "Negative reduces stock" : undefined}>
                        <Input
                          id={`adj-qty-${i}`}
                          type="number"
                          inputMode="numeric"
                          step={1}
                          min={item?.mode === "set" || cfg.sign !== "any" ? 0 : undefined}
                          invalid={!!qErr}
                          {...register(`items.${i}.quantity`, { valueAsNumber: true })}
                        />
                      </Field>
                    </div>
                    {item && <LineImpact item={item} reason={reason} warehouseId={warehouseId} />}
                  </li>
                );
              })}
            </ul>
          )}

          <Field label="Notes" htmlFor="adj-notes" error={errors.notes?.message} hint={reason === "OTHER" ? "Required for “Other”" : "Optional — shown in the ledger"}>
            <Textarea id="adj-notes" rows={2} className="min-h-0" invalid={!!errors.notes} {...register("notes")} />
          </Field>
          <FormError message={errors.root?.message} />
          {/* Lets Enter in a quantity field go to the review step. */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
            Review
          </button>
        </form>
      )}
    </Modal>
  );
}
