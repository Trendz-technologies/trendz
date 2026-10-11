"use client";

import { useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Check, ChevronDown, ChevronRight, Package, Plus, Printer, QrCode, Trash2, X } from "lucide-react";
import { SearchInput } from "@/components/admin/page";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, Field, Input, Select, Spinner, Stat, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, download, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import { catalogKeys, CODE_TYPE_LABELS, CODE_TYPES, Thumb, type AdminProduct, type CodeType, type ProductListRow } from "./catalog-shared";

const PICKER_LIMIT = 20;

function useProductSearch(q: string) {
  return useQuery({
    queryKey: [...catalogKeys.products, "codes-picker", q],
    queryFn: () => api.page<ProductListRow[]>("/products", { q, limit: PICKER_LIMIT, sort: q ? "name" : "updated" }),
    placeholderData: keepPreviousData,
  });
}

function ProductResults({ q, renderRow, empty }: { q: string; renderRow: (p: ProductListRow) => ReactNode; empty?: string }) {
  const search = useProductSearch(q);
  if (search.error) return <ErrorState error={search.error} retry={() => search.refetch()} />;
  if (!search.data) return <Spinner />;
  const rows = search.data.data;
  if (!rows.length) return <EmptyState icon={<Package size={22} />} title={empty ?? "No products found"} />;
  return (
    <>
      <ul className={clsx("divide-y divide-black/[0.05]", search.isFetching && "opacity-60")}>{rows.map(renderRow)}</ul>
      {search.data.meta.total > rows.length && (
        <p className="pt-3 text-xs text-ink/45">
          Showing {rows.length} of {search.data.meta.total.toLocaleString("en-IN")}. Refine the search to find more.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bulk generate
// ---------------------------------------------------------------------------

const TYPE_HELP: Record<CodeType, string> = {
  QR: "Unique identifier for phone and POS scanning",
  EAN13: "13-digit retail barcode from your EAN prefix",
  UPC: "12-digit retail barcode (US/Canada)",
  CODE128: "Encodes the SKU itself",
};

export function BulkGenerate() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Map<string, ProductListRow>>(() => new Map());
  const [types, setTypes] = useState<Set<CodeType>>(() => new Set<CodeType>(["QR", "CODE128"]));
  const [result, setResult] = useState<{ variants: number; created: number; skipped: number } | null>(null);
  const search = useProductSearch(q);

  const toggle = (p: ProductListRow) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });
  const toggleType = (t: CodeType) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  const selectPage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const p of search.data?.data ?? []) next.set(p.id, p);
      return next;
    });

  const run = useMutation({
    mutationFn: () =>
      api.post<{ variants: number; created: number; skipped: number }>("/codes/bulk-generate", {
        productIds: [...selected.keys()],
        types: CODE_TYPES.filter((t) => types.has(t)),
      }),
    onSuccess: (r) => {
      setResult(r);
      toast(`${r.created} code${r.created === 1 ? "" : "s"} created`);
      void qc.invalidateQueries({ queryKey: ["admin", "product"] });
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const variantTotal = [...selected.values()].reduce((s, p) => s + p.variantCount, 0);
  const tooMany = selected.size > 500;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card
        title="1. Choose products"
        actions={
          (search.data?.data.length ?? 0) > 0 && (
            <Button variant="ghost" size="sm" onClick={selectPage}>
              Select all shown
            </Button>
          )
        }
      >
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, SKU or tag" className="mb-4 w-full" />
        <ProductResults
          q={q}
          renderRow={(p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={selected.has(p.id)} onChange={() => toggle(p)} />
                <Thumb src={p.image?.thumb ?? p.image?.url} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block font-mono text-xs text-ink/45">{p.baseSku}</span>
                </span>
                <span className="text-xs text-ink/50">
                  {p.variantCount} variant{p.variantCount === 1 ? "" : "s"}
                </span>
                <StatusBadge status={p.status} />
              </label>
            </li>
          )}
        />
      </Card>

      <div className="space-y-6">
        <Card
          title="2. Generate"
          actions={
            selected.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>
                Clear
              </Button>
            )
          }
        >
          <div className="space-y-5">
            {selected.size === 0 ? (
              <p className="text-sm text-ink/50">No products selected yet.</p>
            ) : (
              <div>
                <p className="mb-2 text-sm">
                  <span className="font-semibold">{selected.size}</span> product{selected.size === 1 ? "" : "s"} · {variantTotal} variant{variantTotal === 1 ? "" : "s"}
                </p>
                <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {[...selected.values()].map((p) => (
                    <li key={p.id} className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] py-1 pl-2.5 pr-1 text-xs font-medium">
                      <span className="max-w-40 truncate">{p.name}</span>
                      <button type="button" aria-label={`Remove ${p.name}`} onClick={() => toggle(p)} className="rounded-full p-0.5 text-ink/50 hover:bg-black/10 hover:text-ink">
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                {tooMany && <p className="mt-2 text-xs text-danger">At most 500 products per run.</p>}
              </div>
            )}
            <fieldset className="space-y-2.5">
              <legend className="label">Code types</legend>
              {CODE_TYPES.map((t) => (
                <div key={t}>
                  <Checkbox label={<span className="font-medium">{CODE_TYPE_LABELS[t]}</span>} checked={types.has(t)} onChange={() => toggleType(t)} />
                  <p className="ml-6 text-xs text-ink/45">{TYPE_HELP[t]}</p>
                </div>
              ))}
            </fieldset>
            <p className="text-xs text-ink/50">Variants that already have an active code of a type, and discontinued variants, are skipped.</p>
            <Button className="w-full" icon={<QrCode size={15} />} loading={run.isPending} disabled={!selected.size || !types.size || tooMany} onClick={() => run.mutate()}>
              Generate codes
            </Button>
          </div>
        </Card>
        {result && (
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Variants" value={result.variants} />
            <Stat label="Created" value={result.created} />
            <Stat label="Skipped" value={result.skipped} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Label printing
// ---------------------------------------------------------------------------

const LAYOUTS = {
  A4_3x8: { label: "A4 sheet · 3 × 8 (70 × 37 mm)", perPage: 24 },
  A4_2x5: { label: "A4 sheet · 2 × 5 (105 × 59 mm)", perPage: 10 },
  ROLL_50x25: { label: "Thermal roll · 50 × 25 mm", perPage: 1 },
  ROLL_38x25: { label: "Thermal roll · 38 × 25 mm", perPage: 1 },
} as const;
type Layout = keyof typeof LAYOUTS;
type PriceMode = "mrp" | "selling" | "both" | "none";
type BarcodeType = "EAN13" | "UPC" | "CODE128";

interface LabelItem {
  variantId: string;
  productName: string;
  title: string;
  sku: string;
  copies: number;
}

const MAX_LABELS = 5000;
const MAX_COPIES = 500;

export function LabelPrinter() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<LabelItem[]>([]);
  const [layout, setLayout] = useState<Layout>("A4_3x8");
  const [show, setShow] = useState({ name: true, variant: true, sku: true, qr: true, barcode: true });
  const [price, setPrice] = useState<PriceMode>("mrp");
  const [barcodeType, setBarcodeType] = useState<BarcodeType>("CODE128");
  const [busy, setBusy] = useState(false);

  const has = (variantId: string) => items.some((i) => i.variantId === variantId);
  const add = (list: LabelItem[]) => setItems((prev) => [...prev, ...list.filter((i) => !prev.some((p) => p.variantId === i.variantId))]);
  const removeItem = (variantId: string) => setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  const setCopies = (variantId: string, copies: number) => setItems((prev) => prev.map((i) => (i.variantId === variantId ? { ...i, copies } : i)));

  const total = items.reduce((s, i) => s + i.copies, 0);
  const pages = Math.ceil(total / LAYOUTS[layout].perPage);
  const tooMany = total > MAX_LABELS || items.length > 1000;
  const nothingShown = !show.name && !show.variant && !show.sku && !show.qr && !show.barcode && price === "none";

  const print = async () => {
    setBusy(true);
    try {
      await download("/codes/labels", `labels-${new Date().toISOString().slice(0, 10)}.pdf`, "POST", {
        items: items.map((i) => ({ variantId: i.variantId, copies: i.copies })),
        layout,
        show: { ...show, price },
        barcodeType,
      });
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <Card title="1. Choose variants">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, SKU or tag" className="mb-4 w-full" />
        <ProductResults
          q={q}
          renderRow={(p) => {
            const open = expanded === p.id;
            return (
              <li key={p.id}>
                <button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : p.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  {open ? <ChevronDown size={15} className="shrink-0 text-ink/50" /> : <ChevronRight size={15} className="shrink-0 text-ink/50" />}
                  <Thumb src={p.image?.thumb ?? p.image?.url} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block font-mono text-xs text-ink/45">{p.baseSku}</span>
                  </span>
                  <span className="text-xs text-ink/50">
                    {p.variantCount} variant{p.variantCount === 1 ? "" : "s"}
                  </span>
                </button>
                {open && <VariantPicker productId={p.id} has={has} onAdd={add} onRemove={removeItem} />}
              </li>
            );
          }}
        />
      </Card>

      <div className="space-y-6">
        <Card
          title="2. Label sheet"
          padded={false}
          actions={
            items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setItems([])}>
                Clear
              </Button>
            )
          }
        >
          {items.length === 0 ? (
            <p className="px-5 py-5 text-sm text-ink/50">Add variants from the list to print labels for them.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-black/[0.05] overflow-y-auto">
              {items.map((i) => (
                <li key={i.variantId} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.productName}</p>
                    <p className="truncate text-xs text-ink/50">
                      {i.title} · <span className="font-mono">{i.sku}</span>
                    </p>
                  </div>
                  <CopiesInput label={`Copies of ${i.sku}`} value={i.copies} onChange={(n) => setCopies(i.variantId, n)} />
                  <button type="button" aria-label={`Remove ${i.sku}`} onClick={() => removeItem(i.variantId)} className="rounded-full p-1.5 text-ink/45 hover:bg-black/5 hover:text-ink">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-black/5 px-5 py-3 text-xs text-ink/55">
            {total.toLocaleString("en-IN")} label{total === 1 ? "" : "s"}
            {total > 0 && ` · ${pages.toLocaleString("en-IN")} ${LAYOUTS[layout].perPage === 1 ? "label" : "page"}${pages === 1 ? "" : "s"}`}
            {tooMany && <span className="block text-danger">At most {MAX_LABELS.toLocaleString("en-IN")} labels per print.</span>}
          </div>
        </Card>

        <Card title="3. Layout">
          <div className="space-y-4">
            <Field label="Label stock" htmlFor="label-layout">
              <Select id="label-layout" value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>
                {(Object.keys(LAYOUTS) as Layout[]).map((l) => (
                  <option key={l} value={l}>
                    {LAYOUTS[l].label}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset>
              <legend className="label">Show on label</legend>
              <div className="grid grid-cols-2 gap-2">
                <Checkbox label="Product name" checked={show.name} onChange={(e) => setShow((s) => ({ ...s, name: e.target.checked }))} />
                <Checkbox label="Variant" checked={show.variant} onChange={(e) => setShow((s) => ({ ...s, variant: e.target.checked }))} />
                <Checkbox label="SKU" checked={show.sku} onChange={(e) => setShow((s) => ({ ...s, sku: e.target.checked }))} />
                <Checkbox label="QR code" checked={show.qr} onChange={(e) => setShow((s) => ({ ...s, qr: e.target.checked }))} />
                <Checkbox label="Barcode" checked={show.barcode} onChange={(e) => setShow((s) => ({ ...s, barcode: e.target.checked }))} />
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price" htmlFor="label-price">
                <Select id="label-price" value={price} onChange={(e) => setPrice(e.target.value as PriceMode)}>
                  <option value="mrp">MRP</option>
                  <option value="selling">Selling price</option>
                  <option value="both">MRP + selling</option>
                  <option value="none">No price</option>
                </Select>
              </Field>
              <Field label="Barcode type" htmlFor="label-barcode">
                <Select id="label-barcode" value={barcodeType} disabled={!show.barcode} onChange={(e) => setBarcodeType(e.target.value as BarcodeType)}>
                  <option value="CODE128">Code 128</option>
                  <option value="EAN13">EAN-13</option>
                  <option value="UPC">UPC-A</option>
                </Select>
              </Field>
            </div>
            <p className="text-xs text-ink/50">Variants without an active code of the chosen type print their SKU as a Code 128 barcode instead.</p>
            <Button className="w-full" icon={<Printer size={15} />} loading={busy} disabled={!items.length || tooMany || nothingShown} onClick={() => void print()}>
              Download labels PDF
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Number of copies (1–500); the text can be cleared while typing and snaps back on blur. */
function CopiesInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={1}
      max={MAX_COPIES}
      aria-label={label}
      className="h-8 w-20 py-1 text-right"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Math.floor(Number(e.target.value));
        if (n >= 1) onChange(Math.min(MAX_COPIES, n));
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

function VariantPicker({ productId, has, onAdd, onRemove }: { productId: string; has: (variantId: string) => boolean; onAdd: (items: LabelItem[]) => void; onRemove: (variantId: string) => void }) {
  const product = useQuery({ queryKey: catalogKeys.product(productId), queryFn: () => api.get<AdminProduct>(`/products/${productId}`) });
  if (product.error) return <ErrorState error={product.error} retry={() => product.refetch()} />;
  if (!product.data) return <Spinner className="py-4" />;
  const p = product.data;
  const toItem = (v: AdminProduct["variants"][number]): LabelItem => ({ variantId: v.id, productName: p.name, title: v.title, sku: v.sku, copies: 1 });
  const missing = p.variants.filter((v) => !has(v.id));

  return (
    <div className="mb-3 ml-7 rounded-2xl bg-offwhite/70 p-2">
      <ul>
        {p.variants.map((v) => {
          const added = has(v.id);
          return (
            <li key={v.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm">
                  {v.title}
                  {v.status !== "ACTIVE" && <StatusBadge status={v.status} />}
                </p>
                <p className="font-mono text-xs text-ink/45">
                  {v.sku} · {money(v.sellingPrice)} · {v.stock.available} in stock
                </p>
              </div>
              {added ? (
                <Button variant="ghost" size="sm" icon={<Check size={14} />} onClick={() => onRemove(v.id)} aria-label={`Remove ${v.sku} from the sheet`}>
                  Added
                </Button>
              ) : (
                <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => onAdd([toItem(v)])}>
                  Add
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {p.variants.length > 1 && missing.length > 0 && (
        <div className="px-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => onAdd(missing.map(toItem))}>
            Add all {missing.length} variants
          </Button>
        </div>
      )}
      {!p.variants.length && <Badge>No variants</Badge>}
    </div>
  );
}
