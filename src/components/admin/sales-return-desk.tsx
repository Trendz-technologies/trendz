"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Minus, Plus, ScanLine, Trash2 } from "lucide-react";
import { Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { date, moneyExact } from "@/lib/format";
import { ChannelBadge, Notice, useInvalidateSales } from "./sales-shared";
import type { ReturnDetail } from "./sales-types";

interface Candidate {
  orderId: string;
  orderNumber: string;
  channel: "ONLINE" | "POS";
  customerName: string | null;
  placedAt: string;
  orderItemId: string;
  quantitySold: number;
  returnable: number;
  unitPaid: number;
  withinWindow: boolean;
  eligible: boolean;
}
interface ScanResult {
  variant: { id: string; sku: string; title: string; name: string };
  candidates: Candidate[];
}
interface BasketLine {
  orderItemId: string;
  sku: string;
  label: string;
  quantity: number;
  max: number;
  unitPaid: number;
}
interface Basket {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  lines: BasketLine[];
}

/**
 * Counter returns: scan (or type) a product code, pick the order line it was
 * sold on, collect one or more lines of the same order, then create the
 * return already approved.
 */
export function ReturnDesk() {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const codeRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [basket, setBasket] = useState<Basket | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scan = useMutation({
    mutationFn: (input: { code: string; orderNumber?: string }) => api.post<ScanResult>("/returns/scan", input),
    onSuccess: (r) => {
      setResult(r);
      setCode("");
      codeRef.current?.focus();
    },
    onError: (e) => {
      setResult(null);
      toast(errorMessage(e), "error");
      codeRef.current?.select();
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<ReturnDetail>("/returns", {
        orderId: basket!.orderId,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        items: basket!.lines.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity })),
        approve: true,
      }),
    onSuccess: (rr) => {
      toast(`Return ${rr.returnNumber} created and approved`);
      void invalidate(rr.orderId);
      router.push(`/admin/returns/${rr.id}`);
    },
    onError: (e) => setError(e instanceof ApiError && e.errors.length ? e.errors.map((x) => x.message).join(" · ") : errorMessage(e)),
  });

  const add = (c: Candidate) => {
    if (!result) return;
    const label = `${result.variant.name}${result.variant.title !== "Default" ? ` — ${result.variant.title}` : ""}`;
    setBasket((b) => {
      const base: Basket = b && b.orderId === c.orderId ? b : { orderId: c.orderId, orderNumber: c.orderNumber, customerName: c.customerName, lines: [] };
      const existing = base.lines.find((l) => l.orderItemId === c.orderItemId);
      const lines = existing
        ? base.lines.map((l) => (l.orderItemId === c.orderItemId ? { ...l, quantity: Math.min(l.max, l.quantity + 1) } : l))
        : [...base.lines, { orderItemId: c.orderItemId, sku: result.variant.sku, label, quantity: 1, max: c.returnable, unitPaid: c.unitPaid }];
      return { ...base, lines };
    });
    // Later scans are narrowed to the same order.
    setOrderNumber(c.orderNumber);
    setResult(null);
    setError(null);
    codeRef.current?.focus();
  };

  const setQty = (orderItemId: string, quantity: number) =>
    setBasket((b) => (b ? { ...b, lines: b.lines.map((l) => (l.orderItemId === orderItemId ? { ...l, quantity: Math.max(1, Math.min(l.max, quantity)) } : l)) } : b));
  const removeLine = (orderItemId: string) =>
    setBasket((b) => {
      if (!b) return b;
      const lines = b.lines.filter((l) => l.orderItemId !== orderItemId);
      return lines.length ? { ...b, lines } : null;
    });
  const reset = () => {
    setBasket(null);
    setResult(null);
    setOrderNumber("");
    setReason("");
    setNotes("");
    setError(null);
  };

  const submitReturn = () => {
    if (!basket) return;
    if (reason.trim().length < 3) {
      setError("Enter a reason for the return (at least 3 characters)");
      return;
    }
    setError(null);
    create.mutate();
  };

  const value = basket?.lines.reduce((s, l) => s + l.unitPaid * l.quantity, 0) ?? 0;

  return (
    <Card title={<h2 className="flex items-center gap-2 text-sm font-semibold"><ScanLine size={16} /> Return desk</h2>} actions={(basket || result) && <Button variant="ghost" size="sm" onClick={reset}>Start over</Button>}>
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) scan.mutate({ code: code.trim(), orderNumber: orderNumber.trim() || undefined });
        }}
      >
        <Field label="Scan or enter a product code / SKU" htmlFor="return-code">
          <Input id="return-code" ref={codeRef} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan the barcode or QR on the item" autoComplete="off" />
        </Field>
        <Field label="Order number" htmlFor="return-order" hint={basket ? "Locked to the order being returned" : "Optional, narrows the search"}>
          <Input id="return-order" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="ORD-…" disabled={!!basket} autoComplete="off" />
        </Field>
        <Button type="submit" loading={scan.isPending} disabled={!code.trim()} icon={<ScanLine size={15} />}>
          Find
        </Button>
      </form>

      {result && (
        <div className="mt-5">
          <p className="mb-2 text-sm">
            <span className="font-semibold">{result.variant.name}</span>
            {result.variant.title !== "Default" && <span className="text-ink/60"> — {result.variant.title}</span>} <span className="font-mono text-xs text-ink/50">{result.variant.sku}</span>
          </p>
          {result.candidates.length === 0 ? (
            <Notice tone="warning">No returnable order in the last 180 days contains this item. Enter the order number to search older orders.</Notice>
          ) : (
            <ul className="divide-y divide-black/5 rounded-2xl border border-black/5">
              {result.candidates.map((c) => {
                const otherOrder = !!basket && basket.orderId !== c.orderId;
                return (
                  <li key={c.orderItemId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {c.orderNumber} <ChannelBadge channel={c.channel} />
                        {!c.withinWindow && <Badge tone="warning">Outside return window</Badge>}
                      </p>
                      <p className="text-xs text-ink/55">
                        {c.customerName ?? "Walk-in"} · {date(c.placedAt)} · sold {c.quantitySold}, returnable {c.returnable} · {moneyExact(c.unitPaid)} each
                      </p>
                    </div>
                    <Button size="sm" variant={c.eligible && !otherOrder ? "primary" : "outline"} disabled={!c.eligible || otherOrder} onClick={() => add(c)} title={otherOrder ? `This return is for ${basket?.orderNumber}. Start over to return items of another order.` : undefined}>
                      {c.eligible ? "Add to return" : "Already returned"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {basket && (
        <div className="mt-6 space-y-4 border-t border-black/5 pt-5">
          <p className="text-sm">
            Returning from <span className="font-semibold">{basket.orderNumber}</span>
            {basket.customerName && <span className="text-ink/60"> · {basket.customerName}</span>}
          </p>
          <ul className="space-y-2">
            {basket.lines.map((l) => (
              <li key={l.orderItemId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-offwhite px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{l.label}</p>
                  <p className="text-xs text-ink/50">
                    <span className="font-mono">{l.sku}</span> · {moneyExact(l.unitPaid)} each · up to {l.max}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" aria-label="Decrease quantity" icon={<Minus size={13} />} disabled={l.quantity <= 1} onClick={() => setQty(l.orderItemId, l.quantity - 1)} />
                  <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
                    {l.quantity}
                  </span>
                  <Button variant="ghost" size="sm" aria-label="Increase quantity" icon={<Plus size={13} />} disabled={l.quantity >= l.max} onClick={() => setQty(l.orderItemId, l.quantity + 1)} />
                  <Button variant="ghost" size="sm" aria-label={`Remove ${l.label}`} icon={<Trash2 size={13} />} onClick={() => removeLine(l.orderItemId)} />
                </div>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reason" htmlFor="return-reason" required>
              <Input id="return-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Size does not fit" />
            </Field>
            <Field label="Internal notes" htmlFor="return-notes">
              <Textarea id="return-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-10" />
            </Field>
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink/60">
              Item value <span className="font-semibold text-ink">{moneyExact(value)}</span> · the return is approved immediately; receive and refund it next.
            </p>
            <Button loading={create.isPending} onClick={submitReturn}>
              Create return
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
