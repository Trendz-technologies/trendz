"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PackageCheck } from "lucide-react";
import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, newIdempotencyKey } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { applyApiErrors, FormError, qty } from "./inventory-shared";
import type { PoDetail } from "./inventory-types";

const schema = z
  .object({
    notes: z.string().max(1000, "1,000 characters at most"),
    items: z.array(
      z.object({
        purchaseOrderItemId: z.string(),
        pending: z.number(),
        quantityReceived: z.number({ error: "Enter a number" }).int("Whole numbers only").min(0, "Cannot be negative"),
        quantityDamaged: z.number({ error: "Enter a number" }).int("Whole numbers only").min(0, "Cannot be negative"),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    v.items.forEach((i, idx) => {
      if (i.quantityReceived + i.quantityDamaged > i.pending) {
        ctx.addIssue({ code: "custom", path: ["items", idx, "quantityReceived"], message: `Good + damaged cannot exceed ${i.pending} pending` });
      }
    });
    if (!v.items.some((i) => i.quantityReceived + i.quantityDamaged > 0)) {
      ctx.addIssue({ code: "custom", path: ["root"], message: "Enter at least one received quantity" });
    }
  });
type Values = z.infer<typeof schema>;

const num = (n: number) => (Number.isFinite(n) ? n : 0);

/**
 * Goods received note against an approved PO. The Idempotency-Key is created
 * once when the modal opens, so a double click or a retried request after a
 * network error can never add the stock twice.
 */
export function ReceiveGoodsModal({ po, onClose }: { po: PoDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const open = po.items.filter((i) => i.quantityPending > 0);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { notes: "", items: open.map((i) => ({ purchaseOrderItemId: i.id, pending: i.quantityPending, quantityReceived: 0, quantityDamaged: 0 })) },
  });
  const { fields } = useFieldArray({ control, name: "items" });
  const values = useWatch({ control, name: "items" });
  const good = (values ?? []).reduce((s, i) => s + num(i.quantityReceived), 0);
  const damaged = (values ?? []).reduce((s, i) => s + num(i.quantityDamaged), 0);

  const fill = (all: boolean) =>
    open.forEach((i, idx) => {
      setValue(`items.${idx}.quantityReceived`, all ? i.quantityPending : 0, { shouldValidate: false });
      setValue(`items.${idx}.quantityDamaged`, 0, { shouldValidate: false });
    });

  const submit = handleSubmit(async (v) => {
    try {
      const res = await api.post<PoDetail>(
        `/purchase-orders/${po.id}/receive`,
        {
          notes: v.notes.trim() || null,
          items: v.items
            .filter((i) => i.quantityReceived + i.quantityDamaged > 0)
            .map((i) => ({ purchaseOrderItemId: i.purchaseOrderItemId, quantityReceived: i.quantityReceived, quantityDamaged: i.quantityDamaged })),
        },
        { idempotencyKey },
      );
      void qc.invalidateQueries({ queryKey: ["admin", "purchase-orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      void qc.invalidateQueries({ queryKey: ["admin", "inventory"] });
      void qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      toast(`Goods received — ${po.number} is now ${titleCase(res.status).toLowerCase()}`);
      onClose();
    } catch (err) {
      applyApiErrors(err, setError, ["items", "notes"]);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Receive goods · ${po.number}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit} icon={<PackageCheck size={15} />} disabled={good + damaged === 0}>
            Receive {qty(good + damaged)} unit(s)
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink/60">
            Into <span className="font-semibold text-ink">{po.warehouse.code} · {po.warehouse.name}</span>. Good units are added to on-hand stock; damaged units go to the damaged bucket.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fill(true)}>
              Fill all pending
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fill(false)}>
              Clear
            </Button>
          </div>
        </div>

        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
                <th className="px-5 py-2.5 font-semibold">Item</th>
                <th className="px-2 py-2.5 text-right font-semibold">Ordered</th>
                <th className="px-2 py-2.5 text-right font-semibold">Received</th>
                <th className="px-2 py-2.5 text-right font-semibold">Pending</th>
                <th className="w-28 px-2 py-2.5 font-semibold">Good</th>
                <th className="w-28 px-5 py-2.5 pl-2 font-semibold">Damaged</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, idx) => {
                const item = open[idx]!;
                const e = errors.items?.[idx];
                const msg = e?.quantityReceived?.message ?? e?.quantityDamaged?.message;
                return (
                  <tr key={f.id} className="border-b border-black/4 align-top last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium">{item.description}</p>
                      <p className="font-mono text-xs text-ink/50">{item.sku}</p>
                      {msg && <p className="mt-1 text-xs text-danger">{msg}</p>}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-ink/60">{qty(item.quantityOrdered)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-ink/60">{qty(item.quantityReceived)}</td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums">{qty(item.quantityPending)}</td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={item.quantityPending}
                        step={1}
                        aria-label={`Good units received for ${item.sku}`}
                        invalid={!!e?.quantityReceived}
                        {...register(`items.${idx}.quantityReceived`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-5 py-2 pl-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={item.quantityPending}
                        step={1}
                        aria-label={`Damaged units received for ${item.sku}`}
                        invalid={!!e?.quantityDamaged}
                        {...register(`items.${idx}.quantityDamaged`, { valueAsNumber: true })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(good > 0 || damaged > 0) && (
          <p className="rounded-xl bg-offwhite px-3.5 py-2.5 text-sm text-ink/70">
            This will add <strong className="text-ink">{qty(good)}</strong> good unit(s) to on-hand stock
            {damaged > 0 && (
              <>
                {" "}
                and <strong className="text-ink">{qty(damaged)}</strong> to damaged
              </>
            )}{" "}
            at {po.warehouse.code}, and record a goods received note.
          </p>
        )}

        <Field label="Notes" htmlFor="grn-notes" error={errors.notes?.message} hint="Optional — e.g. supplier invoice / challan number, condition">
          <Textarea id="grn-notes" rows={2} className="min-h-0" invalid={!!errors.notes} {...register("notes")} />
        </Field>
        <FormError message={errors.root?.message} />
      </form>
    </Modal>
  );
}
