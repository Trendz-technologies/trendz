"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { AlertTriangle, Minus, PackageOpen, Percent, Plus, Trash2 } from "lucide-react";
import { Button, Field, Modal, MoneyInput } from "@/components/ui";
import { money, percent } from "@/lib/format";
import type { PosConfig, PosLine } from "./types";

export function BillLines({
  lines,
  canDiscount,
  disabled,
  onQuantity,
  onDiscount,
  onRemove,
}: {
  lines: PosLine[];
  canDiscount: boolean;
  disabled?: boolean;
  onQuantity: (line: PosLine, quantity: number) => void;
  onDiscount: (line: PosLine) => void;
  onRemove: (line: PosLine) => void;
}) {
  if (!lines.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-ink/45">
        <PackageOpen size={32} strokeWidth={1.5} />
        <p className="font-medium text-ink/60">The bill is empty</p>
        <p className="max-w-xs text-sm">Scan a product with the scanner or camera, or search by name or SKU.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-black/5" aria-label="Bill items">
      {lines.map((l, i) => (
        <li key={l.id} className={clsx("flex items-center gap-3 px-1 py-3", i === lines.length - 1 && "animate-rise")}>
          {l.image ? <img src={l.image} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-xl bg-offwhite object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-xl bg-offwhite" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{l.name}</p>
            <p className="truncate text-xs text-ink/50">
              {l.variant} · <span className="font-mono">{l.sku}</span>
            </p>
            <p className="mt-0.5 text-xs text-ink/60">
              {money(l.unitPrice)}
              {l.mrp > l.unitPrice && <span className="ml-1 text-ink/35 line-through">{money(l.mrp)}</span>}
              {l.taxRateBps > 0 && <span className="ml-1.5 text-ink/40">GST {percent(l.taxRateBps)}</span>}
              {l.discountAmount > 0 && <span className="ml-1.5 font-medium text-success">−{money(l.discountAmount)}</span>}
            </p>
            {l.stockIssue && (
              <p className={clsx("mt-0.5 flex items-center gap-1 text-xs font-medium", l.stockOverride ? "text-warning" : "text-danger")}>
                <AlertTriangle size={12} /> {l.stockIssue} · {Math.max(0, l.available)} available here
              </p>
            )}
          </div>
          <div className="flex items-center rounded-full border border-black/10 bg-white" role="group" aria-label={`Quantity of ${l.name}`}>
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={disabled}
              onClick={() => (l.quantity > 1 ? onQuantity(l, l.quantity - 1) : onRemove(l))}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <QuantityInput value={l.quantity} disabled={disabled} onCommit={(q) => q !== l.quantity && onQuantity(l, q)} />
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={disabled}
              onClick={() => onQuantity(l, l.quantity + 1)}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
          <p className="w-24 text-right text-sm font-semibold tabular-nums">{money(l.lineTotal)}</p>
          <div className="flex gap-0.5">
            {canDiscount && (
              <Button variant="ghost" size="sm" aria-label={`Discount on ${l.name}`} icon={<Percent size={14} />} disabled={disabled} onClick={() => onDiscount(l)} />
            )}
            <Button variant="ghost" size="sm" aria-label={`Remove ${l.name}`} icon={<Trash2 size={14} />} disabled={disabled} onClick={() => onRemove(l)} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Typed quantity, committed on Enter / blur so every keystroke is not a request. */
function QuantityInput({ value, disabled, onCommit }: { value: number; disabled?: boolean; onCommit: (q: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const q = Math.floor(Number(draft));
    setDraft(null);
    if (Number.isFinite(q) && q >= 1 && q <= 999) onCommit(q);
  };
  return (
    <input
      aria-label="Quantity"
      inputMode="numeric"
      disabled={disabled}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 3))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(null);
      }}
      className="h-8 w-10 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
    />
  );
}

/** Per-line manual discount (pos.manual_discount). The API enforces the cap and audits it. */
export function LineDiscountDialog({ line, config, onSave, onClose }: { line: PosLine; config: PosConfig | undefined; onSave: (amount: number) => Promise<void>; onClose: () => void }) {
  const [amount, setAmount] = useState<number | null>(line.manualDiscount || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gross = line.unitPrice * line.quantity;
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(amount ?? 0);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply the discount");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Discount · ${line.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink/60">
          {line.quantity} × {money(line.unitPrice)} = <strong>{money(gross)}</strong>
        </p>
        <Field label="Discount on this line (₹)" error={error ?? undefined} hint={config ? `Manual discounts on a bill are capped at ${percent(config.maxManualDiscountBps)} of the bill.` : undefined}>
          <MoneyInput value={amount} onChange={setAmount} autoFocus invalid={!!error} onKeyDown={(e) => e.key === "Enter" && void save()} />
        </Field>
      </div>
    </Modal>
  );
}
