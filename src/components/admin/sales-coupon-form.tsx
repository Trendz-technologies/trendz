"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Checkbox, ErrorState, Field, Input, Modal, MoneyInput, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { CategoryPicker, ProductPicker } from "./sales-promo-pickers";
import { applyApiErrors, fromLocalInput, Notice, numberOrNull, toLocalInput } from "./sales-shared";
import type { CouponDetail } from "./sales-types";

const positiveIntOrNull = z.number().int("Use a whole number").positive("Must be at least 1").nullable();

const schema = z
  .object({
    code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,30}$/, "3–30 letters, digits, - or _"),
    description: z.string().trim().max(300, "At most 300 characters"),
    discountType: z.enum(["PERCENTAGE", "FIXED"]),
    percent: z.number().nullable(),
    amount: z.number().int().nullable(),
    minOrderAmount: z.number().int().min(0).nullable(),
    maxDiscountAmount: z.number().int().nullable(),
    startsAt: z.string(),
    expiresAt: z.string(),
    usageLimit: positiveIntOrNull,
    perUserLimit: positiveIntOrNull,
    scope: z.enum(["ALL", "PRODUCTS", "CATEGORIES"]),
    channel: z.enum(["ALL", "ONLINE", "POS"]),
    isActive: z.boolean(),
    isPublic: z.boolean(),
    productIds: z.array(z.string()),
    categoryIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === "PERCENTAGE") {
      if (v.percent == null || v.percent <= 0) ctx.addIssue({ code: "custom", path: ["percent"], message: "Enter a percentage above 0" });
      else if (v.percent > 100) ctx.addIssue({ code: "custom", path: ["percent"], message: "Cannot exceed 100%" });
      if (v.maxDiscountAmount != null && v.maxDiscountAmount <= 0) ctx.addIssue({ code: "custom", path: ["maxDiscountAmount"], message: "Enter an amount above ₹0 or leave empty" });
    } else if (v.amount == null || v.amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount above ₹0" });
    }
    if (v.startsAt && v.expiresAt && new Date(v.expiresAt) <= new Date(v.startsAt)) ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Must be after the start" });
    if (v.usageLimit != null && v.perUserLimit != null && v.perUserLimit > v.usageLimit) ctx.addIssue({ code: "custom", path: ["perUserLimit"], message: "Cannot exceed the total limit" });
    if (v.scope === "PRODUCTS" && !v.productIds.length) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Select at least one product" });
    if (v.scope === "CATEGORIES" && !v.categoryIds.length) ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Select at least one category" });
  });
type Values = z.infer<typeof schema>;
const FIELDS = ["code", "description", "discountType", "percent", "amount", "minOrderAmount", "maxDiscountAmount", "startsAt", "expiresAt", "usageLimit", "perUserLimit", "scope", "channel", "productIds", "categoryIds"] as const;

/** Create (couponId = null) or edit a coupon. Editing loads the coupon with its products and categories first. */
export function CouponFormModal({ couponId, onClose }: { couponId: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ["admin", "coupon", couponId], queryFn: () => api.get<CouponDetail>(`/coupons/${couponId}`), enabled: !!couponId, gcTime: 0 });
  if (couponId && !q.data) {
    return (
      <Modal open onClose={onClose} title="Edit coupon">
        {q.error ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Spinner label="Loading coupon" />}
      </Modal>
    );
  }
  return <CouponForm coupon={q.data ?? null} onClose={onClose} />;
}

