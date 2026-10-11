import { z } from "zod";
import { intOrNull, intToString, PRODUCT_STATUSES, VARIANT_STATUSES, type AdminProduct, type AdminVariant } from "./catalog-shared";
import { emptyVariant, missingCombinations, SKU_PATTERN, uid, type Exclusion, type OptionDraft, type VariantDraft } from "./catalog-variants";
import { withinChars } from "@/lib/rich-text";

/** Mirrors src/modules/catalog/products.schemas.ts in trendz-api (the API re-validates everything). */
const MAX_MONEY = 100_000_000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sku = z.string().trim().toUpperCase().regex(SKU_PATTERN, "3–40 characters: letters, digits and hyphens");
const wholeNumber = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d*$/, "Enter a whole number")
    .refine((v) => v === "" || Number(v) <= max, `At most ${max.toLocaleString("en-IN")}`);
const money = z.number().int().min(0, "Cannot be negative").max(MAX_MONEY, "Amount is too large").nullable();

export const parseTags = (raw: string) => [...new Set(raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];

const optionSchema = z.object({
  key: z.string(),
  name: z.string().trim().min(1, "Name this option").max(30, "At most 30 characters"),
  values: z.array(z.string()).min(1, "Add at least one value").max(50, "At most 50 values"),
});

const variantSchema = z.object({
  variantId: z.string().optional(),
  originalSku: z.string().optional(),
  values: z.record(z.string(), z.string()),
  sku,
  skuTouched: z.boolean(),
  mrp: money,
  sellingPrice: money,
  costPrice: money,
  weightGrams: wholeNumber(10_000_000),
  lowStockThreshold: wholeNumber(100_000),
  status: z.enum(VARIANT_STATUSES),
  isDefault: z.boolean(),
  lengthMm: z.number().nullable(),
  widthMm: z.number().nullable(),
  heightMm: z.number().nullable(),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "At least 2 characters").max(200, "At most 200 characters"),
    slug: z.string().trim().toLowerCase().max(100, "At most 100 characters").refine((v) => v === "" || SLUG.test(v), "Use lowercase letters, numbers and hyphens"),
    baseSku: sku,
    description: z.string().max(20_000, "At most 20,000 characters"),
    shortDescription: z.string().refine(withinChars(500), "At most 500 characters"),
    categoryId: z.string().min(1, "Choose a category"),
    brandId: z.string(),
    productType: z.string().trim().max(60, "At most 60 characters"),
    status: z.enum(PRODUCT_STATUSES),
    taxClassId: z.string(),
    hsnCode: z.string().trim().regex(/^(\d{4,8})?$/, "HSN/SAC codes are 4–8 digits"),
    minStockLevel: wholeNumber(100_000),
    weightGrams: wholeNumber(10_000_000),
    lengthMm: wholeNumber(10_000_000),
    widthMm: wholeNumber(10_000_000),
    heightMm: wholeNumber(10_000_000),
    tags: z.string().superRefine((raw, ctx) => {
      const tags = parseTags(raw);
      if (tags.length > 30) ctx.addIssue({ code: "custom", message: "At most 30 tags" });
      const long = tags.find((t) => t.length > 40);
      if (long) ctx.addIssue({ code: "custom", message: `"${long.slice(0, 20)}…" is longer than 40 characters` });
    }),
    isFeatured: z.boolean(),
    seoTitle: z.string().trim().max(70, "At most 70 characters"),
    seoDescription: z.string().trim().max(170, "At most 170 characters"),
    seoKeywords: z.string().trim().max(300, "At most 300 characters"),
    options: z.array(optionSchema).max(3, "At most 3 options"),
    variants: z.array(variantSchema).min(1, "Add at least one variant").max(200, "At most 200 variants per product"),
  })
  .superRefine((p, ctx) => {
    const names = p.options.map((o) => o.name.trim().toLowerCase());
    names.forEach((n, i) => {
      if (n && names.indexOf(n) !== i) ctx.addIssue({ code: "custom", path: ["options", i, "name"], message: "Option names must be unique" });
    });

    const skus = new Map<string, number>();
    p.variants.forEach((v, i) => {
      if (v.mrp == null) ctx.addIssue({ code: "custom", path: ["variants", i, "mrp"], message: "Enter the MRP" });
      if (v.sellingPrice == null) ctx.addIssue({ code: "custom", path: ["variants", i, "sellingPrice"], message: "Enter the price" });
      if (v.mrp != null && v.sellingPrice != null && v.sellingPrice > v.mrp) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "sellingPrice"], message: "Cannot exceed MRP" });
      }
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Duplicate SKU" });
      else skus.set(v.sku, i);
    });
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormOutput = z.output<typeof productFormSchema>;

export function emptyProductForm(): ProductFormInput {
  return {
    name: "",
    slug: "",
    baseSku: "",
    description: "",
    shortDescription: "",
    categoryId: "",
    brandId: "",
    productType: "",
    status: "DRAFT",
    taxClassId: "",
    hsnCode: "",
    minStockLevel: "",
    weightGrams: "",
    lengthMm: "",
    widthMm: "",
    heightMm: "",
    tags: "",
    isFeatured: false,
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    options: [],
    variants: [{ ...emptyVariant(), isDefault: true }],
  };
}

