/**
 * Variant matrix logic for the product form (pure functions, no React).
 *
 * Options carry a stable client `key`, and each variant row stores its option
 * values by that key — so renaming an option never disturbs the rows, and
 * rows can be matched to the new combinations whenever values are added,
 * renamed or removed. Existing variants (with an id) are always preserved
 * when their combination still exists.
 */
import type { VariantStatus } from "./catalog-shared";

export interface OptionDraft {
  key: string;
  name: string;
  values: string[];
}

export interface VariantDraft {
  /** Id of an existing variant (sent back so the API updates instead of recreating it). */
  variantId?: string;
  /** SKU when loaded — a change needs the codes.manage permission. */
  originalSku?: string;
  /** Option key → value. */
  values: Record<string, string>;
  sku: string;
  /** The SKU was typed by hand: stop auto-suggesting it. */
  skuTouched: boolean;
  mrp: number | null;
  sellingPrice: number | null;
  costPrice: number | null;
  weightGrams: string;
  lowStockThreshold: string;
  status: VariantStatus;
  isDefault: boolean;
  // Not edited in the form, but carried through so a save does not clear them.
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
}

/** A removed combination (option key → value) that regeneration must not bring back. */
export type Exclusion = Record<string, string>;

let seq = 0;
export const uid = () => `o${(++seq).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$/;

const skuPart = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** BASESKU-VALUE-VALUE, uppercase, within the 40-character SKU limit. */
export function suggestSku(baseSku: string, options: OptionDraft[], values: Record<string, string>): string {
  const parts = [skuPart(baseSku), ...options.filter((o) => o.values.length).map((o) => skuPart(values[o.key] ?? ""))].filter(Boolean);
  return parts.join("-").slice(0, 40).replace(/-+$/, "");
}

export function emptyVariant(template?: VariantDraft): VariantDraft {
  return {
    values: {},
    sku: "",
    skuTouched: false,
    mrp: template?.mrp ?? null,
    sellingPrice: template?.sellingPrice ?? null,
    costPrice: template?.costPrice ?? null,
    weightGrams: template?.weightGrams ?? "",
    lowStockThreshold: template?.lowStockThreshold ?? "",
    status: "ACTIVE",
    isDefault: false,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
  };
}

/** Options that take part in the matrix (an option without values is still being typed). */
export const activeOptions = (options: OptionDraft[]) => options.filter((o) => o.values.length > 0);

export function combinations(options: OptionDraft[]): Record<string, string>[] {
  return activeOptions(options).reduce<Record<string, string>[]>((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.key]: v }))), [{}]);
}

export function isExcluded(combo: Record<string, string>, exclusions: Exclusion[]) {
  return exclusions.some((e) => {
    const entries = Object.entries(e);
    return entries.length > 0 && entries.every(([k, v]) => combo[k] === v);
  });
}

/** Label such as "Red / M" for a row. */
export const variantLabel = (options: OptionDraft[], values: Record<string, string>) =>
  activeOptions(options)
    .map((o) => values[o.key])
    .filter(Boolean)
    .join(" / ") || "Default";

/**
 * Rebuilds the variant rows for the current options: one row per combination
 * (minus exclusions), reusing existing rows whose values match — exactly
 * first, then rows that simply lack a value for a newly added option.
 */
export function buildMatrix(options: OptionDraft[], rows: VariantDraft[], exclusions: Exclusion[], baseSku: string): VariantDraft[] {
  const active = activeOptions(options);
  // Preference when several rows collapse into one combination: default, then saved, then new.
  const candidates = [...rows].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || Number(!!b.variantId) - Number(!!a.variantId));
  const template = candidates[0];

  let next: VariantDraft[];
  if (!active.length) {
    const keep = template ? { ...template, values: {} } : emptyVariant();
    next = [{ ...keep, sku: keep.variantId || keep.skuTouched ? keep.sku : suggestSku(baseSku, [], {}) }];
  } else {
    const keys = active.map((o) => o.key);
    const combos = combinations(options).filter((c) => !isExcluded(c, exclusions));
    const used = new Set<VariantDraft>();
    const matches = (row: VariantDraft, combo: Record<string, string>, exact: boolean) =>
      keys.every((k) => row.values[k] === combo[k] || (!exact && row.values[k] === undefined));
    const picked: (VariantDraft | undefined)[] = combos.map((c) => {
      const row = candidates.find((r) => !used.has(r) && matches(r, c, true));
      if (row) used.add(row);
      return row;
    });
    combos.forEach((c, i) => {
      if (picked[i]) return;
      const row = candidates.find((r) => !used.has(r) && matches(r, c, false));
      if (row) {
        used.add(row);
        picked[i] = row;
      }
    });
    next = combos.map((c, i) => {
      const values = Object.fromEntries(keys.map((k) => [k, c[k]!]));
      const row = picked[i] ?? emptyVariant(template);
      const sku = row.variantId || row.skuTouched ? row.sku : suggestSku(baseSku, active, values);
      return { ...row, values, sku };
    });
  }

  // Exactly one default.
  let seen = false;
  next = next.map((r) => {
    const isDefault = r.isDefault && !seen;
    if (isDefault) seen = true;
    return isDefault === r.isDefault ? r : { ...r, isDefault };
  });
  if (!seen && next[0]) next[0] = { ...next[0], isDefault: true };
  return next;
}

/** Combinations that have no row: treated as deliberately removed when a product is loaded. */
export function missingCombinations(options: OptionDraft[], rows: VariantDraft[]): Exclusion[] {
  const active = activeOptions(options);
  if (!active.length) return [];
  return combinations(options).filter((c) => !rows.some((r) => active.every((o) => r.values[o.key] === c[o.key])));
}
