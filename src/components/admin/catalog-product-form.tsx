"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch, type Control, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { uploadProductImage } from "@/lib/upload";
import { useAuth } from "@/lib/auth";
import { percent } from "@/lib/format";
import {
  catalogKeys,
  CategoryOptions,
  PRODUCT_STATUSES,
  splitApiErrors,
  useBrands,
  useCategoryTree,
  useTaxClasses,
  type AdminProduct,
  type ProductStatus,
} from "./catalog-shared";
import { emptyProductForm, formToPayload, mapProductErrorPath, productFormSchema, productToForm, type ProductFormInput, type ProductFormOutput } from "./catalog-product-schema";
import { OptionsAndVariants, syncSuggestedSkus } from "./catalog-product-variants";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

type AiProductDraft = { name: string; productType: string; shortDescription: string; description: string; seoTitle: string; seoDescription: string; seoKeywords: string; tags: string[]; generatedImageBase64: string; generatedImageMimeType: string; generatedImageBytes: number };

const STATUS_HELP: Record<ProductStatus, string> = {
  DRAFT: "Hidden from the storefront while you work on it.",
  ACTIVE: "Visible and purchasable on the storefront.",
  ARCHIVED: "Hidden from the storefront; kept for reporting.",
  DISCONTINUED: "No longer sold; kept for order history.",
};

