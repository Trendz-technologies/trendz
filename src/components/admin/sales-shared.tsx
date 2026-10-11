"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Download, X } from "lucide-react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { Badge, Button, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ApiError, download, errorMessage } from "@/lib/api";
import { money, titleCase } from "@/lib/format";
import type { ChannelScope, PaymentProvider } from "./sales-types";

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" (local) → ISO timestamp at the start of that day. */
export function dayStartIso(day: string): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** "YYYY-MM-DD" (local) → ISO timestamp at the end of that day (inclusive "to" filters). */
export function dayEndIso(day: string): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** ISO timestamp → value for an <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO timestamp (or null when empty). */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

/** Number inputs: "" → null, otherwise a number. Use with register(..., { setValueAs }). */
export const numberOrNull = (v: unknown): number | null => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Copies API field errors onto a react-hook-form instance. Unknown paths and
 * non-field errors land on "root". Returns true when anything was set.
 */
export function applyApiErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, known: readonly string[], mapPath: (path: string) => string = (p) => p) {
  if (err instanceof ApiError && err.errors.length) {
    const unknown: string[] = [];
    for (const e of err.errors) {
      const path = mapPath(e.path);
      if (known.includes(path)) setError(path as Path<T>, { message: e.message });
      else unknown.push(e.path ? `${e.path}: ${e.message}` : e.message);
    }
    if (unknown.length) setError("root" as Path<T>, { message: unknown.join(" · ") });
    return;
  }
  setError("root" as Path<T>, { message: errorMessage(err) });
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export function FilterSelect({ label, value, onChange, options, allLabel = "All", className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allLabel?: string; className?: string }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={clsx("w-full sm:w-auto sm:min-w-40", className)}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** Options for a status <select> built from enum values. */
export const enumOptions = (values: readonly string[], label: (v: string) => string = titleCase) => values.map((v) => ({ value: v, label: label(v) }));

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (v: { from?: string; to?: string }) => void }) {
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value })} className="input min-w-0 flex-1 sm:w-40 sm:flex-none" />
      <span className="text-xs text-ink/40">to</span>
      <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => onChange({ to: e.target.value })} className="input min-w-0 flex-1 sm:w-40 sm:flex-none" />
    </div>
  );
}

export function FilterBar({ children, onClear, active }: { children: ReactNode; onClear?: () => void; active?: boolean }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
      {onClear && active && (
        <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<PaymentProvider, string> = { RAZORPAY: "Razorpay", CASH: "Cash", UPI_MANUAL: "UPI (counter)", CARD_MANUAL: "Card (counter)" };
export const providerLabel = (p: string) => PROVIDER_LABELS[p as PaymentProvider] ?? titleCase(p);

export function ChannelBadge({ channel }: { channel: "ONLINE" | "POS" | ChannelScope }) {
  if (channel === "POS") return <Badge tone="dark">In-store</Badge>;
  if (channel === "ONLINE") return <Badge tone="info">Online</Badge>;
  return <Badge>All channels</Badge>;
}

/** Small monospace identifier (AWB, gateway ids). */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("break-all font-mono text-[11px] text-ink/60", className)}>{children}</span>;
}

/** Link that does not also trigger a clickable table row. */
export function RowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} onClick={(e) => e.stopPropagation()} className={clsx("font-medium hover:underline", className)}>
      {children}
    </Link>
  );
}

export function DefinitionList({ rows, className }: { rows: { label: ReactNode; value: ReactNode; hidden?: boolean }[]; className?: string }) {
  return (
    <dl className={clsx("space-y-2 text-sm", className)}>
      {rows
        .filter((r) => !r.hidden)
        .map((r, i) => (
          <div key={i} className="flex justify-between gap-4">
            <dt className="shrink-0 text-ink/50">{r.label}</dt>
            <dd className="min-w-0 text-right">{r.value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warning" | "danger"; children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-2xl px-4 py-3 text-sm",
        tone === "info" && "bg-info/[0.07] text-info",
        tone === "warning" && "bg-warning/10 text-warning",
        tone === "danger" && "bg-danger/10 text-danger",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** "₹500 off" / "10% off (max ₹200)" */
export function promoValue(p: { discountType: "PERCENTAGE" | "FIXED"; value: number; maxDiscountAmount?: number | null }) {
  if (p.discountType === "FIXED") return `${money(p.value)} off`;
  const pct = `${(p.value / 100).toFixed(p.value % 100 === 0 ? 0 : 2)}% off`;
  return p.maxDiscountAmount ? `${pct} (max ${money(p.maxDiscountAmount)})` : pct;
}

/** Where a promotion stands right now: Inactive, Scheduled, Expired or Live. */
export function promoState(p: { isActive: boolean; startsAt: string | null; endsAt: string | null }): { label: string; tone: "success" | "warning" | "neutral" | "danger" } {
  const now = Date.now();
  if (!p.isActive) return { label: "Inactive", tone: "neutral" };
  if (p.endsAt && new Date(p.endsAt).getTime() <= now) return { label: "Expired", tone: "neutral" };
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return { label: "Scheduled", tone: "warning" };
  return { label: "Live", tone: "success" };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Refetches an order and every sales list that may show it. Order actions
 * ripple widely (a cancel creates a refund and a credit note, a shipment
 * moves the order status), so the lists are simply marked stale.
 */
export function useInvalidateSales() {
  const qc = useQueryClient();
  return (orderId?: string) =>
    Promise.all([
      orderId ? qc.invalidateQueries({ queryKey: ["admin", "order", orderId] }) : Promise.resolve(),
      ...["orders", "payments", "refunds", "returns", "return", "shipments", "invoices", "credit-notes", "customer"].map((k) => qc.invalidateQueries({ queryKey: ["admin", k] })),
    ]);
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/** Wraps download() with a per-button busy state and error toasts. */
export function useDownloader() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, path: string, filename?: string, fallbackUrl?: string) => {
    setBusy(key);
    try {
      await download(path, filename);
    } catch (e) {
      // A cross-origin redirect (e.g. a courier-hosted label) cannot be fetched; open it directly.
      if (fallbackUrl && !(e instanceof ApiError)) window.open(fallbackUrl, "_blank", "noopener");
      else toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

/** Download button; safe inside clickable table rows (it does not trigger the row). */
export function DownloadButton({ busy, onClick, children = "Download", label, size = "sm", variant = "outline" }: { busy: boolean; onClick: () => void; children?: ReactNode; label?: string; size?: "sm" | "md"; variant?: "outline" | "ghost" | "secondary" }) {
  return (
    <Button
      variant={variant}
      size={size}
      loading={busy}
      icon={<Download size={14} />}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

/** "INV/2627/000123" → "INV-2627-000123.pdf" */
export const pdfName = (docNumber: string) => `${docNumber.replace(/[\\/]/g, "-")}.pdf`;
