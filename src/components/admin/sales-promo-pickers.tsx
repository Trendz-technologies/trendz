"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Loader2, Search, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { CategoryNode } from "@/lib/types";

interface Option {
  id: string;
  label: string;
  hint?: string;
  depth?: number;
}

interface PickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Names of already-selected ids (from the saved promotion). */
  labels?: Record<string, string>;
  invalid?: boolean;
  id?: string;
}

const toggle = (value: string[], id: string) => (value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

function Chips({ value, labels, onChange, noun }: { value: string[]; labels: Record<string, string>; onChange: (ids: string[]) => void; noun: string }) {
  if (!value.length) return <p className="text-xs text-ink/45">No {noun}s selected yet.</p>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((id) => (
        <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white">
          <span className="truncate">{labels[id] ?? `Unknown ${noun}`}</span>
          <button type="button" aria-label={`Remove ${labels[id] ?? noun}`} onClick={() => onChange(value.filter((x) => x !== id))} className="rounded-full opacity-70 hover:opacity-100">
            <X size={12} />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => onChange([])} className="text-xs text-ink/50 underline hover:text-ink">
        Clear all
      </button>
    </div>
  );
}

function FilterBox({ value, onChange, placeholder, id, busy }: { value: string; onChange: (v: string) => void; placeholder: string; id?: string; busy?: boolean }) {
  return (
    <div className="relative">
      {busy ? <Loader2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin text-ink/40" /> : <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />}
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Enter must not submit the surrounding promotion form.
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pl-9"
      />
    </div>
  );
}

function OptionList({ options, value, onToggle, empty, invalid }: { options: Option[]; value: string[]; onToggle: (o: Option) => void; empty: string; invalid?: boolean }) {
  return (
    <ul className={clsx("max-h-56 overflow-y-auto rounded-xl border bg-white", invalid ? "border-danger/60" : "border-black/10")}>
      {options.length === 0 && <li className="px-3.5 py-3 text-sm text-ink/45">{empty}</li>}
      {options.map((o) => (
        <li key={o.id}>
          <label className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-black/[0.02]" style={o.depth ? { paddingLeft: `${0.875 + o.depth * 1.1}rem` } : undefined}>
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-accent" checked={value.includes(o.id)} onChange={() => onToggle(o)} />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.hint && <span className="shrink-0 text-xs text-ink/40">{o.hint}</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}

interface ProductHit {
  id: string;
  name: string;
  baseSku: string;
  status: string;
}

/** Searchable product multi-select (searches the catalog as you type). */
export function ProductPicker({ value, onChange, labels: initial, invalid, id }: PickerProps) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>(initial ?? {});
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);
  const q = useQuery({
    queryKey: ["admin", "products", "picker", debounced],
    queryFn: () => api.page<ProductHit[]>("/products", { q: debounced || undefined, limit: 20, sort: "name" }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const options: Option[] = (q.data?.data ?? []).map((p) => ({ id: p.id, label: p.name, hint: p.status === "ACTIVE" ? p.baseSku : `${p.baseSku} · ${p.status.toLowerCase()}` }));

  return (
    <div className="space-y-2">
      <Chips value={value} labels={labels} onChange={onChange} noun="product" />
      <FilterBox id={id} value={term} onChange={setTerm} placeholder="Search products by name or SKU" busy={q.isFetching} />
      {q.error ? (
        <p className="text-xs text-danger">{errorMessage(q.error)}</p>
      ) : (
        <OptionList
          invalid={invalid}
          options={options}
          value={value}
          empty={q.isLoading ? "Loading…" : "No products match"}
          onToggle={(o) => {
            setLabels((l) => ({ ...l, [o.id]: o.label }));
            onChange(toggle(value, o.id));
          }}
        />
      )}
      {(q.data?.meta.total ?? 0) > options.length && <p className="text-xs text-ink/45">Showing {options.length} of {q.data?.meta.total}. Refine the search to find more.</p>}
    </div>
  );
}

function flatten(nodes: CategoryNode[], depth = 0, out: Option[] = []): Option[] {
  for (const n of nodes) {
    out.push({ id: n.id, label: n.name, depth, hint: n.isActive ? undefined : "hidden" });
    flatten(n.children, depth + 1, out);
  }
  return out;
}

/** Category multi-select over the full category tree. Selecting a parent covers its sub-categories. */
export function CategoryPicker({ value, onChange, labels: initial, invalid, id }: PickerProps) {
  const [filter, setFilter] = useState("");
  const q = useQuery({ queryKey: ["admin", "categories", "picker"], queryFn: () => api.get<CategoryNode[]>("/categories"), staleTime: 60_000 });
  const all = useMemo(() => flatten(q.data ?? []), [q.data]);
  const labels = useMemo(() => ({ ...initial, ...Object.fromEntries(all.map((o) => [o.id, o.label])) }), [all, initial]);
  const term = filter.trim().toLowerCase();
  const shown = term ? all.filter((o) => o.label.toLowerCase().includes(term)).map((o) => ({ ...o, depth: 0 })) : all;

  return (
    <div className="space-y-2">
      <Chips value={value} labels={labels} onChange={onChange} noun="category" />
      <FilterBox id={id} value={filter} onChange={setFilter} placeholder="Filter categories" />
      {q.error ? (
        <p className="text-xs text-danger">{errorMessage(q.error)}</p>
      ) : (
        <OptionList invalid={invalid} options={shown} value={value} empty={q.isLoading ? "Loading…" : "No categories match"} onToggle={(o) => onChange(toggle(value, o.id))} />
      )}
    </div>
  );
}

interface BrandHit {
  id: string;
  name: string;
  isActive: boolean;
  productCount: number;
}

/** Brand multi-select. */
export function BrandPicker({ value, onChange, labels: initial, invalid, id }: PickerProps) {
  const [filter, setFilter] = useState("");
  const q = useQuery({ queryKey: ["admin", "brands", "picker"], queryFn: () => api.get<BrandHit[]>("/brands"), staleTime: 60_000 });
  const all: Option[] = useMemo(() => (q.data ?? []).map((b) => ({ id: b.id, label: b.name, hint: b.isActive ? `${b.productCount} products` : "hidden" })), [q.data]);
  const labels = useMemo(() => ({ ...initial, ...Object.fromEntries(all.map((o) => [o.id, o.label])) }), [all, initial]);
  const term = filter.trim().toLowerCase();
  const shown = term ? all.filter((o) => o.label.toLowerCase().includes(term)) : all;

  return (
    <div className="space-y-2">
      <Chips value={value} labels={labels} onChange={onChange} noun="brand" />
      <FilterBox id={id} value={filter} onChange={setFilter} placeholder="Filter brands" />
      {q.error ? (
        <p className="text-xs text-danger">{errorMessage(q.error)}</p>
      ) : (
        <OptionList invalid={invalid} options={shown} value={value} empty={q.isLoading ? "Loading…" : "No brands match"} onToggle={(o) => onChange(toggle(value, o.id))} />
      )}
    </div>
  );
}
