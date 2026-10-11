"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowRight, PackageCheck, Send, XCircle } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { applyApiErrors, DetailList, detailedError, FormError, qty, variantLabel } from "@/components/admin/inventory-shared";
import type { TransferDetail } from "@/components/admin/inventory-types";
import { Button, Card, ConfirmDialog, DataTable, ErrorState, Field, Input, Modal, Spinner, StatusBadge, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";

type Action = "dispatch" | "cancel";

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["admin", "inventory", "transfer", id] as const;
  const q = useQuery({ queryKey: key, queryFn: () => api.get<TransferDetail>(`/inventory/transfers/${id}`) });
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [receiving, setReceiving] = useState(false);

  const action = useMutation({
    mutationFn: (a: Action) => api.post<TransferDetail>(`/inventory/transfers/${id}/${a}`),
    onSuccess: (t, a) => {
      qc.setQueryData(key, t);
      void qc.invalidateQueries({ queryKey: ["admin", "inventory"] });
      void qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      setConfirm(null);
      toast(a === "dispatch" ? `${t.number} dispatched — stock deducted from ${t.fromWarehouse.code}` : `${t.number} cancelled`);
    },
    onError: (e) => toast(detailedError(e), "error"),
  });

  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner />;
  const t = q.data;
  const sent = t.items.reduce((s, i) => s + i.quantity, 0);
  const received = t.items.reduce((s, i) => s + i.receivedQuantity, 0);
  const isReceived = t.status === "RECEIVED";

  const confirmCopy: Record<Action, { title: string; body: string; label: string; tone: "primary" | "danger" }> = {
    dispatch: {
      title: `Dispatch ${t.number}?`,
      body: `${qty(sent)} unit(s) will be deducted from ${t.fromWarehouse.code} · ${t.fromWarehouse.name} now and shown as in transit until received.`,
      label: "Dispatch",
      tone: "primary",
    },
    cancel: {
      title: `Cancel ${t.number}?`,
      body:
        t.status === "IN_TRANSIT"
          ? `The ${qty(sent)} unit(s) in transit will be returned to ${t.fromWarehouse.code} · ${t.fromWarehouse.name}. This cannot be undone.`
          : "No stock has moved yet. The draft will be cancelled and cannot be reopened.",
      label: "Cancel transfer",
      tone: "danger",
    },
  };

  return (
    <>
      <PageHeader
        title={t.number}
        description={
          <span className="inline-flex items-center gap-1.5">
            {t.fromWarehouse.name} <ArrowRight size={13} aria-label="to" /> {t.toWarehouse.name}
          </span>
        }
        back={{ href: "/admin/inventory?tab=transfers", label: "Transfers" }}
        actions={
          <>
            <StatusBadge status={t.status} />
            <Can permission="inventory.transfer">
              {(t.status === "DRAFT" || t.status === "IN_TRANSIT") && (
                <Button variant="outline" icon={<XCircle size={15} />} onClick={() => setConfirm("cancel")}>
                  Cancel
                </Button>
              )}
              {t.status === "DRAFT" && (
                <Button icon={<Send size={15} />} onClick={() => setConfirm("dispatch")}>
                  Dispatch
                </Button>
              )}
              {t.status === "IN_TRANSIT" && (
                <Button icon={<PackageCheck size={15} />} onClick={() => setReceiving(true)}>
                  Receive
                </Button>
              )}
            </Can>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Items" actions={<span className="text-xs text-ink/50">{t.items.length} line(s) · {qty(sent)} units</span>}>
          <DataTable
            rows={t.items}
            rowKey={(i) => i.id}
            columns={[
              {
                key: "item",
                header: "Item",
                cell: (i) => (
                  <div>
                    <p className="font-medium">{variantLabel(i.variant.product.name, i.variant.title)}</p>
                    <p className="font-mono text-xs text-ink/50">{i.variant.sku}</p>
                  </div>
                ),
              },
              { key: "qty", header: "Quantity", align: "right", cell: (i) => qty(i.quantity) },
              ...(isReceived
                ? [
                    { key: "rec", header: "Received", align: "right" as const, cell: (i: TransferDetail["items"][number]) => qty(i.receivedQuantity) },
                    {
                      key: "short",
                      header: "Short",
                      align: "right" as const,
                      cell: (i: TransferDetail["items"][number]) => (i.quantity > i.receivedQuantity ? <span className="font-semibold text-danger">{qty(i.quantity - i.receivedQuantity)}</span> : <span className="text-ink/35">0</span>),
                    },
                  ]
                : []),
            ]}
          />
          {isReceived && received < sent && (
            <p className="mt-4 flex items-center gap-1.5 text-sm text-danger">
              <AlertTriangle size={14} aria-hidden /> {qty(sent - received)} unit(s) did not arrive.
            </p>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Route">
            <DetailList
              items={[
                { label: "From", value: <Link href={`/admin/warehouses/${t.fromWarehouse.id}`} className="link">{t.fromWarehouse.code} · {t.fromWarehouse.name}</Link> },
                { label: "To", value: <Link href={`/admin/warehouses/${t.toWarehouse.id}`} className="link">{t.toWarehouse.code} · {t.toWarehouse.name}</Link> },
              ]}
            />
          </Card>
          <Card title="Timeline">
            <ol className="space-y-3 text-sm">
              {[
                { label: "Created", at: t.createdAt },
                { label: "Dispatched", at: t.dispatchedAt },
                { label: "Received", at: t.receivedAt },
                { label: "Cancelled", at: t.cancelledAt },
              ]
                .filter((e) => e.at || (e.label !== "Cancelled" && t.status !== "CANCELLED"))
                .map((e) => (
                  <li key={e.label} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${e.at ? (e.label === "Cancelled" ? "bg-danger" : "bg-success") : "bg-black/15"}`} aria-hidden />
                    <span className={e.at ? "font-medium" : "text-ink/45"}>{e.label}</span>
                    <span className="ml-auto text-xs text-ink/55">{e.at ? dateTime(e.at) : "Pending"}</span>
                  </li>
                ))}
            </ol>
          </Card>
          {t.notes && (
            <Card title="Notes">
              <p className="whitespace-pre-wrap text-sm text-ink/70">{t.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          open
          title={confirmCopy[confirm].title}
          body={confirmCopy[confirm].body}
          confirmLabel={confirmCopy[confirm].label}
          tone={confirmCopy[confirm].tone}
          loading={action.isPending}
          onConfirm={() => action.mutate(confirm)}
          onClose={() => !action.isPending && setConfirm(null)}
        />
      )}
      {receiving && <ReceiveTransferModal transfer={t} onClose={() => setReceiving(false)} />}
    </>
  );
}

const receiveSchema = z.object({
  notes: z.string().max(500, "500 characters at most"),
  items: z.array(
    z.object({
      variantId: z.string(),
      quantity: z.number(),
      receivedQuantity: z.number({ error: "Enter a quantity" }).int("Whole numbers only").min(0, "Cannot be negative"),
    }),
  ),
}).superRefine((v, ctx) => {
  v.items.forEach((i, idx) => {
    if (i.receivedQuantity > i.quantity) ctx.addIssue({ code: "custom", path: ["items", idx, "receivedQuantity"], message: `At most ${i.quantity}` });
  });
});
type ReceiveValues = z.infer<typeof receiveSchema>;

function ReceiveTransferModal({ transfer: t, onClose }: { transfer: TransferDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReceiveValues>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { notes: "", items: t.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, receivedQuantity: i.quantity })) },
  });
  const { fields } = useFieldArray({ control, name: "items" });
  const values = useWatch({ control, name: "items" });
  const sent = t.items.reduce((s, i) => s + i.quantity, 0);
  const receiving = (values ?? []).reduce((s, i) => s + (Number.isFinite(i.receivedQuantity) ? i.receivedQuantity : 0), 0);
  const short = Math.max(0, sent - receiving);

  const submit = handleSubmit(async (v) => {
    try {
      const res = await api.post<TransferDetail>(`/inventory/transfers/${t.id}/receive`, {
        items: v.items.map((i) => ({ variantId: i.variantId, receivedQuantity: i.receivedQuantity })),
        notes: v.notes.trim() || undefined,
      });
      qc.setQueryData(["admin", "inventory", "transfer", t.id], res);
      void qc.invalidateQueries({ queryKey: ["admin", "inventory"] });
      void qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      toast(`${res.number} received into ${res.toWarehouse.code}`);
      onClose();
    } catch (err) {
      applyApiErrors(err, setError, ["items", "notes"]);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Receive ${t.number}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit} icon={<PackageCheck size={15} />}>
            Receive {qty(receiving)} unit(s)
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-ink/60">
          Enter what actually arrived at <span className="font-semibold text-ink">{t.toWarehouse.code} · {t.toWarehouse.name}</span>. Received units are added to its on-hand stock.
        </p>
        <ul className="divide-y divide-black/5 rounded-2xl border border-black/5">
          {fields.map((f, idx) => {
            const item = t.items[idx]!;
            const err = errors.items?.[idx]?.receivedQuantity?.message;
            return (
              <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{variantLabel(item.variant.product.name, item.variant.title)}</p>
                  <p className="font-mono text-xs text-ink/50">
                    {item.variant.sku} · dispatched {qty(item.quantity)}
                  </p>
                </div>
                <div className="w-32">
                  <label className="sr-only" htmlFor={`recv-${idx}`}>
                    Received quantity for {item.variant.sku}
                  </label>
                  <Input id={`recv-${idx}`} type="number" inputMode="numeric" min={0} max={item.quantity} step={1} invalid={!!err} {...register(`items.${idx}.receivedQuantity`, { valueAsNumber: true })} />
                  {err && <p className="mt-1 text-xs text-danger">{err}</p>}
                </div>
              </li>
            );
          })}
        </ul>
        {short > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {qty(short)} unit(s) short. The shortfall is recorded on the transfer; those units are not returned to {t.fromWarehouse.code}.
            </span>
          </p>
        )}
        <Field label="Notes" htmlFor="recv-notes" error={errors.notes?.message} hint="Optional — e.g. condition on arrival">
          <Textarea id="recv-notes" rows={2} className="min-h-0" invalid={!!errors.notes} {...register("notes")} />
        </Field>
        <FormError message={errors.root?.message} />
      </form>
    </Modal>
  );
}
