"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { CategoryNode, ImageView } from "@/lib/types";

// ---------------------------------------------------------------------------
// Enums shared with the API (prisma/schema.prisma in trendz-api)
// ---------------------------------------------------------------------------

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED", "DISCONTINUED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const VARIANT_STATUSES = ["ACTIVE", "INACTIVE", "DISCONTINUED"] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export const CODE_TYPES = ["QR", "EAN13", "UPC", "CODE128"] as const;
export type CodeType = (typeof CODE_TYPES)[number];

export const CODE_TYPE_LABELS: Record<CodeType, string> = { QR: "QR code", EAN13: "EAN-13", UPC: "UPC-A", CODE128: "Code 128" };

/** Mirrors MAX_CATEGORY_DEPTH in the API (0 = root, so up to 4 levels). */
export const MAX_CATEGORY_DEPTH = 3;

/** Mirrors MAX_IMAGES_PER_PRODUCT in the API. */
export const MAX_PRODUCT_IMAGES = 30;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface BrandOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface TaxClassOption {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  rates: { rateBps: number; minUnitPrice: number | null; maxUnitPrice: number | null; effectiveFrom: string; effectiveTo: string | null }[];
}

/** Row of GET /products. */
export interface ProductListRow {
  id: string;
  name: string;
  slug: string;
  baseSku: string;
  status: ProductStatus;
  mrp: number;
  sellingPrice: number;
  isFeatured: boolean;
  updatedAt: string;
  createdAt: string;
  category: { id: string; name: string };
  brand: { id: string; name: string } | null;
  image: ImageView | null;
  variantCount: number;
  available: number;
}

export interface WarehouseStock {
  id: string;
  code: string;
  name: string;
  onHand: number;
  reserved: number;
  damaged: number;
  available: number;
}

export interface AdminVariant {
  id: string;
  productId: string;
  sku: string;
  title: string;
  mrp: number;
  sellingPrice: number;
  costPrice: number | null;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  lowStockThreshold: number | null;
  status: VariantStatus;
  isDefault: boolean;
  position: number;
  options: Record<string, string>;
  stock: { onHand: number; reserved: number; available: number; lowStockThreshold: number; warehouses: WarehouseStock[] };
}

/** GET /products/:id */
export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  baseSku: string;
  description: string | null;
  shortDescription: string | null;
  categoryId: string;
  brandId: string | null;
  productType: string | null;
  status: ProductStatus;
  mrp: number;
  sellingPrice: number;
  taxClassId: string | null;
  hsnCode: string | null;
  minStockLevel: number;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  tags: string[];
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string };
  brand: { id: string; name: string; slug: string } | null;
  taxClass: { id: string; code: string; name: string } | null;
  options: { id: string; name: string; values: string[] }[];
  images: ImageView[];
  variants: AdminVariant[];
}

/** GET /products/:id/codes */
export interface ProductCode {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  codeType: CodeType;
  codeValue: string;
  qrPayload: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  variant?: { title: string };
}

// ---------------------------------------------------------------------------
// Query keys + lookups
// ---------------------------------------------------------------------------

export const catalogKeys = {
  products: ["admin", "products"] as const,
  product: (id: string) => ["admin", "product", id] as const,
  productCodes: (id: string) => ["admin", "product", id, "codes"] as const,
  categories: ["admin", "categories"] as const,
  category: (id: string) => ["admin", "category", id] as const,
  brands: ["admin", "brands"] as const,
  taxClasses: ["admin", "tax-classes"] as const,
};

export const useCategoryTree = (enabled = true) =>
  useQuery({ queryKey: catalogKeys.categories, queryFn: () => api.get<CategoryNode[]>("/categories"), enabled, staleTime: 60_000 });

export const useBrands = (enabled = true) => useQuery({ queryKey: catalogKeys.brands, queryFn: () => api.get<BrandOption[]>("/brands"), enabled, staleTime: 60_000 });

export const useTaxClasses = (enabled = true) =>
  useQuery({ queryKey: catalogKeys.taxClasses, queryFn: () => api.get<TaxClassOption[]>("/tax-classes"), enabled, staleTime: 60_000 });

// ---------------------------------------------------------------------------
// Category tree helpers
// ---------------------------------------------------------------------------

/** Depth-first list of every node (parents before children, siblings in order). */
export function flattenCategories(nodes: CategoryNode[] | undefined): CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (list: CategoryNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes ?? []);
  return out;
}

/** Indented label for <option> elements (options cannot contain markup). */
export const categoryOptionLabel = (c: Pick<CategoryNode, "name" | "depth" | "isActive">) =>
  `${"    ".repeat(c.depth)}${c.depth ? "└ " : ""}${c.name}${c.isActive ? "" : " (hidden)"}`;

/** <option> list for a category <select>, indented by depth. */
export function CategoryOptions({ tree, disabled }: { tree: CategoryNode[] | undefined; disabled?: (c: CategoryNode) => boolean }) {
  return (
    <>
      {flattenCategories(tree).map((c) => (
        <option key={c.id} value={c.id} disabled={disabled?.(c)}>
          {categoryOptionLabel(c)}
        </option>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** "" → null, "12" → 12 (inputs keep numbers as strings so they can be empty). */
export const intOrNull = (v: string | null | undefined) => (v == null || v.trim() === "" ? null : Number(v));
export const intToString = (v: number | null | undefined) => (v == null ? "" : String(v));

/**
 * Splits an API error into field errors the form knows about and a general
 * message for everything else (shown above the save button).
 */
export function splitApiErrors(err: unknown, mapPath: (path: string) => string | null): { fields: { path: string; message: string }[]; message: string | null } {
  if (!(err instanceof ApiError)) return { fields: [], message: errorMessage(err) };
  const fields: { path: string; message: string }[] = [];
  const general: string[] = [];
  for (const e of err.errors) {
    const path = mapPath(e.path);
    if (path) fields.push({ path, message: e.message });
    else general.push(e.path ? `${e.path}: ${e.message}` : e.message);
  }
  const message = fields.length && !general.length ? err.message : [err.message, ...general].filter(Boolean).join(" — ");
  return { fields, message: message || null };
}

/** Thumbnail with a neutral placeholder. */
export function Thumb({ src, alt = "", size = 40, className = "" }: { src: string | null | undefined; alt?: string; size?: number; className?: string }) {
  const style = { width: size, height: size };
  return src ? (
    <img src={src} alt={alt} style={style} className={`shrink-0 rounded-lg bg-offwhite object-cover ${className}`} loading="lazy" />
  ) : (
    <span style={style} className={`block shrink-0 rounded-lg bg-offwhite ${className}`} aria-hidden />
  );
}
