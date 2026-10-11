"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Loader2, Search } from "lucide-react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { Badge } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { IndianState, LevelRow, LevelStatus, VariantStock, Warehouse } from "./inventory-types";

// ---------------------------------------------------------------------------
// Data hooks (shared query keys so lists, pickers and forms reuse the cache)
// ---------------------------------------------------------------------------

export function useWarehouses() {
  return useQuery({ queryKey: ["admin", "warehouses"], queryFn: () => api.get<Warehouse[]>("/warehouses"), staleTime: 60_000 });
}

export function useIndianStates() {
  return useQuery({
    queryKey: ["admin", "store-config"],
    queryFn: () => api.get<{ states: IndianState[] }>("/store/config"),
    staleTime: Infinity,
    select: (d) => d.states,
  });
}

export function useVariantStock(variantId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin", "inventory", "variant", variantId],
    queryFn: () => api.get<VariantStock>(`/inventory/variants/${variantId}`),
    enabled: !!variantId,
    staleTime: 10_000,
  });
}

/** Renders <option>s for the warehouse list (use inside a <Select>). */
export function WarehouseOptions({ activeOnly, exclude }: { activeOnly?: boolean; exclude?: string }) {
  const { data } = useWarehouses();
  return (
    <>
      {(data ?? [])
        .filter((w) => (!activeOnly || w.status === "ACTIVE") && w.id !== exclude)
        .map((w) => (
          <option key={w.id} value={w.id}>
            {w.code} · {w.name}
            {w.status !== "ACTIVE" ? " (inactive)" : ""}
          </option>
        ))}
    </>
  );
}