/** Variants of a product that are still part of its option matrix, and retired ones kept only for history. */
function splitVariants(p: AdminProduct): { live: AdminVariant[]; retired: AdminVariant[] } {
  if (p.options.length) {
    // Variants dropped from the matrix but referenced by orders/stock are discontinued and lose their option values.
    const complete = (v: AdminVariant) => p.options.every((o) => v.options[o.name] !== undefined);
    return { live: p.variants.filter(complete), retired: p.variants.filter((v) => !complete(v)) };
  }
  const main = p.variants.find((v) => v.isDefault) ?? p.variants.find((v) => v.status !== "DISCONTINUED") ?? p.variants[0];
  return { live: main ? [main] : [], retired: p.variants.filter((v) => v !== main) };
}

export function productToForm(p: AdminProduct): { values: ProductFormInput; exclusions: Exclusion[]; retired: AdminVariant[] } {
  const options: OptionDraft[] = p.options.map((o) => ({ key: uid(), name: o.name, values: [...o.values] }));
  const { live, retired } = splitVariants(p);
  const rows: VariantDraft[] = live.map((v) => ({
    variantId: v.id,
    originalSku: v.sku,
    values: Object.fromEntries(options.map((o) => [o.key, v.options[o.name]!])),
    sku: v.sku,
    skuTouched: true,
    mrp: v.mrp,
    sellingPrice: v.sellingPrice,
    costPrice: v.costPrice,
    weightGrams: intToString(v.weightGrams),
    lowStockThreshold: intToString(v.lowStockThreshold),
    status: v.status,
    isDefault: v.isDefault,
    lengthMm: v.lengthMm,
    widthMm: v.widthMm,
    heightMm: v.heightMm,
  }));
  if (!rows.length) rows.push({ ...emptyVariant(), isDefault: true });
  if (!rows.some((r) => r.isDefault)) rows[0] = { ...rows[0]!, isDefault: true };

  return {
    values: {
      name: p.name,
      slug: p.slug,
      baseSku: p.baseSku,
      description: p.description ?? "",
      shortDescription: p.shortDescription ?? "",
      categoryId: p.categoryId,
      brandId: p.brandId ?? "",
      productType: p.productType ?? "",
      status: p.status,
      taxClassId: p.taxClassId ?? "",
      hsnCode: p.hsnCode ?? "",
      minStockLevel: p.minStockLevel ? String(p.minStockLevel) : "",
      weightGrams: intToString(p.weightGrams),
      lengthMm: intToString(p.lengthMm),
      widthMm: intToString(p.widthMm),
      heightMm: intToString(p.heightMm),
      tags: p.tags.join(", "),
      isFeatured: p.isFeatured,
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      seoKeywords: p.seoKeywords ?? "",
      options,
      variants: rows,
    },
    exclusions: missingCombinations(options, rows),
    retired,
  };
}

/** Request body for POST /products and PUT /products/:id. */
export function formToPayload(v: ProductFormOutput) {
  return {
    name: v.name,
    slug: v.slug || undefined,
    baseSku: v.baseSku,
    description: v.description.trim() ? v.description : null,
    shortDescription: v.shortDescription || null,
    categoryId: v.categoryId,
    brandId: v.brandId || null,
    productType: v.productType || null,
    status: v.status,
    taxClassId: v.taxClassId || null,
    hsnCode: v.hsnCode || null,
    minStockLevel: intOrNull(v.minStockLevel) ?? 0,
    weightGrams: intOrNull(v.weightGrams),
    lengthMm: intOrNull(v.lengthMm),
    widthMm: intOrNull(v.widthMm),
    heightMm: intOrNull(v.heightMm),
    tags: parseTags(v.tags),
    isFeatured: v.isFeatured,
    seoTitle: v.seoTitle || null,
    seoDescription: v.seoDescription || null,
    seoKeywords: v.seoKeywords || null,
    options: v.options.map((o) => ({ name: o.name, values: o.values })),
    variants: v.variants.map((r) => ({
      id: r.variantId,
      sku: r.sku,
      options: Object.fromEntries(v.options.map((o) => [o.name, r.values[o.key] ?? ""])),
      mrp: r.mrp ?? 0,
      sellingPrice: r.sellingPrice ?? 0,
      costPrice: r.costPrice,
      weightGrams: intOrNull(r.weightGrams),
      lengthMm: r.lengthMm,
      widthMm: r.widthMm,
      heightMm: r.heightMm,
      lowStockThreshold: intOrNull(r.lowStockThreshold),
      status: r.status,
      isDefault: r.isDefault,
    })),
  };
}

/** Maps an API error path ("variants.0.sku", "tags.3") onto a form field, or null if the form has none. */
const PRODUCT_FIELDS = new Set([
  "name", "slug", "baseSku", "description", "shortDescription", "categoryId", "brandId", "productType", "status", "taxClassId", "hsnCode",
  "minStockLevel", "weightGrams", "lengthMm", "widthMm", "heightMm", "tags", "isFeatured", "seoTitle", "seoDescription", "seoKeywords",
]);
const VARIANT_FIELDS = new Set(["sku", "mrp", "sellingPrice", "costPrice", "weightGrams", "lowStockThreshold", "status"]);

export function mapProductErrorPath(path: string): string | null {
  const parts = path.split(".");
  const [head, index, field] = parts;
  if (head && PRODUCT_FIELDS.has(head)) return head;
  if (head === "variants" && index && /^\d+$/.test(index) && field && VARIANT_FIELDS.has(field)) return `variants.${index}.${field}`;
  if (head === "options" && index && /^\d+$/.test(index) && (field === "name" || field === "values")) return `options.${index}.${field}`;
  return null;
}
