"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, HandCoins, PackageCheck, X } from "lucide-react";
import { Can } from "@/components/admin/page";
import { Button, ConfirmDialog, Field, Modal, MoneyInput, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, newIdempotencyKey } from "@/lib/api";
import { moneyExact } from "@/lib/format";
import { DefinitionList, Notice, useInvalidateSales } from "./sales-shared";
import type { ReturnCondition, ReturnDetail, WarehouseOption } from "./sales-types";

type Action = "approve" | "reject" | "receive" | "refund" | "close";

/** True when a refund for this return is pending, processing or processed. */
export const returnRefundIssued = (rr: ReturnDetail) => rr.refunds.some((r) => r.status !== "FAILED");
/** The API caps return refunds at what is still unrefunded (failed refunds paid nothing). */
export const returnCanRefund = (rr: ReturnDetail) => (rr.status === "RECEIVED" || rr.status === "REFUNDED") && rr.refundableAmount > 0;

/** Status-dependent action buttons for a return, plus their dialogs. */
export function ReturnActions({ rr }: { rr: ReturnDetail }) {
  const [open, setOpen] = useState<Action | null>(null);
  const close = () => setOpen(null);
  const s = rr.status;
  const refundIssued = returnRefundIssued(rr);

  return (
    <>
      <Can permission="returns.manage">
        {(s === "REQUESTED" || s === "APPROVED") && (
          <Button variant="outline" size="sm" icon={<X size={14} />} className="text-danger!" onClick={() => setOpen("reject")}>
            Reject
          </Button>
        )}
        {s === "REQUESTED" && (
          <Button size="sm" icon={<Check size={14} />} onClick={() => setOpen("approve")}>
            Approve
          </Button>
        )}
        {(s === "APPROVED" || s === "PICKUP_SCHEDULED") && (
          <Button size="sm" icon={<PackageCheck size={14} />} onClick={() => setOpen("receive")}>
            Receive items
          </Button>
        )}
        {(s === "RECEIVED" || s === "REFUNDED") && (
          <Button variant={s === "REFUNDED" || refundIssued ? "primary" : "outline"} size="sm" onClick={() => setOpen("close")}>
            Close return
          </Button>
        )}
        {returnCanRefund(rr) && (
          <Can permission="refunds.create">
            <Button size="sm" icon={<HandCoins size={14} />} onClick={() => setOpen("refund")}>
              Refund
            </Button>
          </Can>
        )}
      </Can>
      {open === "approve" && <NotesDialog rr={rr} action="approve" onClose={close} />}
      {open === "reject" && <NotesDialog rr={rr} action="reject" onClose={close} />}
      {open === "close" && <CloseDialog rr={rr} onClose={close} />}
      {open === "receive" && <ReceiveModal rr={rr} onClose={close} />}
      {open === "refund" && <ReturnRefundModal rr={rr} onClose={close} />}
    </>
  );
}

/** Shared success handling: refetch the return and mark the sales lists stale. */
function useReturnSaved(rr: ReturnDetail) {
  const qc = useQueryClient();
  const invalidate = useInvalidateSales();
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin", "return", rr.id] });
    void invalidate(rr.orderId);
  };
}

