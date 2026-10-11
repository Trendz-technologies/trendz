"use client";

import { useState } from "react";
import { ChevronDown, TicketPercent, UserRound, X } from "lucide-react";
import { clsx } from "clsx";
import { Button, Field, Input, Modal, MoneyInput } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import { errorMessage } from "@/lib/api";
import { money, percent } from "@/lib/format";
import type { PosCart, PosConfig } from "./types";

type Patch = (body: Record<string, unknown>) => Promise<unknown>;

/** Optional walk-in customer details; a phone links the sale to a registered customer. */
export function CustomerSection({ cart, onPatch, disabled }: { cart: PosCart; onPatch: Patch; disabled?: boolean }) {
  const [open, setOpen] = useState(!!(cart.customer.name || cart.customer.phone));
  const [name, setName] = useState(cart.customer.name ?? "");
  const [phone, setPhone] = useState(cart.customer.phone ?? "");
  const [email, setEmail] = useState(cart.customer.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = name !== (cart.customer.name ?? "") || phone !== (cart.customer.phone ?? "") || email !== (cart.customer.email ?? "");

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onPatch({ customerName: name.trim() || null, customerPhone: phone.trim() || null, customerEmail: email.trim() || null });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-black/5 bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold">
        <UserRound size={16} className="text-ink/50" />
        <span className="flex-1 truncate">{cart.customer.name || cart.customer.phone || "Walk-in customer"}</span>
        <ChevronDown size={16} className={clsx("text-ink/40 transition", open && "rotate-180")} />
      </button>
      {open && (
        <form
          className="space-y-2.5 border-t border-black/5 px-4 pb-4 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input aria-label="Customer name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} disabled={disabled} />
          <PhoneInput aria-label="Customer mobile" value={phone} onChange={setPhone} disabled={disabled} />
          <Input aria-label="Customer email" placeholder="Email for the e-invoice (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-ink/45">A registered mobile links the sale to the customer&apos;s account.</p>
            <Button type="submit" size="sm" variant="outline" loading={saving} disabled={!dirty || disabled}>
              Save
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

export function CouponSection({ cart, onPatch, disabled }: { cart: PosCart; onPatch: Patch; disabled?: boolean }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apply = async (value: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await onPatch({ couponCode: value });
      setCode("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (cart.couponCode) {
    const invalid = cart.coupon && !cart.coupon.valid;
    return (
      <div className={clsx("flex items-center gap-2 rounded-2xl px-4 py-3 text-sm", invalid ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
        <TicketPercent size={16} />
        <span className="flex-1">
          <strong className="font-mono">{cart.couponCode}</strong>
          {invalid ? ` · ${cart.coupon?.message ?? "Not applicable"}` : cart.coupon?.discount ? ` · −${money(cart.coupon.discount)}` : " applied"}
        </span>
        <button type="button" aria-label="Remove coupon" disabled={busy || disabled} onClick={() => void apply(null)} className="rounded-full p-1 hover:bg-black/5">
          <X size={14} />
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) void apply(code.trim());
      }}
    >
      <div className="flex gap-2">
        <Input aria-label="Coupon code" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono uppercase" maxLength={30} disabled={disabled || !cart.items.length} />
        <Button type="submit" variant="outline" loading={busy} disabled={!code.trim() || disabled}>
          Apply
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </form>
  );
}

export function Totals({ cart, pricesIncludeTax }: { cart: PosCart; pricesIncludeTax: boolean }) {
  const t = cart.totals;
  const row = (label: string, value: string, className?: string) => (
    <div className={clsx("flex justify-between gap-3", className)}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
  return (
    <dl className="space-y-1.5 text-sm text-ink/70">
      {row(`Subtotal (${t.itemCount} ${t.itemCount === 1 ? "item" : "items"})`, money(t.subtotal))}
      {t.autoDiscountTotal > 0 && row("Offers", `−${money(t.autoDiscountTotal)}`, "text-success")}
      {t.couponDiscountTotal > 0 && row("Coupon", `−${money(t.couponDiscountTotal)}`, "text-success")}
      {t.manualDiscountTotal > 0 && row("Manual discount", `−${money(t.manualDiscountTotal)}`, "text-success")}
      {pricesIncludeTax ? (
        t.taxTotal > 0 && row("GST included", money(t.taxTotal), "text-ink/45 text-xs")
      ) : (
        <>
          {t.cgstTotal > 0 && row("CGST", money(t.cgstTotal))}
          {t.sgstTotal > 0 && row("SGST", money(t.sgstTotal))}
          {t.igstTotal > 0 && row("IGST", money(t.igstTotal))}
        </>
      )}
      {t.roundOff !== 0 && row("Round off", `${t.roundOff > 0 ? "+" : "−"}${money(Math.abs(t.roundOff))}`, "text-xs")}
      <div className="flex items-end justify-between gap-3 border-t border-black/10 pt-3 text-ink">
        <dt className="text-sm font-semibold">Total</dt>
        <dd className="text-3xl font-bold tabular-nums">{money(t.grandTotal)}</dd>
      </div>
    </dl>
  );
}

/** Whole-bill manual discount (pos.manual_discount); a reason is required and audited. */
export function BillDiscountDialog({ cart, config, onPatch, onClose }: { cart: PosCart; config: PosConfig | undefined; onPatch: Patch; onClose: () => void }) {
  const [amount, setAmount] = useState<number | null>(cart.manualDiscount || null);
  const [reason, setReason] = useState(cart.manualDiscountReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if ((amount ?? 0) > 0 && !reason.trim()) {
      setError("Give a reason for the discount");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onPatch({ manualDiscount: amount ?? 0, manualDiscountReason: reason.trim() || null });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Bill discount"
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
        <Field label="Discount amount" hint={config ? `All manual discounts on a bill are capped at ${percent(config.maxManualDiscountBps)} of its value.` : undefined}>
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Reason" required>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Festive offer approved by store manager" />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
