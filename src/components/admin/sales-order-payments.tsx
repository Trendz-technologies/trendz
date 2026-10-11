"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { HandCoins, RefreshCw, RotateCcw } from "lucide-react";
import { Can } from "@/components/admin/page";
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Modal, MoneyInput, StatusBadge, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, newIdempotencyKey } from "@/lib/api";
import { dateTime, moneyExact } from "@/lib/format";
import { DefinitionList, Mono, Notice, providerLabel, useInvalidateSales } from "./sales-shared";
import { CAPTURED, type StaffOrder, type StaffPayment, type StaffRefund } from "./sales-types";

/** Gateway payments that may have been captured without us hearing about it. */
const RECONCILABLE = new Set(["CREATED", "PENDING", "FAILED"]);

export const refundableOf = (payments: StaffPayment[]) => payments.filter((p) => CAPTURED.includes(p.status)).reduce((s, p) => s + p.amount - p.amountRefunded, 0);

export function OrderPaymentsCard({ order }: { order: StaffOrder }) {
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const [refundOpen, setRefundOpen] = useState(false);
  const [retrying, setRetrying] = useState<StaffRefund | null>(null);
  const refundable = refundableOf(order.payments);
  const paid = order.payments.filter((p) => p.paidAt).reduce((s, p) => s + p.amount, 0);

  const reconcile = useMutation({
    mutationFn: (paymentId: string) => api.post<{ result: "paid" | "unpaid"; payment: StaffPayment }>(`/payments/${paymentId}/reconcile`),
    onSuccess: (r) => {
      toast(r.result === "paid" ? "Payment captured at the gateway — order marked as paid" : "The gateway has no captured payment for this order yet", r.result === "paid" ? "success" : "info");
      void invalidate(order.id);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const retry = useMutation({
    mutationFn: (refundId: string) => api.post<StaffRefund>(`/refunds/${refundId}/retry`),
    onSuccess: (r) => {
      setRetrying(null);
      toast(r.status === "FAILED" ? `Refund ${r.refundNumber} failed again` : `Refund ${r.refundNumber} ${r.status === "PROCESSED" ? "processed" : "sent to the gateway"}`, r.status === "FAILED" ? "error" : "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
    onSettled: () => void invalidate(order.id),
  });

  return (
    <Card
      title="Payments & refunds"
      actions={
        refundable > 0 && (
          <Can permission="refunds.create">
            <Button variant="secondary" size="sm" icon={<HandCoins size={14} />} onClick={() => setRefundOpen(true)}>
              Issue refund
            </Button>
          </Can>
        )
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3 rounded-2xl bg-offwhite p-4 text-center">
        <div>
          <p className="text-xs text-ink/50">Paid</p>
          <p className="font-semibold tabular-nums">{moneyExact(paid)}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50">Refunded</p>
          <p className="font-semibold tabular-nums">{moneyExact(order.amountRefunded)}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50">Refundable</p>
          <p className="font-semibold tabular-nums">{moneyExact(refundable)}</p>
        </div>
      </div>

      <DataTable
        rows={order.payments}
        rowKey={(p) => p.id}
        empty={<EmptyState title="No payment attempts yet" />}
        columns={[
          {
            key: "provider",
            header: "Payment",
            cell: (p) => (
              <div>
                <p className="font-medium">{providerLabel(p.provider)}</p>
                <p className="text-xs text-ink/50">{p.method ?? "—"}</p>
              </div>
            ),
          },
          { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
          {
            key: "ids",
            header: "Reference",
            cell: (p) => (
              <div className="max-w-56 space-y-0.5">
                {p.razorpayPaymentId && <Mono className="block">{p.razorpayPaymentId}</Mono>}
                {p.razorpayOrderId && <Mono className="block">{p.razorpayOrderId}</Mono>}
                {p.referenceNumber && <Mono className="block">Ref {p.referenceNumber}</Mono>}
                {p.failureReason && <p className="text-[11px] text-danger">{p.failureReason}</p>}
                {!p.razorpayPaymentId && !p.razorpayOrderId && !p.referenceNumber && !p.failureReason && <span className="text-ink/30">—</span>}
              </div>
            ),
          },
          { key: "when", header: "Paid at", cell: (p) => <span className="whitespace-nowrap text-ink/70">{p.paidAt ? dateTime(p.paidAt) : "—"}</span> },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            cell: (p) => (
              <div>
                <p className="font-medium">{moneyExact(p.amount)}</p>
                {p.amountRefunded > 0 && <p className="text-[11px] text-danger">−{moneyExact(p.amountRefunded)} refunded</p>}
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (p) =>
              p.provider === "RAZORPAY" && RECONCILABLE.has(p.status) && p.razorpayOrderId ? (
                <Can permission="payments.manage">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<RefreshCw size={13} />}
                    loading={reconcile.isPending && reconcile.variables === p.id}
                    onClick={() => reconcile.mutate(p.id)}
                    title="Ask the gateway whether this payment was captured"
                  >
                    Reconcile
                  </Button>
                </Can>
              ) : null,
          },
        ]}
      />

      {order.refunds.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Refunds</h3>
          <ul className="divide-y divide-black/5 rounded-2xl border border-black/5">
            {order.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {r.refundNumber} <StatusBadge status={r.status} />
                    {r.returnRequestId && <Badge>Return</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/55">
                    {dateTime(r.createdAt)}
                    {r.reason && <> · {r.reason}</>}
                  </p>
                  {r.razorpayRefundId && <Mono className="block">{r.razorpayRefundId}</Mono>}
                  {r.failureReason && <p className="text-xs text-danger">{r.failureReason}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{moneyExact(r.amount)}</span>
                  {r.status === "FAILED" && (
                    <Can permission="refunds.create">
                      <Button variant="outline" size="sm" icon={<RotateCcw size={13} />} onClick={() => setRetrying(r)}>
                        Retry
                      </Button>
                    </Can>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {refundOpen && <RefundModal order={order} refundable={refundable} onClose={() => setRefundOpen(false)} />}
      <ConfirmDialog
        open={!!retrying}
        title={`Retry refund ${retrying?.refundNumber ?? ""}?`}
        body={retrying && <>The gateway will be asked again to refund {moneyExact(retrying.amount)} to the customer.</>}
        confirmLabel="Retry refund"
        loading={retry.isPending}
        onConfirm={() => retrying && retry.mutate(retrying.id)}
        onClose={() => setRetrying(null)}
      />
    </Card>
  );
}

/**
 * Manual refund. The amount is optional (empty = everything still
 * refundable). One idempotency key per dialog open makes double clicks and
 * network retries safe.
 */
function RefundModal({ order, refundable, onClose }: { order: StaffOrder; refundable: number; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; reason?: string; root?: string }>({});
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [saving, setSaving] = useState(false);

  const effective = amount ?? refundable;
  // The API refunds from the largest captured payment that can cover the amount.
  const source = order.payments
    .filter((p) => CAPTURED.includes(p.status))
    .sort((a, b) => b.amount - a.amount)
    .find((p) => p.amount - p.amountRefunded >= effective);

  const review = () => {
    const next: typeof errors = {};
    if (amount != null && amount <= 0) next.amount = "Enter an amount above ₹0, or leave empty for a full refund";
    else if (amount != null && amount > refundable) next.amount = `At most ${moneyExact(refundable)} can be refunded`;
    if (reason.trim().length < 3) next.reason = "Enter a reason (at least 3 characters)";
    setErrors(next);
    if (!Object.keys(next).length) setStep("confirm");
  };

  const submit = async () => {
    setSaving(true);
    try {
      const refund = await api.post<StaffRefund>("/refunds", { orderId: order.id, amount: amount ?? undefined, reason: reason.trim() }, { idempotencyKey });
      if (refund.status === "FAILED") {
        toast(`Refund ${refund.refundNumber} failed${refund.failureReason ? `: ${refund.failureReason}` : ""}. You can retry it from the order.`, "error");
      } else {
        toast(refund.status === "PROCESSED" ? `Refund ${refund.refundNumber} of ${moneyExact(refund.amount)} recorded` : `Refund ${refund.refundNumber} of ${moneyExact(refund.amount)} sent to the gateway`);
      }
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "REFUND_FAILED") {
        // The attempt was recorded as a FAILED refund; retrying that record is the safe path.
        toast(`${e.message}. The failed refund is listed on the order — use Retry.`, "error");
        onClose();
        return;
      }
      const next: typeof errors = {};
      if (e instanceof ApiError && e.errors.length) {
        for (const fe of e.errors) {
          if (fe.path === "amount" || fe.path === "reason") next[fe.path] = fe.message;
          else next.root = fe.message;
        }
      } else {
        next.root = errorMessage(e);
      }
      setErrors(next);
      setStep("form");
    } finally {
      setSaving(false);
      void invalidate(order.id);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={step === "form" ? `Refund ${order.orderNumber}` : "Confirm refund"}
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
              { label: "Order total", value: moneyExact(order.grandTotal) },
              { label: "Already refunded", value: moneyExact(order.amountRefunded) },
              { label: "Refundable now", value: <strong>{moneyExact(refundable)}</strong> },
            ]}
          />
          <Field label="Amount" htmlFor="refund-amount" error={errors.amount} hint={`Leave empty to refund the full ${moneyExact(refundable)}.`}>
            <MoneyInput id="refund-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} placeholder={(refundable / 100).toFixed(2)} max={refundable / 100} />
          </Field>
          <Field label="Reason" htmlFor="refund-reason" required error={errors.reason} hint="Shown on the credit note.">
            <Textarea id="refund-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!errors.reason} className="min-h-20" placeholder="e.g. Item arrived damaged" />
          </Field>
          <p className="text-xs text-ink/50">
            This only moves money; it does not change stock. To take items back, create a return instead. A GST credit note is issued automatically.
          </p>
          {errors.root && <Notice tone="danger">{errors.root}</Notice>}
        </form>
      ) : (
        <div className="space-y-4 text-sm">
          <p>
            You are about to refund <strong>{moneyExact(effective)}</strong>
            {amount == null && " (the full refundable amount)"} on {order.orderNumber}.
          </p>
          <DefinitionList
            className="rounded-2xl bg-offwhite p-4"
            rows={[
              { label: "Refund to", value: source ? `${providerLabel(source.provider)}${source.method ? ` · ${source.method}` : ""}` : "—" },
              { label: "Reason", value: reason.trim() },
            ]}
          />
          {source?.provider === "RAZORPAY" ? (
            <Notice>The refund is sent to Razorpay. It usually reaches the customer in 5–7 working days.</Notice>
          ) : source ? (
            <Notice tone="warning">Counter payments are refunded by hand: the refund is recorded as processed immediately, so hand the money back to the customer.</Notice>
          ) : (
            <Notice tone="warning">No single payment covers this amount. Refund each payment separately.</Notice>
          )}
          <p className="text-ink/60">Refunds cannot be undone.</p>
        </div>
      )}
    </Modal>
  );
}