/** Create / edit form for a product, its options and variant matrix. */
export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("products.write");

  // Initialised once: later refetches (e.g. image polling) must not wipe unsaved edits.
  const [initial] = useState(() => (product ? productToForm(product) : { values: emptyProductForm(), exclusions: [], retired: [] }));
  const [exclusions, setExclusions] = useState(initial.exclusions);
  const [retired, setRetired] = useState(initial.retired);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [aiDraft, setAiDraft] = useState<AiProductDraft | null>(null);
  const [generating, setGenerating] = useState(false);

  const form = useForm<ProductFormInput, unknown, ProductFormOutput>({ resolver: zodResolver(productFormSchema), defaultValues: initial.values });
  const {
    control,
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const categories = useCategoryTree();
  const brands = useBrands();
  const taxClasses = useTaxClasses();
  const status = useWatch({ control, name: "status" });

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const onSubmit = handleSubmit(
    async (values) => {
      const body = formToPayload(values);
      try {
        const saved = product ? await api.put<AdminProduct>(`/products/${product.id}`, body) : await api.post<AdminProduct>("/products", body);
        qc.setQueryData(catalogKeys.product(saved.id), saved);
        void qc.invalidateQueries({ queryKey: catalogKeys.products });
        void qc.invalidateQueries({ queryKey: catalogKeys.categories });
        if (product) {
          const next = productToForm(saved);
          reset(next.values);
          setExclusions(next.exclusions);
          setRetired(next.retired);
          void qc.invalidateQueries({ queryKey: catalogKeys.productCodes(saved.id) });
          toast("Product saved");
        } else {
          toast("Product created. Add images and codes next.");
          router.replace(`/admin/products/${saved.id}`);
        }
      } catch (err) {
        const { fields, message } = splitApiErrors(err, mapProductErrorPath);
        for (const f of fields) setError(f.path as FieldPath<ProductFormInput>, { message: f.message });
        setError("root", { message: message ?? "Could not save the product" });
        toast(message ?? errorMessage(err), "error");
      }
    },
    () => toast("Some fields need attention", "error"),
  );

  const taxOptions = taxClasses.data ?? [];

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={!canWrite} className="min-w-0 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <Card title="Basics">
              <div className="space-y-4">
                <Field label="Name" htmlFor="p-name" error={errors.name?.message} required>
                  <Input id="p-name" invalid={!!errors.name} {...register("name")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Base SKU" htmlFor="p-sku" error={errors.baseSku?.message} hint="Style code; variant SKUs are suggested from it" required>
                    <Input
                      id="p-sku"
                      className="font-mono uppercase"
                      invalid={!!errors.baseSku}
                      {...register("baseSku", { onChange: (e: { target: { value: string } }) => syncSuggestedSkus(form, e.target.value) })}
                    />
                  </Field>
                  <Field label="URL slug" htmlFor="p-slug" error={errors.slug?.message} hint={product ? "Changing it breaks existing links" : "Leave empty to generate from the name"}>
                    <Input id="p-slug" invalid={!!errors.slug} {...register("slug")} />
                  </Field>
                </div>
                <Field label="Short description" htmlFor="p-short" error={errors.shortDescription?.message} hint="One or two lines shown near the price">
                  <Controller
                    control={control}
                    name="shortDescription"
                    render={({ field }) => (
                      <RichTextEditor id="p-short" variant="compact" aria-label="Short description" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.shortDescription} disabled={!canWrite} />
                    )}
                  />
                </Field>
                <Field label="Description" htmlFor="p-description" error={errors.description?.message} hint="Shown on the product page. Use the toolbar for headings, lists and links.">
                  <Controller
                    control={control}
                    name="description"
                    render={({ field }) => (
                      <RichTextEditor id="p-description" aria-label="Description" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.description} disabled={!canWrite} />
                    )}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Search engine listing">
              <div className="space-y-4">
                <Field label="SEO title" htmlFor="p-seo-title" error={errors.seoTitle?.message} hint="Defaults to the product name">
                  <Input id="p-seo-title" invalid={!!errors.seoTitle} {...register("seoTitle")} />
                  <Counter control={control} name="seoTitle" max={70} />
                </Field>
                <Field label="SEO description" htmlFor="p-seo-desc" error={errors.seoDescription?.message}>
                  <Textarea id="p-seo-desc" rows={3} className="min-h-20" invalid={!!errors.seoDescription} {...register("seoDescription")} />
                  <Counter control={control} name="seoDescription" max={170} />
                </Field>
                <Field label="SEO keywords" htmlFor="p-seo-keywords" error={errors.seoKeywords?.message} hint="Comma separated">
                  <Input id="p-seo-keywords" invalid={!!errors.seoKeywords} {...register("seoKeywords")} />
                </Field>
              </div>
            </Card>
          </div>

          <div className="min-w-0 space-y-6">
            <Card title="Status">
              <div className="space-y-3">
                <Field label="Product status" htmlFor="p-status" error={errors.status?.message} hint={status ? STATUS_HELP[status] : undefined}>
                  <Select id="p-status" {...register("status")}>
                    {PRODUCT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Checkbox label="Featured on the storefront" {...register("isFeatured")} />
              </div>
            </Card>

            <Card title="Organisation">
              <div className="space-y-4">
                <Field label="Category" htmlFor="p-category" error={errors.categoryId?.message ?? (categories.error ? errorMessage(categories.error) : undefined)} required>
                  {/* Controlled, so the saved value shows once the options have loaded. */}
                  <Controller
                    control={control}
                    name="categoryId"
                    render={({ field }) => (
                      <Select id="p-category" invalid={!!errors.categoryId} {...field}>
                        <option value="">{categories.isLoading ? "Loading…" : "Choose a category"}</option>
                        {product && !categories.data && <option value={product.category.id}>{product.category.name}</option>}
                        <CategoryOptions tree={categories.data} />
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Brand" htmlFor="p-brand" error={errors.brandId?.message ?? (brands.error ? errorMessage(brands.error) : undefined)}>
                  <Controller
                    control={control}
                    name="brandId"
                    render={({ field }) => (
                      <Select id="p-brand" {...field}>
                        <option value="">No brand</option>
                        {product?.brand && !brands.data?.some((b) => b.id === product.brand?.id) && <option value={product.brand.id}>{product.brand.name}</option>}
                        {brands.data?.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                            {b.isActive ? "" : " (hidden)"}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Product type" htmlFor="p-type" error={errors.productType?.message} hint="e.g. T-shirt, Sneakers">
                  <Input id="p-type" invalid={!!errors.productType} {...register("productType")} />
                </Field>
                <Field label="Tags" htmlFor="p-tags" error={errors.tags?.message} hint="Comma separated, e.g. summer, cotton">
                  <Input id="p-tags" invalid={!!errors.tags} {...register("tags")} />
                </Field>
              </div>
            </Card>

            <Card title="Tax">
              <div className="space-y-4">
                <Field label="Tax class" htmlFor="p-tax" error={errors.taxClassId?.message}>
                  <Controller
                    control={control}
                    name="taxClassId"
                    render={({ field }) => (
                      <Select id="p-tax" {...field}>
                        <option value="">Store default</option>
                        {product?.taxClass && !taxOptions.some((t) => t.id === product.taxClass?.id) && <option value={product.taxClass.id}>{product.taxClass.name}</option>}
                        {taxOptions.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {t.rates.length === 1 ? ` (${percent(t.rates[0]!.rateBps)})` : t.rates.length > 1 ? " (slabs)" : ""}
                            {t.isDefault ? " · default" : ""}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                </Field>
                <Field label="HSN / SAC code" htmlFor="p-hsn" error={errors.hsnCode?.message} hint="4–8 digits, printed on invoices">
                  <Input id="p-hsn" inputMode="numeric" invalid={!!errors.hsnCode} {...register("hsnCode")} />
                </Field>
              </div>
            </Card>

            <Card title="Shipping & stock">
              <div className="space-y-4">
                <Field label="Minimum stock level" htmlFor="p-min-stock" error={errors.minStockLevel?.message} hint="Variants at or below this are flagged as low stock">
                  <Input id="p-min-stock" inputMode="numeric" placeholder="0" invalid={!!errors.minStockLevel} {...register("minStockLevel")} />
                </Field>
                <Field label="Weight (g)" htmlFor="p-weight" error={errors.weightGrams?.message}>
                  <Input id="p-weight" inputMode="numeric" invalid={!!errors.weightGrams} {...register("weightGrams")} />
                </Field>
                <div>
                  <span className="label">Package dimensions (mm)</span>
                  <div className="grid grid-cols-3 gap-2">
                    <Input aria-label="Length in mm" placeholder="L" inputMode="numeric" invalid={!!errors.lengthMm} {...register("lengthMm")} />
                    <Input aria-label="Width in mm" placeholder="W" inputMode="numeric" invalid={!!errors.widthMm} {...register("widthMm")} />
                    <Input aria-label="Height in mm" placeholder="H" inputMode="numeric" invalid={!!errors.heightMm} {...register("heightMm")} />
                  </div>
                  {(errors.lengthMm ?? errors.widthMm ?? errors.heightMm)?.message && (
                    <p className="mt-1 text-xs text-danger">{(errors.lengthMm ?? errors.widthMm ?? errors.heightMm)?.message}</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div>
          <OptionsAndVariants form={form} exclusions={exclusions} onExclusionsChange={setExclusions} retired={retired} canManageCodes={can("codes.manage")} />
        </div>
      </fieldset>

      {canWrite && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-black/5 bg-offwhite/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {errors.root?.message ? (
              <p role="alert" className="mr-auto max-w-2xl text-sm text-danger">
                {errors.root.message}
              </p>
            ) : (
              isDirty && <p className="mr-auto text-xs text-ink/50">Unsaved changes</p>
            )}
            <Button variant="ghost" onClick={() => router.push("/admin/products")}>
              {isDirty ? "Discard" : "Back"}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {product ? "Save product" : "Create product"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

function Counter({ control, name, max }: { control: Control<ProductFormInput, unknown, ProductFormOutput>; name: "seoTitle" | "seoDescription"; max: number }) {
  const value = useWatch({ control, name }) ?? "";
  const length = value.trim().length;
  return (
    <p className={`mt-1 text-right text-[11px] tabular-nums ${length > max ? "text-danger" : "text-ink/40"}`}>
      {length}/{max}
    </p>
  );
}