/** Renders <option>s for Indian states / UTs (value = state name, as the API expects). */
export function StateOptions() {
  const { data } = useIndianStates();
  return (
    <>
      {(data ?? []).map((s) => (
        <option key={s.code} value={s.name}>
          {s.name}
        </option>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Formatting / small display helpers
// ---------------------------------------------------------------------------

export const qty = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN"));

/** +5 / −5 with a real minus sign. */
export const signed = (n: number) => (n > 0 ? `+${qty(n)}` : n < 0 ? `−${qty(Math.abs(n))}` : "0");

export const variantLabel = (productName: string, title: string | null | undefined) => (title && title !== "Default" ? `${productName} — ${title}` : productName);

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PIN_PATTERN = /^[1-9]\d{5}$/;

/** "" → null, trimmed otherwise (optional text fields the API accepts as nullable). */
export const orNull = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

const LEVEL_BADGE: Record<LevelStatus, { tone: "success" | "warning" | "danger"; label: string }> = {
  IN_STOCK: { tone: "success", label: "In stock" },
  LOW: { tone: "warning", label: "Low stock" },
  OUT: { tone: "danger", label: "Out of stock" },
};
export function LevelBadge({ status }: { status: LevelStatus }) {
  const b = LEVEL_BADGE[status];
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

/** Label / value rows for detail cards. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="space-y-2.5 text-sm">
      {items.map((i) => (
        <div key={i.label} className="flex justify-between gap-4">
          <dt className="shrink-0 text-ink/50">{i.label}</dt>
          <dd className="min-w-0 break-words text-right">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

const linkVariants = {
  primary: "bg-ink text-white hover:bg-ink/85",
  outline: "border border-black/15 bg-transparent text-ink hover:bg-black/[0.03]",
  secondary: "bg-white text-ink shadow-neu hover:shadow-neu-lg",
} as const;

/** A link that looks like a <Button> (keeps middle-click / open-in-new-tab). */
export function ButtonLink({ href, variant = "primary", size = "md", icon, children }: { href: string; variant?: keyof typeof linkVariants; size?: "sm" | "md"; icon?: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30",
        linkVariants[variant],
        size === "sm" ? "h-8 gap-1.5 px-3 text-xs" : "h-10 gap-2 px-4 text-sm",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// API errors → form errors
// ---------------------------------------------------------------------------

/**
 * Maps API validation errors onto form fields. Errors whose path is not a form
 * field (e.g. an out-of-stock SKU) are folded into the root error message.
 */
export function applyApiErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, fields: readonly string[]) {
  if (!(err instanceof ApiError) || !err.errors.length) {
    setError("root", { message: errorMessage(err) });
    return;
  }
  const extra: string[] = [];
  for (const e of err.errors) {
    const top = e.path.split(".")[0] ?? "";
    if (e.path && fields.includes(top)) setError(e.path as Path<T>, { message: e.message });
    else extra.push(e.path ? `${e.path}: ${e.message}` : e.message);
  }
  setError("root", { message: extra.length ? `${err.message} — ${extra.join("; ")}` : err.message });
}

/** Error text for toasts, including per-item details when present. */
export function detailedError(err: unknown) {
  if (err instanceof ApiError && err.errors.length) return `${err.message} (${err.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join("; ")})`;
  return errorMessage(err);
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Search combobox + variant picker
// ---------------------------------------------------------------------------

interface ComboboxProps<T> {
  id?: string;
  label: string;
  placeholder?: string;
  queryKey: readonly unknown[];
  search: (term: string) => Promise<T[]>;
  optionKey: (o: T) => string;
  renderOption: (o: T) => ReactNode;
  onSelect: (o: T) => void;
  isDisabled?: (o: T) => boolean;
  invalid?: boolean;
  disabled?: boolean;
  emptyText?: string;
}

/** Accessible, debounced search-and-pick input (keyboard: ↑ ↓ Enter Esc). */
export function SearchCombobox<T>({ id, label, placeholder, queryKey, search, optionKey, renderOption, onSelect, isDisabled, invalid, disabled, emptyText = "No matches" }: ComboboxProps<T>) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const q = useQuery({
    queryKey: [...queryKey, term],
    queryFn: () => search(term),
    enabled: open && term.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const options = term ? (q.data ?? []) : [];
  const showList = open && text.trim().length > 0;
  const activeIdx = options.length ? Math.min(active, options.length - 1) : -1;

  const pick = (o: T) => {
    if (isDisabled?.(o)) return;
    onSelect(o);
    setText("");
    setTerm("");
    setActive(0);
  };

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        className={clsx("input pl-9", invalid && "border-danger/60")}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, Math.max(0, options.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            // Never submit the surrounding form from the search box.
            e.preventDefault();
            if (showList && activeIdx >= 0) pick(options[activeIdx]!);
          } else if (e.key === "Escape" && showList) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {(q.isFetching || (text.trim() !== term && text.trim() !== "")) && showList && (
        <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-ink/40" aria-hidden />
      )}
      {showList && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-black/5 bg-white p-1 shadow-neu-lg">
          {q.error ? (
            <li className="px-3 py-2.5 text-sm text-danger">{errorMessage(q.error)}</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink/50">{q.isFetching || text.trim() !== term ? "Searching…" : emptyText}</li>
          ) : (
            options.map((o, i) => {
              const off = isDisabled?.(o) ?? false;
              return (
                <li
                  key={optionKey(o)}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  aria-disabled={off || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={clsx("rounded-xl px-3 py-2 text-sm", off ? "cursor-not-allowed opacity-45" : "cursor-pointer", i === activeIdx && !off && "bg-black/[0.04]")}
                >
                  {renderOption(o)}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export interface PickedVariant {
  variantId: string;
  sku: string;
  label: string;
}

/**
 * Finds variants by SKU or product name via GET /inventory?q=. When a
 * warehouse is given, the stock figures shown are for that warehouse.
 */
export function VariantPicker({
  onSelect,
  warehouseId,
  excludeIds = [],
  label = "Add item",
  placeholder = "Search SKU or product to add…",
  invalid,
  disabled,
}: {
  onSelect: (v: PickedVariant & { row: LevelRow }) => void;
  warehouseId?: string;
  excludeIds?: string[];
  label?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <SearchCombobox<LevelRow>
      label={label}
      placeholder={placeholder}
      invalid={invalid}
      disabled={disabled}
      queryKey={["admin", "inventory", "picker", warehouseId ?? "all"]}
      search={async (term) => (await api.page<LevelRow[]>("/inventory", { q: term, warehouseId: warehouseId || undefined, limit: 10 })).data}
      optionKey={(r) => r.variantId}
      isDisabled={(r) => excludeIds.includes(r.variantId)}
      emptyText="No variants match this search"
      onSelect={(r) => onSelect({ variantId: r.variantId, sku: r.sku, label: variantLabel(r.productName, r.title), row: r })}
      renderOption={(r) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{variantLabel(r.productName, r.title)}</p>
            <p className="font-mono text-xs text-ink/50">{r.sku}</p>
          </div>
          <div className="shrink-0 text-right text-xs text-ink/55">
            {excludeIds.includes(r.variantId) ? (
              "Added"
            ) : (
              <>
                <span className="tabular-nums">{qty(r.available)}</span> available
                {warehouseId ? " here" : ""}
              </>
            )}
          </div>
        </div>
      )}
    />
  );
}