function NotesDialog({ rr, action, onClose }: { rr: ReturnDetail; action: "approve" | "reject"; onClose: () => void }) {
  const toast = useToast();
  const saved = useReturnSaved(rr);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reject = action === "reject";

  const submit = async () => {
    if (reject && notes.trim().length < 3) {
      setError("Tell the customer why (at least 3 characters)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/returns/${rr.id}/${action}`, { notes: notes.trim() || undefined });
      saved();
      toast(reject ? `Return ${rr.returnNumber} rejected` : `Return ${rr.returnNumber} approved`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfirmDialog
      open
      title={reject ? `Reject ${rr.returnNumber}?` : `Approve ${rr.returnNumber}?`}
      body={reject ? "The customer is notified with your note. If nothing else is being returned, the order goes back to Delivered." : "The customer is notified to hand the items to the courier or bring them to the store."}
      confirmLabel={reject ? "Reject return" : "Approve return"}
      tone={reject ? "danger" : "primary"}
      loading={saving}
      onConfirm={submit}
      onClose={onClose}
    >
      <Field label={reject ? "Reason for rejection" : "Notes"} htmlFor="return-notes" required={reject} error={error ?? undefined} hint={reject ? "Shared with the customer." : "Optional, internal."} className="mt-4">
        <Textarea id="return-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} invalid={!!error} className="min-h-20" />
      </Field>
    </ConfirmDialog>
  );
}

function CloseDialog({ rr, onClose }: { rr: ReturnDetail; onClose: () => void }) {
  const toast = useToast();
  const saved = useReturnSaved(rr);
  const [saving, setSaving] = useState(false);
  const noRefund = rr.status === "RECEIVED" && !returnRefundIssued(rr);
  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/returns/${rr.id}/close`);
      saved();
      toast(`Return ${rr.returnNumber} closed`);
      onClose();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <ConfirmDialog
      open
      title={`Close ${rr.returnNumber}?`}
      body={noRefund ? "No refund has been issued for this return. Closing it finalises the return without a refund." : "Closing finalises the return. It cannot be changed afterwards."}
      confirmLabel="Close return"
      tone={noRefund ? "danger" : "primary"}
      loading={saving}
      onConfirm={submit}
      onClose={onClose}
    />
  );
}

const CONDITIONS: { value: ReturnCondition; label: string }[] = [
  { value: "GOOD", label: "Good — resellable" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "DEFECTIVE", label: "Defective" },
];

/** Inspection on arrival: a condition (and optionally a warehouse) per returned line. */
function ReceiveModal({ rr, onClose }: { rr: ReturnDetail; onClose: () => void }) {
  const toast = useToast();
  const saved = useReturnSaved(rr);
  const warehouses = useQuery({ queryKey: ["admin", "warehouses", "options"], queryFn: () => api.get<WarehouseOption[]>("/warehouses"), staleTime: 300_000, retry: false });
  const [lines, setLines] = useState<Record<string, { condition: ReturnCondition; warehouseId: string }>>(() =>
    Object.fromEntries(rr.items.map((i) => [i.id, { condition: "GOOD" as ReturnCondition, warehouseId: "" }])),
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const whName = (id: string) => {
    const w = warehouses.data?.find((x) => x.id === id);
    return w ? `${w.name} (${w.code})` : "original warehouse";
  };
  const good = rr.items.filter((i) => lines[i.id]?.condition === "GOOD").reduce((s, i) => s + i.quantity, 0);
  const bad = rr.items.reduce((s, i) => s + i.quantity, 0) - good;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/returns/${rr.id}/receive`, {
        items: rr.items.map((i) => ({ returnItemId: i.id, condition: lines[i.id]!.condition, warehouseId: lines[i.id]!.warehouseId || undefined })),
        notes: notes.trim() || undefined,
      });
      saved();
      toast(`Return ${rr.returnNumber} received — stock updated`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError && e.errors.length ? e.errors.map((x) => x.message).join(" · ") : errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Receive ${rr.returnNumber}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit} icon={<PackageCheck size={15} />}>
            Receive & update stock
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Notice>
          Inspect every item. <strong>Good</strong> units go back to sellable stock (or to the returned bucket for review if auto-restock is turned off in settings). <strong>Damaged</strong> and <strong>defective</strong> units go to the damaged bucket and cannot be sold. Each unit is recorded in the inventory ledger.
        </Notice>
        <ul className="space-y-3">
          {rr.items.map((i) => {
            const line = lines[i.id]!;
            const set = (patch: Partial<typeof line>) => setLines((l) => ({ ...l, [i.id]: { ...l[i.id]!, ...patch } }));
            return (
              <li key={i.id} className="rounded-2xl border border-black/5 p-4">
                <p className="text-sm font-medium">
                  {i.orderItem.productName}
                  {i.orderItem.variantTitle !== "Default" && <span className="text-ink/60"> — {i.orderItem.variantTitle}</span>}
                  <span className="ml-2 text-ink/50">× {i.quantity}</span>
                </p>
                <p className="text-xs text-ink/50">
                  <span className="font-mono">{i.orderItem.sku}</span>
                  {i.reason && <> · {i.reason}</>}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Condition" htmlFor={`cond-${i.id}`}>
                    <Select id={`cond-${i.id}`} value={line.condition} onChange={(e) => set({ condition: e.target.value as ReturnCondition })}>
                      {CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Receive into" htmlFor={`wh-${i.id}`}>
                    <Select id={`wh-${i.id}`} value={line.warehouseId} onChange={(e) => set({ warehouseId: e.target.value })} disabled={!warehouses.data}>
                      <option value="">Shipped-from warehouse ({whName(i.orderItem.warehouseId)})</option>
                      {warehouses.data
                        ?.filter((w) => w.status === "ACTIVE" && w.id !== i.orderItem.warehouseId)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.code})
                          </option>
                        ))}
                    </Select>
                  </Field>
                </div>
              </li>
            );
          })}
        </ul>
        <Field label="Inspection notes" htmlFor="receive-notes" hint="Optional. Saved on the return and in the stock ledger.">
          <Textarea id="receive-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
        </Field>
        <p className="text-sm text-ink/60">
          {good} unit(s) back to stock · {bad} unit(s) to damaged. The order is marked as returned.
        </p>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}