function CouponForm({ coupon, onClose }: { coupon: CouponDetail | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: coupon?.code ?? "",
      description: coupon?.description ?? "",
      discountType: coupon?.discountType ?? "PERCENTAGE",
      percent: coupon?.discountType === "PERCENTAGE" ? coupon.value / 100 : null,
      amount: coupon?.discountType === "FIXED" ? coupon.value : null,
      minOrderAmount: coupon?.minOrderAmount ?? null,
      maxDiscountAmount: coupon?.maxDiscountAmount ?? null,
      startsAt: toLocalInput(coupon?.startsAt),
      expiresAt: toLocalInput(coupon?.expiresAt),
      usageLimit: coupon?.usageLimit ?? null,
      perUserLimit: coupon?.perUserLimit ?? null,
      scope: coupon?.scope ?? "ALL",
      channel: coupon?.channel ?? "ALL",
      isActive: coupon?.isActive ?? true,
      isPublic: coupon?.isPublic ?? false,
      productIds: coupon?.products.map((p) => p.productId) ?? [],
      categoryIds: coupon?.categories.map((c) => c.categoryId) ?? [],
    },
  });
  const discountType = useWatch({ control, name: "discountType" });
  const scope = useWatch({ control, name: "scope" });
  const productLabels = Object.fromEntries(coupon?.products.map((p) => [p.productId, p.product.name]) ?? []);
  const categoryLabels = Object.fromEntries(coupon?.categories.map((c) => [c.categoryId, c.category.name]) ?? []);

  const submit = handleSubmit(async (v) => {
    const body = {
      code: v.code.trim().toUpperCase(),
      description: v.description || null,
      discountType: v.discountType,
      value: v.discountType === "PERCENTAGE" ? Math.round((v.percent ?? 0) * 100) : (v.amount ?? 0),
      minOrderAmount: v.minOrderAmount,
      maxDiscountAmount: v.discountType === "PERCENTAGE" ? v.maxDiscountAmount : null,
      startsAt: fromLocalInput(v.startsAt),
      expiresAt: fromLocalInput(v.expiresAt),
      usageLimit: v.usageLimit,
      perUserLimit: v.perUserLimit,
      scope: v.scope,
      channel: v.channel,
      isActive: v.isActive,
      isPublic: v.isPublic,
      productIds: v.scope === "PRODUCTS" ? v.productIds : [],
      categoryIds: v.scope === "CATEGORIES" ? v.categoryIds : [],
    };
    try {
      if (coupon) await api.put(`/coupons/${coupon.id}`, body);
      else await api.post("/coupons", body);
      void qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
      void qc.invalidateQueries({ queryKey: ["admin", "coupon"] });
      toast(coupon ? `Coupon ${body.code} updated` : `Coupon ${body.code} created`);
      onClose();
    } catch (err) {
      applyApiErrors(err, setError, FIELDS, (p) => (p === "value" ? (v.discountType === "PERCENTAGE" ? "percent" : "amount") : p));
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={coupon ? `Edit ${coupon.code}` : "New coupon"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit}>
            {coupon ? "Save changes" : "Create coupon"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        {coupon && coupon.redemptions > 0 && <Notice>This coupon has been used {coupon.redemptions} time(s). Changes apply to future orders only.</Notice>}

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="c-code" required error={errors.code?.message} hint="Customers type this at checkout. Saved in capitals.">
            <Input id="c-code" autoFocus={!coupon} invalid={!!errors.code} className="font-mono uppercase" autoComplete="off" {...register("code")} />
          </Field>
          <Field label="Description" htmlFor="c-desc" error={errors.description?.message} hint="Shown on the storefront offers page for public coupons.">
            <Input id="c-desc" invalid={!!errors.description} placeholder="e.g. 10% off your first order" {...register("description")} />
          </Field>
        </section>

        <section className="space-y-4 border-t border-black/5 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Discount</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="c-type">
              <Select id="c-type" {...register("discountType")}>
                <option value="PERCENTAGE">Percentage of the order</option>
                <option value="FIXED">Fixed amount off the order</option>
              </Select>
            </Field>
            {discountType === "PERCENTAGE" ? (
              <Field label="Percentage" htmlFor="c-percent" required error={errors.percent?.message}>
                <div className="relative">
                  <Input id="c-percent" type="number" inputMode="decimal" step="0.01" min="0" max="100" invalid={!!errors.percent} className="pr-8" {...register("percent", { setValueAs: numberOrNull })} />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink/40">%</span>
                </div>
              </Field>
            ) : (
              <Field label="Amount" htmlFor="c-amount" required error={errors.amount?.message}>
                <Controller control={control} name="amount" render={({ field }) => <MoneyInput id="c-amount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.amount} />} />
              </Field>
            )}
            <Field label="Minimum order value" htmlFor="c-min" error={errors.minOrderAmount?.message} hint="Optional. Value of eligible items needed to use the coupon.">
              <Controller control={control} name="minOrderAmount" render={({ field }) => <MoneyInput id="c-min" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.minOrderAmount} />} />
            </Field>
            {discountType === "PERCENTAGE" && (
              <Field label="Maximum discount" htmlFor="c-max" error={errors.maxDiscountAmount?.message} hint="Optional cap on the discount amount.">
                <Controller control={control} name="maxDiscountAmount" render={({ field }) => <MoneyInput id="c-max" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.maxDiscountAmount} />} />
              </Field>
            )}
          </div>
        </section>

        <section className="space-y-4 border-t border-black/5 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Validity & limits</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="c-start" error={errors.startsAt?.message} hint="Empty = immediately">
              <Input id="c-start" type="datetime-local" invalid={!!errors.startsAt} {...register("startsAt")} />
            </Field>
            <Field label="Expires" htmlFor="c-end" error={errors.expiresAt?.message} hint="Empty = never">
              <Input id="c-end" type="datetime-local" invalid={!!errors.expiresAt} {...register("expiresAt")} />
            </Field>
            <Field label="Total uses" htmlFor="c-usage" error={errors.usageLimit?.message} hint="Empty = unlimited">
              <Input id="c-usage" type="number" inputMode="numeric" min="1" step="1" invalid={!!errors.usageLimit} {...register("usageLimit", { setValueAs: numberOrNull })} />
            </Field>
            <Field label="Uses per customer" htmlFor="c-per-user" error={errors.perUserLimit?.message} hint="Empty = unlimited">
              <Input id="c-per-user" type="number" inputMode="numeric" min="1" step="1" invalid={!!errors.perUserLimit} {...register("perUserLimit", { setValueAs: numberOrNull })} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 border-t border-black/5 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Applies to</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Items" htmlFor="c-scope">
              <Select id="c-scope" {...register("scope")}>
                <option value="ALL">Whole order</option>
                <option value="PRODUCTS">Selected products</option>
                <option value="CATEGORIES">Selected categories</option>
              </Select>
            </Field>
            <Field label="Channel" htmlFor="c-channel">
              <Select id="c-channel" {...register("channel")}>
                <option value="ALL">Online and in-store</option>
                <option value="ONLINE">Online only</option>
                <option value="POS">In-store (POS) only</option>
              </Select>
            </Field>
          </div>
          {scope === "PRODUCTS" && (
            <Field label="Products" htmlFor="c-products" required error={errors.productIds?.message}>
              <Controller control={control} name="productIds" render={({ field }) => <ProductPicker id="c-products" value={field.value} onChange={field.onChange} labels={productLabels} invalid={!!errors.productIds} />} />
            </Field>
          )}
          {scope === "CATEGORIES" && (
            <Field label="Categories" htmlFor="c-categories" required error={errors.categoryIds?.message} hint="Products in sub-categories are included.">
              <Controller control={control} name="categoryIds" render={({ field }) => <CategoryPicker id="c-categories" value={field.value} onChange={field.onChange} labels={categoryLabels} invalid={!!errors.categoryIds} />} />
            </Field>
          )}
        </section>

        <section className="flex flex-col gap-3 border-t border-black/5 pt-5 sm:flex-row sm:gap-8">
          <Checkbox label="Active" {...register("isActive")} />
          <Checkbox label="Public — list it on the storefront offers page" {...register("isPublic")} />
        </section>

        {errors.root && <Notice tone="danger">{errors.root.message}</Notice>}
      </form>
    </Modal>
  );
}
