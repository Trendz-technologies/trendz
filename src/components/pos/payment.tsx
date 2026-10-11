"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { CheckCircle2, Printer, Receipt } from "lucide-react";
import { Button, Field, Input, Modal, MoneyInput } from "@/components/ui";
import { PayButton } from "@/components/store/pay-button";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, newIdempotencyKey, refreshSession } from "@/lib/api";
import { money } from "@/lib/format";
import { METHOD_LABELS, type CheckoutResult, type PosCart, type PosPaymentMethod } from "./types";

/** Suggested cash notes: exact, then the next round amounts above the total. */
function cashSuggestions(total: number) {
  const rupees = Math.ceil(total / 100);
  const steps = [10, 50, 100, 200, 500, 2000];
  const out = new Set<number>([rupees]);
  for (const s of steps) {
    const v = Math.ceil(rupees / s) * s;
    if (v > rupees) out.add(v);
    if (out.size >= 4) break;
  }
  return [...out].map((r) => r * 100);
}

/**
 * Collects the payment for the current bill. The idempotency key is created
 * once per dialog, so a double tap or a network retry never bills twice.
 */
export function ChargeDialog({ cart, method, onClose, onDone }: { cart: PosCart; method: PosPaymentMethod; onClose: () => void; onDone: (r: CheckoutResult) => void }) {
  const [key] = useState(newIdempotencyKey);
  const total = cart.totals.grandTotal;
  const [tendered, setTendered] = useState<number | null>(method === "CASH" ? total : null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestions = useMemo(() => cashSuggestions(total), [total]);
  const change = method === "CASH" && tendered != null ? tendered - total : null;
  const needsReference = method === "UPI_MANUAL" || method === "CARD_MANUAL";
  const valid = method === "CASH" ? tendered != null && tendered >= total : needsReference ? reference.trim().length >= 4 : true;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        paymentMethod: method,
        amountTendered: method === "CASH" ? (tendered ?? undefined) : undefined,
        referenceNumber: needsReference ? reference.trim() : undefined,
      };
      onDone(await api.post<CheckoutResult>(`/pos/carts/${cart.id}/checkout`, body, { idempotencyKey: key }));
    } catch (err) {
      setError(err instanceof ApiError && err.errors.length ? err.errors.map((e) => e.message).join(" · ") : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={`${METHOD_LABELS[method]} payment`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Back to bill
          </Button>
          <Button size="lg" loading={busy} disabled={!valid} onClick={submit}>
            {method === "RAZORPAY" ? "Create payment" : "Complete sale"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="rounded-2xl bg-offwhite p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/45">Amount due</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{money(total)}</p>
          <p className="mt-1 text-xs text-ink/50">
            {cart.totals.itemCount} {cart.totals.itemCount === 1 ? "item" : "items"}
            {cart.customer.name ? ` · ${cart.customer.name}` : ""}
          </p>
        </div>

        {method === "CASH" && (
          <>
            <Field label="Cash received" htmlFor="tendered">
              <MoneyInput id="tendered" value={tendered} onChange={setTendered} autoFocus className="h-12 pl-7 text-lg font-semibold" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTendered(s)}
                  className={clsx("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", tendered === s ? "border-ink bg-ink text-white" : "border-black/10 hover:bg-black/3")}
                >
                  {i === 0 ? `Exact ${money(s)}` : money(s)}
                </button>
              ))}
            </div>
            <div className={clsx("flex items-center justify-between rounded-2xl px-4 py-3", change != null && change < 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
              <span className="text-sm font-semibold">{change != null && change < 0 ? "Short by" : "Change to return"}</span>
              <span className="text-2xl font-bold tabular-nums">{change == null ? "—" : money(Math.abs(change))}</span>
            </div>
          </>
        )}

        {needsReference && (
          <Field label={method === "UPI_MANUAL" ? "UPI transaction reference (UTR)" : "Card terminal approval / reference number"} htmlFor="reference" required hint="Check the payment on your UPI app or card terminal before completing the sale.">
            <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} autoFocus autoComplete="off" maxLength={60} />
          </Field>
        )}

        {method === "RAZORPAY" && (
          <p className="rounded-2xl bg-offwhite p-4 text-sm text-ink/70">
            The order is created and its stock is held for 15 minutes. The customer then pays in the Razorpay window (UPI QR, card or net banking). The sale completes only after the server
            verifies the payment with Razorpay.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

/** A Razorpay bill waiting for the customer to pay. */
export function GatewayPaymentDialog({ sale, onPaid, onClose }: { sale: CheckoutResult; onPaid: () => void; onClose: () => void }) {
  const toast = useToast();
  return (
    <Modal open onClose={onClose} title={`Collect payment · ${sale.order.orderNumber}`}>
      <div className="space-y-4">
        <p className="text-sm text-ink/65">Open the payment window and let the customer pay. Stock stays on hold for 15 minutes; if the payment is not completed, the hold is released automatically.</p>
        <PayButton
          orderId={sale.order.id}
          amount={sale.order.grandTotal}
          label="Collect with Razorpay"
          onOutcome={(o) => {
            if (o.status === "paid") onPaid();
            else if (o.status === "failed") toast(o.message, "error");
          }}
        />
        <p className="text-center text-xs text-ink/45">You can start the next bill and come back to this order later from Recent sales.</p>
      </div>
    </Modal>
  );
}

/**
 * Opens the receipt PDF in a new tab. The tab is opened synchronously inside
 * the click (so pop-up blockers allow it) and filled once the PDF arrives.
 */
export async function openReceipt(orderId: string) {
  const tab = window.open("about:blank", "_blank");
  try {
    let res = await fetch(`/api/pos/orders/${orderId}/receipt`, { credentials: "same-origin" });
    if (res.status === 401 && (await refreshSession())) res = await fetch(`/api/pos/orders/${orderId}/receipt`, { credentials: "same-origin" });
    if (!res.ok) throw new Error("The receipt could not be generated");
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export function SaleCompleteDialog({ sale, method, onClose }: { sale: CheckoutResult; method: PosPaymentMethod; onClose: () => void }) {
  const toast = useToast();
  const [printing, setPrinting] = useState(false);
  const print = async () => {
    setPrinting(true);
    try {
      await openReceipt(sale.order.id);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPrinting(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Sale complete"
      footer={
        <>
          <Button variant="outline" icon={<Printer size={15} />} loading={printing} onClick={print}>
            Print receipt
          </Button>
          <Button autoFocus icon={<Receipt size={15} />} onClick={onClose}>
            New bill
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-center">
        <CheckCircle2 size={44} className="mx-auto text-success" strokeWidth={1.5} />
        <div>
          <p className="text-sm text-ink/55">
            {sale.order.orderNumber} · {METHOD_LABELS[method]}
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{money(sale.order.grandTotal)}</p>
        </div>
        {sale.change != null && sale.change > 0 && (
          <div className="rounded-2xl bg-success/10 px-4 py-3 text-success">
            <p className="text-xs font-semibold uppercase tracking-widest">Return change</p>
            <p className="text-3xl font-bold tabular-nums">{money(sale.change)}</p>
          </div>
        )}
        <p className="text-xs text-ink/45">The GST invoice is generated in the background and attached to the order.</p>
      </div>
    </Modal>
  );
}