/** Refund for a received return (defaults to the value of the returned units). */
function ReturnRefundModal({ rr, onClose }: { rr: ReturnDetail; onClose: () => void }) {
  const toast = useToast();
  const saved = useReturnSaved(rr);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [amount, setAmount] = useState<number | null>(rr.refundableAmount);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [saving, setSaving] = useState(false);
  const effective = amount ?? rr.refundableAmount;

  const review = () => {
    if (amount != null && amount <= 0) setError("Enter an amount above ₹0");
    else if (effective > rr.refundableAmount) setError(`At most ${moneyExact(rr.refundableAmount)} can still be refunded for this return`);
    else {
      setError(null);
      setStep("confirm");
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await api.post<ReturnDetail>(`/returns/${rr.id}/refund`, { amount: effective }, { idempotencyKey });
      const latest = [...updated.refunds].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
      if (latest?.status === "FAILED") toast(`Refund ${latest.refundNumber} failed${latest.failureReason ? `: ${latest.failureReason}` : ""}. Retry it from the Refunds page.`, "error");
      else toast(`Refund of ${moneyExact(effective)} issued for ${rr.returnNumber}`);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "REFUND_FAILED") {
        toast(`${e.message}. Retry the failed refund from the Refunds page.`, "error");
        onClose();
      } else {
        setError(errorMessage(e));
        setStep("form");
      }
    } finally {
      setSaving(false);
      saved();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={step === "form" ? `Refund ${rr.returnNumber}` : "Confirm refund"}
      footer={
        step === "form" ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={review}>Review refund</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep("form")} disabled={saving}>
              Back
            </Button>
            <Button variant="danger" loading={saving} onClick={submit}>
              Refund {moneyExact(effective)}
            </Button>
          </>
        )
      }
    >
      {step === "form" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            review();
          }}
        >
          <DefinitionList
            className="rounded-2xl bg-offwhite p-4"
            rows={[
              { label: "Still refundable for this return", value: <strong>{moneyExact(rr.refundableAmount)}</strong> },
              { label: "Order total", value: moneyExact(rr.order.grandTotal) },
              { label: "Already refunded on order", value: moneyExact(rr.order.amountRefunded) },
            ]}
          />
          <Field label="Refund amount" htmlFor="return-refund" error={error ?? undefined} hint="Defaults to what the customer paid for the returned units. Lower it to deduct, e.g., for missing packaging.">
            <MoneyInput id="return-refund" value={amount} onChange={setAmount} invalid={!!error} max={rr.refundableAmount / 100} placeholder={(rr.refundableAmount / 100).toFixed(2)} />
          </Field>
        </form>
      ) : (
        <div className="space-y-4 text-sm">
          <p>
            Refund <strong>{moneyExact(effective)}</strong> to the customer&apos;s original payment method for return {rr.returnNumber} (order {rr.order.orderNumber})?
          </p>
          <Notice tone="warning">Gateway refunds reach the customer in 5–7 working days. Counter (cash / UPI) payments are recorded as refunded immediately — hand the money back. A GST credit note is issued automatically.</Notice>
          <p className="text-ink/60">Refunds cannot be undone.</p>
        </div>
      )}
    </Modal>
  );
}
