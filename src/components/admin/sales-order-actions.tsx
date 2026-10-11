"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Printer, RefreshCw, Workflow } from "lucide-react";
import { Can } from "@/components/admin/page";
import { Button, ConfirmDialog, Field, Modal, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { moneyExact, titleCase } from "@/lib/format";
import { Notice, useDownloader, useInvalidateSales } from "./sales-shared";
import { CAPTURED, type OrderStatus, type StaffOrder } from "./sales-types";

const STATUS_HELP: Partial<Record<OrderStatus, string>> = {
  PROCESSING: "Items are being picked.",
  PACKED: "Ready to hand over to the courier.",
  SHIPPED: "Handed to the courier. The customer is notified. Prefer creating a shipment, which sets this automatically.",
  OUT_FOR_DELIVERY: "With the delivery agent. The customer is notified. Usually set from courier tracking.",
  DELIVERED: "Received by the customer. Starts the return window and notifies the customer.",
};

/** Header buttons of the order page: refresh, receipt, status update and cancellation. */
export function OrderActions({ order, onRefresh, refreshing }: { order: StaffOrder; onRefresh: () => void; refreshing: boolean }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { busy, run } = useDownloader();

  return (
    <>
      <Button variant="ghost" size="sm" icon={<RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />} onClick={onRefresh} aria-label="Reload order">
        <span className="hidden sm:inline">Reload</span>
      </Button>
      {order.channel === "POS" && (
        <Can permission="pos.use">
          <Button variant="outline" size="sm" loading={busy === "receipt"} icon={<Printer size={14} />} onClick={() => run("receipt", `/pos/orders/${order.id}/receipt`)}>
            Print receipt
          </Button>
        </Can>
      )}
      {order.allowedTransitions.length > 0 && (
        <Can permission="orders.update">
          <Button variant="secondary" size="sm" icon={<Workflow size={14} />} onClick={() => setStatusOpen(true)}>
            Update status
          </Button>
        </Can>
      )}
      {order.canCancel && (
        <Can permission="orders.cancel">
          <Button variant="outline" size="sm" icon={<Ban size={14} />} onClick={() => setCancelOpen(true)} className="text-danger!">
            Cancel order
          </Button>
        </Can>
      )}
      {statusOpen && <StatusModal order={order} onClose={() => setStatusOpen(false)} />}
      {cancelOpen && <CancelOrderDialog order={order} onClose={() => setCancelOpen(false)} />}
    </>
  );
}

function StatusModal({ order, onClose }: { order: StaffOrder; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const [status, setStatus] = useState<OrderStatus>(order.allowedTransitions[0]!);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const paid = CAPTURED.includes(order.paymentStatus);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<StaffOrder>(`/orders/${order.id}/status`, { status, note: note.trim() || undefined });
      qc.setQueryData(["admin", "order", order.id], updated);
      void invalidate(order.id);
      toast(`Order marked as ${titleCase(status).toLowerCase()}`);
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
      title={`Update ${order.orderNumber}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!paid} onClick={submit}>
            Update status
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (paid) void submit();
        }}
      >
        {!paid && <Notice tone="warning">Only paid orders can be fulfilled. This order&apos;s payment is {titleCase(order.paymentStatus).toLowerCase()}.</Notice>}
        <Field label="New status" htmlFor="order-status" hint={STATUS_HELP[status]}>
          <Select id="order-status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {order.allowedTransitions.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" htmlFor="status-note" hint="Optional. Kept in the order timeline (not shown to the customer).">
          <Textarea id="status-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
        </Field>
        <p className="text-xs text-ink/50">Confirmed, cancelled, returned and refunded are set automatically by payments, cancellations, returns and refunds.</p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}

function CancelOrderDialog({ order, onClose }: { order: StaffOrder; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const paid = CAPTURED.includes(order.paymentStatus);
  const refundable = order.payments.filter((p) => CAPTURED.includes(p.status)).reduce((s, p) => s + p.amount - p.amountRefunded, 0);

  const submit = async () => {
    if (reason.trim().length < 3) {
      setError("Enter a reason (at least 3 characters)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { refundError, ...updated } = await api.post<StaffOrder & { refundError?: string | null }>(`/orders/${order.id}/cancel`, { reason: reason.trim() });
      qc.setQueryData(["admin", "order", order.id], updated);
      // The cancellation stands even when the automatic gateway refund fails.
      if (refundError) toast(`Order cancelled, but the automatic refund failed: ${refundError}. Retry it under Payments & refunds.`, "error");
      else toast(paid ? "Order cancelled and refund initiated" : "Order cancelled");
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "REFUND_FAILED") {
        // The order was cancelled; only the automatic gateway refund failed.
        toast(`Order cancelled, but the automatic refund failed: ${e.message}. Retry it under Payments & refunds.`, "error");
        onClose();
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setSaving(false);
      void invalidate(order.id);
    }
  };

  return (
    <ConfirmDialog
      open
      title={`Cancel ${order.orderNumber}?`}
      confirmLabel="Cancel order"
      tone="danger"
      loading={saving}
      onConfirm={submit}
      onClose={onClose}
      body={
        <div className="space-y-2">
          {paid ? (
            <p>
              This order is paid. Cancelling it automatically refunds <strong>{moneyExact(refundable)}</strong> to the original payment method (cash and counter UPI refunds are recorded immediately — hand the money back).
            </p>
          ) : (
            <p>This order is not paid, so no refund is needed. Any pending payment link stops working.</p>
          )}
          <p>{order.status === "PENDING" ? "Reserved stock is released." : "Stock is put back in the warehouse it was taken from."} The customer is notified. This cannot be undone.</p>
        </div>
      }
    >
      <Field label="Reason" htmlFor="cancel-reason" required error={error ?? undefined} className="mt-4">
        <Textarea id="cancel-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!error} className="min-h-20" placeholder="e.g. Customer asked to cancel" />
      </Field>
    </ConfirmDialog>
  );
}
