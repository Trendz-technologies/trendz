"use client";

import { useState, type KeyboardEvent } from "react";
import { Controller, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { clsx } from "clsx";
import { Plus, RotateCcw, Trash2, WandSparkles, X } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Input, MoneyInput, Select } from "@/components/ui";
import { VARIANT_STATUSES, type AdminVariant } from "./catalog-shared";
import type { ProductFormInput, ProductFormOutput } from "./catalog-product-schema";
import { activeOptions, buildMatrix, suggestSku, uid, variantLabel, type Exclusion, type OptionDraft, type VariantDraft } from "./catalog-variants";

export type ProductFormApi = UseFormReturn<ProductFormInput, unknown, ProductFormOutput>;

const MAX_OPTIONS = 3;
const MAX_VALUES = 50;

/** Re-suggests the SKU of every unsaved row whose SKU was not typed by hand (e.g. after the base SKU changed). */
export function syncSuggestedSkus(form: ProductFormApi, baseSku: string) {
  const options = form.getValues("options");
  form.getValues("variants").forEach((row, i) => {
    if (row.variantId || row.skuTouched) return;
    const sku = suggestSku(baseSku, options, row.values);
    if (sku !== row.sku) form.setValue(`variants.${i}.sku`, sku, { shouldDirty: true });
  });
}

