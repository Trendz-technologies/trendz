"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Checkbox, ErrorState, Field, Input, Modal, MoneyInput, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { BrandPicker, CategoryPicker, ProductPicker } from "./sales-promo-pickers";
import { applyApiErrors, fromLocalInput, Notice, numberOrNull, toLocalInput } from "./sales-shared";
import type { DiscountDetail } from "./sales-types";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { withinChars } from "@/lib/rich-text";

const schema = z
  .object({
    name: z.string().trim().min(2, "At least 2 characters").max(100, "At most 100 characters"),
    description: z.string().refine(withinChars(500), "At most 500 characters"),
    discountType: z.enum(["PERCENTAGE", "FIXED"]),
    percent: z.number().nullable(),
    amount: z.number().int().nullable(),
    scope: z.enum(["ALL", "PRODUCTS", "CATEGORIES", "BRANDS"]),
    channel: z.enum(["ALL", "ONLINE", "POS"]),
    startsAt: z.string(),
    endsAt: z.string(),
    isActive: z.boolean(),
    priority: z.number({ error: "Enter a number from 0 to 1000" }).int("Use a whole number").min(0, "0 or more").max(1000, "At most 1000"),
    productIds: z.array(z.string()),
    categoryIds: z.array(z.string()),
    brandIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === "PERCENTAGE") {
      if (v.percent == null || v.percent <= 0) ctx.addIssue({ code: "custom", path: ["percent"], message: "Enter a percentage above 0" });
      else if (v.percent > 90) ctx.addIssue({ code: "custom", path: ["percent"], message: "Automatic discounts are capped at 90%" });
    } else if (v.amount == null || v.amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount above ₹0" });
    }
    if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Must be after the start" });
    if (v.scope === "PRODUCTS" && !v.productIds.length) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Select at least one product" });
    if (v.scope === "CATEGORIES" && !v.categoryIds.length) ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Select at least one category" });
    if (v.scope === "BRANDS" && !v.brandIds.length) ctx.addIssue({ code: "custom", path: ["brandIds"], message: "Select at least one brand" });
  });
type Values = z.infer<typeof schema>;
const FIELDS = ["name", "description", "discountType", "percent", "amount", "scope", "channel", "startsAt", "endsAt", "priority", "productIds", "categoryIds", "brandIds"] as const;
const TARGET_FIELD = { PRODUCTS: "productIds", CATEGORIES: "categoryIds", BRANDS: "brandIds" } as const;

/** Create (discountId = null) or edit an automatic discount. Editing loads its targets first. */
export function DiscountFormModal({ discountId, onClose }: { discountId: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ["admin", "discount", discountId], queryFn: () => api.get<DiscountDetail>(`/discounts/${discountId}`), enabled: !!discountId, gcTime: 0 });
  if (discountId && !q.data) {
    return (
      <Modal open onClose={onClose} title="Edit discount">
        {q.error ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Spinner label="Loading discount" />}
      </Modal>
    );
  }
  return <DiscountForm discount={q.data ?? null} onClose={onClose} />;
}

