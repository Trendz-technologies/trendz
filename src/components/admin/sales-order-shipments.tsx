"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink, FileText, FlaskConical, PackagePlus, RefreshCw, Truck, X } from "lucide-react";
import { clsx } from "clsx";
import { Can } from "@/components/admin/page";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date, dateTime, money } from "@/lib/format";
import { applyApiErrors, Mono, Notice, useDownloader, useInvalidateSales } from "./sales-shared";
import { CANCELLABLE_SHIPMENT, CAPTURED, FINAL_SHIPMENT, type StaffOrder, type StaffShipment } from "./sales-types";

const SHIPPABLE_STATUSES = ["CONFIRMED", "PROCESSING", "PACKED"];

export function OrderShipmentsCard({ order }: { order: StaffOrder }) {
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const shippable = CAPTURED.includes(order.paymentStatus) && SHIPPABLE_STATUSES.includes(order.status);

  const create = useMutation({
    mutationFn: () => api.post<StaffShipment[]>("/shipments", { orderId: order.id }),
    onSuccess: (rows) => {
      setConfirmCreate(false);
      toast(rows.length > 1 ? `${rows.length} shipments created` : `Shipment created${rows[0]?.awb ? ` · AWB ${rows[0].awb}` : ""}`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
    onSettled: () => void invalidate(order.id),
  });

  return (
    <Card
      title="Shipments"
      actions={
        shippable && (
          <Can permission="shipping.manage">
            <Button variant="ghost" size="sm" onClick={() => setManualOpen(true)}>
              Manual
            </Button>
            <Button variant="secondary" size="sm" icon={<PackagePlus size={14} />} onClick={() => setConfirmCreate(true)}>
              Create shipment
            </Button>
          </Can>
        )
      }
    >
      {order.shipments.length === 0 ? (
        <EmptyState
          icon={<Truck size={22} />}
          title="No shipments yet"
          body={
            shippable
              ? "Create a shipment to book the courier, or record one you booked yourself with Manual."
              : CAPTURED.includes(order.paymentStatus)
                ? `Orders that are ${order.status.replace(/_/g, " ").toLowerCase()} cannot be shipped.`
                : "The order can be shipped once it is paid."
          }
        />
      ) : (
        <div className="space-y-4">
          {order.shipments.map((s) => (
            <ShipmentBlock key={s.id} shipment={s} orderId={order.id} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmCreate}
        title="Book the courier?"
        body={
          <div className="space-y-2">
            <p>A shipment is created with the shipping provider for every warehouse that holds items of this order, and the order moves to Packed.</p>
            <p>The courier charges for the booking. Cancel before pickup if you change your mind.</p>
          </div>
        }
        confirmLabel="Create shipment"
        loading={create.isPending}
        onConfirm={() => create.mutate()}
        onClose={() => setConfirmCreate(false)}
      />
      {manualOpen && <ManualShipmentModal order={order} onClose={() => setManualOpen(false)} />}
    </Card>
  );
}

function ShipmentBlock({ shipment: s, orderId }: { shipment: StaffShipment; orderId: string }) {
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const { busy, run } = useDownloader();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const final = FINAL_SHIPMENT.includes(s.status);

  const refresh = useMutation({
    mutationFn: () => api.get<StaffShipment>(`/shipments/${s.id}/tracking`),
    onSuccess: () => toast("Tracking updated"),
    onError: (e) => toast(errorMessage(e), "error"),
    onSettled: () => void invalidate(orderId),
  });
  const cancel = useMutation({
    mutationFn: () => api.post<StaffShipment>(`/shipments/${s.id}/cancel`),
    onSuccess: () => {
      setConfirmCancel(false);
      toast("Shipment cancelled");
    },
    onError: (e) => toast(errorMessage(e), "error"),
    onSettled: () => void invalidate(orderId),
  });
  const simulate = useMutation({
    mutationFn: () => api.post<StaffShipment>(`/shipments/${s.id}/simulate`),
    onSuccess: (r) => toast(`Mock courier: ${r.status.replace(/_/g, " ").toLowerCase()}`, "info"),
    onError: (e) => toast(errorMessage(e), "error"),
    onSettled: () => void invalidate(orderId),
  });

  const events = showAll ? s.events : s.events.slice(0, 4);

  return (
    <article className="rounded-2xl border border-black/5 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {s.courierName ?? "Courier"}
            <StatusBadge status={s.status} />
            {s.isReturn && <Badge tone="warning">Return pickup</Badge>}
            <Badge>{s.provider === "MOCK" ? "Mock provider" : s.provider === "MANUAL" ? "Manual" : s.provider}</Badge>
          </p>
          <p className="mt-1 text-xs text-ink/55">
            AWB {s.awb ? <Mono className="text-xs text-ink">{s.awb}</Mono> : "pending"} · created {dateTime(s.createdAt)}
          </p>
          <p className="mt-0.5 text-xs text-ink/50">
            {[
              s.estimatedDeliveryAt && `ETA ${date(s.estimatedDeliveryAt)}`,
              s.weightGrams && `${(s.weightGrams / 1000).toFixed(2)} kg`,
              s.shippingCost != null && `courier cost ${money(s.shippingCost)}`,
              s.lastSyncedAt && `synced ${dateTime(s.lastSyncedAt)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {s.trackingUrl && (
            <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-ink/70 hover:bg-black/[0.04] hover:text-ink">
              Track <ExternalLink size={12} />
            </a>
          )}
          {!final && s.provider !== "MANUAL" && (
            <Button variant="ghost" size="sm" icon={<RefreshCw size={13} className={refresh.isPending ? "animate-spin" : undefined} />} disabled={refresh.isPending} onClick={() => refresh.mutate()}>
              Refresh
            </Button>
          )}
          {s.status !== "CANCELLED" && (
            <Button variant="outline" size="sm" icon={<FileText size={13} />} loading={busy === "label"} onClick={() => run("label", `/shipments/${s.id}/label`, "label.pdf", `/api/shipments/${s.id}/label`)}>
              Label
            </Button>
          )}
          {CANCELLABLE_SHIPMENT.includes(s.status) && (
            <Can permission="shipping.manage">
              <Button variant="ghost" size="sm" icon={<X size={13} />} className="text-danger!" onClick={() => setConfirmCancel(true)}>
                Cancel
              </Button>
            </Can>
          )}
        </div>
      </header>

      {s.events.length > 0 && (
        <ol className="mt-4 space-y-3 border-l border-black/10 pl-4">
          {events.map((e, i) => (
            <li key={e.id} className="relative text-sm">
              <span className={clsx("absolute -left-5.25 top-1.5 h-2 w-2 rounded-full ring-4 ring-white", i === 0 ? "bg-ink" : "bg-black/20")} aria-hidden />
              <p className="font-medium">{e.description ?? e.rawStatus}</p>
              <p className="text-xs text-ink/50">
                {dateTime(e.occurredAt)}
                {e.location && <> · {e.location}</>}
                {e.description && e.rawStatus !== e.description && <> · {e.rawStatus}</>}
              </p>
            </li>
          ))}
        </ol>
      )}
      {s.events.length > 4 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-semibold text-ink/55 hover:text-ink">
          {showAll ? "Show fewer events" : `Show all ${s.events.length} events`}
        </button>
      )}

      {s.provider === "MOCK" && !final && (
        <Can permission="shipping.manage">
          <div className="mt-3 flex items-center justify-end border-t border-dashed border-black/10 pt-2">
            <button
              type="button"
              onClick={() => simulate.mutate()}
              disabled={simulate.isPending}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink/40 hover:text-ink/70 disabled:opacity-50"
              title="Development only: advances the mock parcel to its next courier status"
            >
              <FlaskConical size={12} /> {simulate.isPending ? "Simulating…" : "Simulate next courier status (dev)"}
            </button>
          </div>
        </Can>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this shipment?"
        body="The courier booking is cancelled. Items stay with the order, so you can create a new shipment afterwards."
        confirmLabel="Cancel shipment"
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onClose={() => setConfirmCancel(false)}
      />
    </article>
  );
}

const manualSchema = z.object({
  courierName: z.string().trim().min(2, "At least 2 characters").max(80),
  awb: z.string().trim().min(4, "At least 4 characters").max(40),
  trackingUrl: z.union([z.literal(""), z.url("Enter a full URL, e.g. https://…")]),
});
type ManualValues = z.infer<typeof manualSchema>;

function ManualShipmentModal({ order, onClose }: { order: StaffOrder; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ManualValues>({ resolver: zodResolver(manualSchema), defaultValues: { courierName: "", awb: "", trackingUrl: "" } });

  const submit = handleSubmit(async (v) => {
    try {
      await api.post("/shipments/manual", { orderId: order.id, courierName: v.courierName, awb: v.awb, trackingUrl: v.trackingUrl || undefined });
      void invalidate(order.id);
      toast("Shipment recorded — order marked as shipped");
      onClose();
    } catch (e) {
      applyApiErrors(e, setError, ["courierName", "awb", "trackingUrl"]);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Record a manual shipment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit}>
            Mark as shipped
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Notice>Use this when the parcel was booked outside the app (e.g. a local courier). The order is marked as shipped and the customer is notified with the AWB.</Notice>
        <Field label="Courier" htmlFor="courier" required error={errors.courierName?.message}>
          <Input id="courier" autoFocus invalid={!!errors.courierName} placeholder="e.g. Blue Dart" {...register("courierName")} />
        </Field>
        <Field label="AWB / tracking number" htmlFor="awb" required error={errors.awb?.message}>
          <Input id="awb" invalid={!!errors.awb} className="font-mono" {...register("awb")} />
        </Field>
        <Field label="Tracking URL" htmlFor="tracking-url" error={errors.trackingUrl?.message} hint="Optional. Shared with the customer.">
          <Input id="tracking-url" type="url" inputMode="url" invalid={!!errors.trackingUrl} placeholder="https://" {...register("trackingUrl")} />
        </Field>
        {errors.root && <Notice tone="danger">{errors.root.message}</Notice>}
      </form>
    </Modal>
  );
}