export function OptionsAndVariants({
  form,
  exclusions,
  onExclusionsChange,
  retired,
  canManageCodes,
}: {
  form: ProductFormApi;
  exclusions: Exclusion[];
  onExclusionsChange: (next: Exclusion[]) => void;
  retired: AdminVariant[];
  canManageCodes: boolean;
}) {
  const {
    control,
    register,
    getValues,
    setValue,
    clearErrors,
    formState: { errors, isSubmitted },
  } = form;
  const optionFields = useFieldArray({ control, name: "options" });
  const variantFields = useFieldArray({ control, name: "variants" });
  const options = useWatch({ control, name: "options" }) ?? [];
  const rows = useWatch({ control, name: "variants" }) ?? [];
  const [removingOption, setRemovingOption] = useState<number | null>(null);
  const active = activeOptions(options);

  const regenerate = (nextOptions: OptionDraft[], nextExclusions: Exclusion[], nextRows: VariantDraft[] = getValues("variants")) => {
    clearErrors("variants");
    variantFields.replace(buildMatrix(nextOptions, nextRows, nextExclusions, getValues("baseSku")));
    onExclusionsChange(nextExclusions);
  };

  const setOptionValues = (index: number, values: string[]) => {
    setValue(`options.${index}.values`, values, { shouldDirty: true, shouldValidate: isSubmitted });
  };

  const addValues = (index: number, raw: string): string | null => {
    const current = getValues(`options.${index}.values`);
    const incoming = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!incoming.length) return null;
    const tooLong = incoming.find((v) => v.length > 40);
    if (tooLong) return `"${tooLong.slice(0, 20)}…" is longer than 40 characters`;
    const seen = new Set(current.map((v) => v.toLowerCase()));
    const fresh: string[] = [];
    for (const v of incoming) {
      if (seen.has(v.toLowerCase())) continue;
      seen.add(v.toLowerCase());
      fresh.push(v);
    }
    if (!fresh.length) return "That value is already in the list";
    if (current.length + fresh.length > MAX_VALUES) return `At most ${MAX_VALUES} values per option`;
    setOptionValues(index, [...current, ...fresh]);
    regenerate(getValues("options"), exclusions);
    return null;
  };

  const removeValue = (index: number, value: string) => {
    const option = getValues(`options.${index}`);
    setOptionValues(
      index,
      option.values.filter((v) => v !== value),
    );
    regenerate(
      getValues("options"),
      exclusions.filter((e) => e[option.key] !== value),
    );
  };

  const renameValue = (index: number, from: string, to: string): string | null => {
    const option = getValues(`options.${index}`);
    const value = to.trim();
    if (!value || value === from) return null;
    if (value.length > 40) return "At most 40 characters";
    if (option.values.some((v) => v !== from && v.toLowerCase() === value.toLowerCase())) return "That value is already in the list";
    setOptionValues(
      index,
      option.values.map((v) => (v === from ? value : v)),
    );
    const nextRows = getValues("variants").map((r) => (r.values[option.key] === from ? { ...r, values: { ...r.values, [option.key]: value } } : r));
    const nextExclusions = exclusions.map((e) => (e[option.key] === from ? { ...e, [option.key]: value } : e));
    regenerate(getValues("options"), nextExclusions, nextRows);
    return null;
  };

  const removeOption = (index: number) => {
    const all = getValues("options");
    const removed = all[index];
    optionFields.remove(index);
    regenerate(
      all.filter((_, i) => i !== index),
      exclusions.filter((e) => !removed || !(removed.key in e)),
    );
  };

  const removeRow = (index: number) => {
    const row = getValues(`variants.${index}`);
    const combo = Object.fromEntries(active.map((o) => [o.key, row.values[o.key] ?? ""]));
    variantFields.remove(index);
    onExclusionsChange([...exclusions, combo]);
    if (row.isDefault) setValue("variants.0.isDefault", true, { shouldDirty: true });
  };

  const setDefault = (index: number) => {
    getValues("variants").forEach((r, i) => {
      if (r.isDefault !== (i === index)) setValue(`variants.${i}.isDefault`, i === index, { shouldDirty: true });
    });
  };

  const resuggestSkus = () => {
    const base = getValues("baseSku");
    getValues("variants").forEach((r, i) => {
      if (r.variantId) return;
      setValue(`variants.${i}.skuTouched`, false);
      setValue(`variants.${i}.sku`, suggestSku(base, getValues("options"), r.values), { shouldDirty: true, shouldValidate: isSubmitted });
    });
  };

  const optionsError = errors.options?.root?.message ?? errors.options?.message;
  const variantsError = errors.variants?.root?.message ?? errors.variants?.message;
  const unsavedRows = rows.filter((r) => !r.variantId).length;

  return (
    <>
      <Card
        title={
          <div>
            <h2 className="text-sm font-semibold">Options & variants</h2>
            <p className="mt-0.5 text-xs text-ink/50">Add up to 3 options (e.g. Size, Colour). Every combination becomes a variant with its own SKU, price and stock.</p>
          </div>
        }
        actions={
          optionFields.fields.length < MAX_OPTIONS && (
            <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => optionFields.append({ key: uid(), name: "", values: [] }, { shouldFocus: true })}>
              Add option
            </Button>
          )
        }
      >
        {optionFields.fields.length === 0 ? (
          <p className="text-sm text-ink/55">This product has a single variant. Add an option to sell it in several sizes, colours or materials.</p>
        ) : (
          <div className="space-y-4">
            {optionFields.fields.map((field, i) => {
              const err = errors.options?.[i];
              const values = options[i]?.values ?? [];
              return (
                <div key={field.id} className="grid gap-3 rounded-2xl border border-black/[0.06] p-4 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-start">
                  <div>
                    <label htmlFor={`option-${i}-name`} className="label">
                      Option {i + 1}
                    </label>
                    <Input id={`option-${i}-name`} placeholder="e.g. Size" invalid={!!err?.name} {...register(`options.${i}.name`)} />
                    {err?.name?.message && <p className="mt-1 text-xs text-danger">{err.name.message}</p>}
                  </div>
                  <div className="min-w-0">
                    <span className="label" id={`option-${i}-values-label`}>
                      Values
                    </span>
                    <OptionValuesInput
                      labelledBy={`option-${i}-values-label`}
                      values={values}
                      invalid={!!err?.values}
                      onAdd={(raw) => addValues(i, raw)}
                      onRemove={(v) => removeValue(i, v)}
                      onRename={(from, to) => renameValue(i, from, to)}
                    />
                    {err?.values?.message ? (
                      <p className="mt-1 text-xs text-danger">{err.values.message}</p>
                    ) : (
                      <p className="mt-1 text-xs text-ink/45">Press Enter or comma to add. Click a value to rename it.</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="sm:mt-6"
                    aria-label={`Remove option ${options[i]?.name || i + 1}`}
                    icon={<Trash2 size={14} />}
                    onClick={() => (values.length ? setRemovingOption(i) : removeOption(i))}
                  />
                </div>
              );
            })}
          </div>
        )}
        {optionsError && <p className="mt-3 text-sm text-danger">{optionsError}</p>}
      </Card>

      <Card
        className="mt-6"
        padded={false}
        title={
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Variants</h2>
            <Badge>{rows.length}</Badge>
          </div>
        }
        actions={
          <>
            {exclusions.length > 0 && active.length > 0 && (
              <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => regenerate(getValues("options"), [])}>
                Restore {exclusions.length} removed
              </Button>
            )}
            {unsavedRows > 0 && (
              <Button variant="ghost" size="sm" icon={<WandSparkles size={14} />} onClick={resuggestSkus}>
                Suggest SKUs
              </Button>
            )}
          </>
        }
      >
        {rows.length > 1 && <BulkPriceBar form={form} />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
                <th className="w-16 px-4 py-2.5 text-center font-semibold">Default</th>
                {active.length > 0 && <th className="px-3 py-2.5 font-semibold">Variant</th>}
                <th className="min-w-44 px-3 py-2.5 font-semibold">SKU</th>
                <th className="w-32 px-3 py-2.5 font-semibold">MRP</th>
                <th className="w-32 px-3 py-2.5 font-semibold">Selling price</th>
                <th className="w-32 px-3 py-2.5 font-semibold">Cost price</th>
                <th className="w-28 px-3 py-2.5 font-semibold">Weight (g)</th>
                <th className="w-28 px-3 py-2.5 font-semibold">Low stock at</th>
                <th className="w-36 px-3 py-2.5 font-semibold">Status</th>
                <th className="w-12 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {variantFields.fields.map((field, i) => {
                const row = rows[i] ?? field;
                const err = errors.variants?.[i];
                const label = variantLabel(options, row.values);
                const skuChanged = !!row.originalSku && row.sku.trim().toUpperCase() !== row.originalSku;
                return (
                  <tr key={field.id} className="border-b border-black/[0.04] align-top last:border-0">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name="default-variant"
                        className="mt-3 h-4 w-4 accent-accent"
                        checked={!!row.isDefault}
                        onChange={() => setDefault(i)}
                        aria-label={`Make ${label} the default variant`}
                      />
                    </td>
                    {active.length > 0 && (
                      <td className="px-3 py-3">
                        <p className="mt-2 font-medium">{label}</p>
                        {row.variantId ? null : <p className="text-[11px] text-ink/45">New</p>}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <Input
                        aria-label={`SKU for ${label}`}
                        className="font-mono uppercase"
                        invalid={!!err?.sku}
                        {...register(`variants.${i}.sku`, { onChange: () => setValue(`variants.${i}.skuTouched`, true) })}
                      />
                      {err?.sku?.message ? (
                        <p className="mt-1 text-xs text-danger">{err.sku.message}</p>
                      ) : skuChanged ? (
                        <p className={clsx("mt-1 text-xs", canManageCodes ? "text-warning" : "text-danger")}>
                          {canManageCodes ? `Was ${row.originalSku}; linked codes follow the new SKU` : "Changing a SKU needs the codes.manage permission"}
                        </p>
                      ) : null}
                    </td>
                    {(["mrp", "sellingPrice", "costPrice"] as const).map((name) => (
                      <td key={name} className="px-3 py-3">
                        <Controller
                          control={control}
                          name={`variants.${i}.${name}`}
                          render={({ field: f }) => (
                            <MoneyInput
                              aria-label={`${name === "mrp" ? "MRP" : name === "sellingPrice" ? "Selling price" : "Cost price"} for ${label}`}
                              value={f.value}
                              onChange={f.onChange}
                              onBlur={f.onBlur}
                              invalid={!!err?.[name]}
                              placeholder={name === "costPrice" ? "Optional" : undefined}
                            />
                          )}
                        />
                        {err?.[name]?.message && <p className="mt-1 text-xs text-danger">{err[name]?.message}</p>}
                      </td>
                    ))}
                    <td className="px-3 py-3">
                      <Input aria-label={`Weight in grams for ${label}`} inputMode="numeric" placeholder="—" invalid={!!err?.weightGrams} {...register(`variants.${i}.weightGrams`)} />
                      {err?.weightGrams?.message && <p className="mt-1 text-xs text-danger">{err.weightGrams.message}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <Input aria-label={`Low stock threshold for ${label}`} inputMode="numeric" placeholder="Default" invalid={!!err?.lowStockThreshold} {...register(`variants.${i}.lowStockThreshold`)} />
                      {err?.lowStockThreshold?.message && <p className="mt-1 text-xs text-danger">{err.lowStockThreshold.message}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <Select aria-label={`Status of ${label}`} {...register(`variants.${i}.status`)}>
                        {VARIANT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {active.length > 0 && rows.length > 1 && (
                        <Button variant="ghost" size="sm" className="mt-1" aria-label={`Remove variant ${label}`} icon={<X size={14} />} onClick={() => removeRow(i)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 border-t border-black/5 px-5 py-3 text-xs text-ink/50">
          {variantsError && <p className="text-sm text-danger">{variantsError}</p>}
          <p>Prices include tax. Leave “Low stock at” empty to use the product’s minimum stock level. Removed variants with order or stock history are discontinued instead of deleted.</p>
          {retired.length > 0 && (
            <p>
              Retired variants kept for history: <span className="font-mono">{retired.map((v) => v.sku).join(", ")}</span>
            </p>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={removingOption !== null}
        title={`Remove option “${removingOption !== null ? options[removingOption]?.name || `Option ${removingOption + 1}` : ""}”?`}
        body="Variants that only differed by this option are merged into one. Nothing changes until you save the product."
        confirmLabel="Remove option"
        tone="danger"
        onConfirm={() => {
          if (removingOption !== null) removeOption(removingOption);
          setRemovingOption(null);
        }}
        onClose={() => setRemovingOption(null)}
      />
    </>
  );
}

/** Chips with an input: Enter/comma adds, click renames, × removes. */
function OptionValuesInput({
  values,
  invalid,
  labelledBy,
  onAdd,
  onRemove,
  onRename,
}: {
  values: string[];
  invalid?: boolean;
  labelledBy: string;
  onAdd: (raw: string) => string | null;
  onRemove: (value: string) => void;
  onRename: (from: string, to: string) => string | null;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ value: string; text: string } | null>(null);

  const commit = () => {
    if (!text.trim()) return;
    const err = onAdd(text);
    setError(err);
    if (!err) setText("");
  };
  const commitRename = () => {
    if (!editing) return;
    const err = onRename(editing.value, editing.text);
    setError(err);
    setEditing(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !text && values.length) {
      onRemove(values[values.length - 1]!);
    }
  };

  return (
    <div>
      <div
        role="group"
        aria-labelledby={labelledBy}
        className={clsx("input flex min-h-10 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-ink/40 focus-within:ring-4 focus-within:ring-accent/15", invalid && "border-danger/60")}
      >
        {values.map((v) =>
          editing?.value === v ? (
            <input
              key={v}
              autoFocus
              aria-label={`Rename ${v}`}
              value={editing.text}
              onChange={(e) => setEditing({ value: v, text: e.target.value })}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") setEditing(null);
              }}
              className="h-7 w-28 rounded-full border border-ink/30 px-2.5 text-xs outline-none"
            />
          ) : (
            <span key={v} className="inline-flex h-7 items-center gap-1 rounded-full bg-black/[0.06] pl-2.5 pr-1 text-xs font-medium">
              <button type="button" className="hover:underline" onClick={() => setEditing({ value: v, text: v })} aria-label={`Rename ${v}`}>
                {v}
              </button>
              <button type="button" onClick={() => onRemove(v)} aria-label={`Remove ${v}`} className="rounded-full p-0.5 text-ink/50 hover:bg-black/10 hover:text-ink">
                <X size={12} />
              </button>
            </span>
          ),
        )}
        <input
          value={text}
          aria-label="Add value"
          placeholder={values.length ? "Add value" : "e.g. S, M, L"}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={commit}
          className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Sets MRP / selling / cost price on every variant at once. */
function BulkPriceBar({ form }: { form: ProductFormApi }) {
  const [prices, setPrices] = useState<{ mrp: number | null; sellingPrice: number | null; costPrice: number | null }>({ mrp: null, sellingPrice: null, costPrice: null });
  const empty = prices.mrp == null && prices.sellingPrice == null && prices.costPrice == null;
  const apply = () => {
    const shouldValidate = form.formState.isSubmitted;
    form.getValues("variants").forEach((_, i) => {
      for (const key of ["mrp", "sellingPrice", "costPrice"] as const) {
        const value = prices[key];
        if (value != null) form.setValue(`variants.${i}.${key}`, value, { shouldDirty: true, shouldValidate });
      }
    });
    setPrices({ mrp: null, sellingPrice: null, costPrice: null });
  };
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-black/5 bg-offwhite/60 px-5 py-3">
      <p className="w-full text-xs font-semibold text-ink/60 sm:w-auto sm:self-center">Set for all variants</p>
      {(
        [
          ["mrp", "MRP"],
          ["sellingPrice", "Selling price"],
          ["costPrice", "Cost price"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="w-32">
          <MoneyInput aria-label={`${label} for all variants`} placeholder={label} value={prices[key]} onChange={(v) => setPrices((p) => ({ ...p, [key]: v }))} />
        </div>
      ))}
      <Button variant="outline" size="sm" className="mb-1" disabled={empty} onClick={apply}>
        Apply to all
      </Button>
    </div>
  );
}