function DiscountForm({ discount, onClose }: { discount: DiscountDetail | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const targets = discount?.targets ?? [];
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: discount?.name ?? "",
      description: discount?.description ?? "",
      discountType: discount?.discountType ?? "PERCENTAGE",
      percent: discount?.discountType === "PERCENTAGE" ? discount.value / 100 : null,
      amount: discount?.discountType === "FIXED" ? discount.value : null,
      scope: discount?.scope ?? "ALL",
      channel: discount?.channel ?? "ALL",
      startsAt: toLocalInput(discount?.startsAt),
      endsAt: toLocalInput(discount?.endsAt),
      isActive: discount?.isActive ?? true,
      priority: discount?.priority ?? 0,
      productIds: targets.flatMap((t) => (t.productId ? [t.productId] : [])),
      categoryIds: targets.flatMap((t) => (t.categoryId ? [t.categoryId] : [])),
      brandIds: targets.flatMap((t) => (t.brandId ? [t.brandId] : [])),
    },
  });
  const discountType = useWatch({ control, name: "discountType" });
  const scope = useWatch({ control, name: "scope" });
  const labels = Object.fromEntries(targets.flatMap((t) => [t.product, t.category, t.brand].filter((x): x is { id: string; name: string } => !!x).map((x) => [x.id, x.name])));

  const submit = handleSubmit(async (v) => {
    const body = {
      name: v.name,
      description: v.description || null,
      discountType: v.discountType,
      value: v.discountType === "PERCENTAGE" ? Math.round((v.percent ?? 0) * 100) : (v.amount ?? 0),
      scope: v.scope,
      channel: v.channel,
      startsAt: fromLocalInput(v.startsAt),
      endsAt: fromLocalInput(v.endsAt),
      isActive: v.isActive,
      priority: v.priority,
      productIds: v.scope === "PRODUCTS" ? v.productIds : [],
      categoryIds: v.scope === "CATEGORIES" ? v.categoryIds : [],
      brandIds: v.scope === "BRANDS" ? v.brandIds : [],
    };
    try {
      if (discount) await api.put(`/discounts/${discount.id}`, body);
      else await api.post("/discounts", body);
      void qc.invalidateQueries({ queryKey: ["admin", "discounts"] });
      void qc.invalidateQueries({ queryKey: ["admin", "discount"] });
      toast(discount ? "Discount updated" : "Discount created");
      onClose();
    } catch (err) {
      applyApiErrors(err, setError, FIELDS, (p) => {
        if (p === "value") return v.discountType === "PERCENTAGE" ? "percent" : "amount";
        // A missing-target error is reported on "scope"; show it under the picker.
        if (p === "scope" && v.scope !== "ALL") return TARGET_FIELD[v.scope];
        return p;
      });
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={discount ? `Edit ${discount.name}` : "New automatic discount"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit}>
            {discount ? "Save changes" : "Create discount"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="d-name" required error={errors.name?.message} hint="Shown to customers next to the discounted price.">
            <Input id="d-name" autoFocus={!discount} invalid={!!errors.name} placeholder="e.g. Monsoon sale" {...register("name")} />
          </Field>
          <Field label="Priority" htmlFor="d-priority" error={errors.priority?.message} hint="0–1000. Breaks ties when two discounts give the same saving.">
            <Input id="d-priority" type="number" inputMode="numeric" min="0" max="1000" step="1" invalid={!!errors.priority} {...register("priority", { setValueAs: (x) => numberOrNull(x) ?? Number.NaN })} />
          </Field>
          <Field label="Description" htmlFor="d-desc" error={errors.description?.message} className="sm:col-span-2">
            <Controller
              control={control}
              name="description"
              render={({ field }) => <RichTextEditor id="d-desc" variant="compact" aria-label="Description" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.description} />}
            />
          </Field>
        </section>

        <section className="space-y-4 border-t border-black/5 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Discount</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="d-type">
              <Select id="d-type" {...register("discountType")}>
                <option value="PERCENTAGE">Percentage off the price</option>
                <option value="FIXED">Fixed amount off each unit</option>
              </Select>
            </Field>
            {discountType === "PERCENTAGE" ? (
              <Field label="Percentage" htmlFor="d-percent" required error={errors.percent?.message} hint="Up to 90%.">
                <div className="relative">
                  <Input id="d-percent" type="number" inputMode="decimal" step="0.01" min="0" max="90" invalid={!!errors.percent} className="pr-8" {...register("percent", { setValueAs: numberOrNull })} />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink/40">%</span>
                </div>
              </Field>
            ) : (
              <Field label="Amount per unit" htmlFor="d-amount" required error={errors.amount?.message} hint="Never more than the unit price.">
                <Controller control={control} name="amount" render={({ field }) => <MoneyInput id="d-amount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.amount} />} />
              </Field>
            )}
            <Field label="Starts" htmlFor="d-start" error={errors.startsAt?.message} hint="Empty = immediately">
              <Input id="d-start" type="datetime-local" invalid={!!errors.startsAt} {...register("startsAt")} />
            </Field>
            <Field label="Ends" htmlFor="d-end" error={errors.endsAt?.message} hint="Empty = no end date">
              <Input id="d-end" type="datetime-local" invalid={!!errors.endsAt} {...register("endsAt")} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 border-t border-black/5 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Applies to</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Items" htmlFor="d-scope" error={scope === "ALL" ? errors.scope?.message : undefined}>
              <Select id="d-scope" {...register("scope")}>
                <option value="ALL">All products</option>
                <option value="PRODUCTS">Selected products</option>
                <option value="CATEGORIES">Selected categories</option>
                <option value="BRANDS">Selected brands</option>
              </Select>
            </Field>
            <Field label="Channel" htmlFor="d-channel">
              <Select id="d-channel" {...register("channel")}>
                <option value="ALL">Online and in-store</option>
                <option value="ONLINE">Online only</option>
                <option value="POS">In-store (POS) only</option>
              </Select>
            </Field>
          </div>
          {scope === "PRODUCTS" && (
            <Field label="Products" htmlFor="d-products" required error={errors.productIds?.message}>
              <Controller control={control} name="productIds" render={({ field }) => <ProductPicker id="d-products" value={field.value} onChange={field.onChange} labels={labels} invalid={!!errors.productIds} />} />
            </Field>
          )}
          {scope === "CATEGORIES" && (
            <Field label="Categories" htmlFor="d-categories" required error={errors.categoryIds?.message} hint="Products in sub-categories are included.">
              <Controller control={control} name="categoryIds" render={({ field }) => <CategoryPicker id="d-categories" value={field.value} onChange={field.onChange} labels={labels} invalid={!!errors.categoryIds} />} />
            </Field>
          )}
          {scope === "BRANDS" && (
            <Field label="Brands" htmlFor="d-brands" required error={errors.brandIds?.message}>
              <Controller control={control} name="brandIds" render={({ field }) => <BrandPicker id="d-brands" value={field.value} onChange={field.onChange} labels={labels} invalid={!!errors.brandIds} />} />
            </Field>
          )}
        </section>

        <section className="border-t border-black/5 pt-5">
          <Checkbox label="Active" {...register("isActive")} />
        </section>

        {errors.root && <Notice tone="danger">{errors.root.message}</Notice>}
      </form>
    </Modal>
  );
}
