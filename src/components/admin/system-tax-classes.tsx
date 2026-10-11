"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Spinner, type Tone } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { date, moneyExact, percent, toPaise, toRupees } from "@/lib/format";
import { istDay, istDaysAgo, istStartOf } from "./system-data";
import { AccountantNotice, MoneyMark } from "./system-settings-forms";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { withinChars } from "@/lib/rich-text";

interface TaxRateRow {
  rateBps: number;
  minUnitPrice: number | null;
  maxUnitPrice: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}
interface TaxClassRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  rates: TaxRateRow[];
}

const nowMs = () => Date.now();

function slabLabel(r: Pick<TaxRateRow, "minUnitPrice" | "maxUnitPrice">) {
  if (r.minUnitPrice == null && r.maxUnitPrice == null) return "Any price";
  if (r.minUnitPrice == null) return `Up to ${moneyExact(r.maxUnitPrice)}`;
  if (r.maxUnitPrice == null) return `${moneyExact(r.minUnitPrice)} and above`;
  return `${moneyExact(r.minUnitPrice)} – ${moneyExact(r.maxUnitPrice)}`;
}

function rateStatus(r: TaxRateRow, now: number): { label: string; tone: Tone } {
  if (new Date(r.effectiveFrom).getTime() > now) return { label: "Scheduled", tone: "info" };
  if (r.effectiveTo && new Date(r.effectiveTo).getTime() <= now) return { label: "Ended", tone: "neutral" };
  return { label: "In effect", tone: "success" };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function TaxClassesSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "tax-classes"], queryFn: () => api.get<TaxClassRow[]>("/tax-classes") });
  const [editing, setEditing] = useState<TaxClassRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<TaxClassRow | null>(null);
  const now = nowMs();

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/tax-classes/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "tax-classes"] });
      toast("Tax class deleted");
      setDeleting(null);
    },
    onError: (e) => {
      toast(errorMessage(e), "error");
      setDeleting(null);
    },
  });

  return (
    <div className="space-y-6">
      <AccountantNotice>
        Tax classes decide the GST rate on every product line. A product without a class uses the default class. Rate changes apply from their effective date to new orders only; issued invoices never change.
      </AccountantNotice>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/60">Rates can depend on the per-unit taxable value (price slabs) and have effective dates, so GST changes need no code change.</p>
        {canEdit && (
          <Button icon={<Plus size={15} />} onClick={() => setEditing("new")}>
            New tax class
          </Button>
        )}
      </div>
      {q.error ? (
        <Card>
          <ErrorState error={q.error} retry={() => q.refetch()} />
        </Card>
      ) : !q.data ? (
        <Spinner />
      ) : q.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No tax classes yet"
            body="Orders cannot be priced until at least one default tax class exists."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setEditing("new")}>
                  Create a tax class
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {q.data.map((c) => (
            <Card
              key={c.id}
              title={
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {c.name}
                    {c.isDefault && <Badge tone="dark">Default</Badge>}
                  </h3>
                  <code className="text-[11px] text-ink/45">{c.code}</code>
                </div>
              }
              actions={
                canEdit ? (
                  <>
                    <Button variant="ghost" size="sm" aria-label={`Edit ${c.name}`} icon={<Pencil size={14} />} onClick={() => setEditing(c)} />
                    <Button variant="ghost" size="sm" aria-label={`Delete ${c.name}`} icon={<Trash2 size={14} />} disabled={c.isDefault} title={c.isDefault ? "Make another class the default first" : undefined} onClick={() => setDeleting(c)} />
                  </>
                ) : undefined
              }
            >
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-ink/45">
                      <th className="px-5 pb-2 font-semibold">GST</th>
                      <th className="px-2 pb-2 font-semibold">Per-unit value</th>
                      <th className="px-2 pb-2 font-semibold">Effective</th>
                      <th className="px-5 pb-2 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...c.rates]
                      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || (a.minUnitPrice ?? 0) - (b.minUnitPrice ?? 0))
                      .map((r, i) => {
                        const st = rateStatus(r, now);
                        return (
                          <tr key={i} className="border-t border-black/[0.05]">
                            <td className="px-5 py-2 font-semibold tabular-nums">{percent(r.rateBps)}</td>
                            <td className="px-2 py-2 text-ink/70">{slabLabel(r)}</td>
                            <td className="px-2 py-2 text-ink/70">
                              {date(r.effectiveFrom)}
                              {r.effectiveTo ? ` → ${date(r.effectiveTo)}` : " onwards"}
                            </td>
                            <td className="px-5 py-2 text-right">
                              <Badge tone={st.tone}>{st.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <TaxClassModal taxClass={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        tone="danger"
        confirmLabel="Delete tax class"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
        body="Products that use this class must be moved to another class first. This cannot be undone."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

const rupees = (v: string) => v === "" || /^\d+(\.\d{1,2})?$/.test(v);

const rateSchema = z
  .object({
    percent: z
      .string()
      .trim()
      .min(1, "Required")
      .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100, "0–100, up to 2 decimals"),
    min: z.string().trim().refine(rupees, "Amount in ₹"),
    max: z.string().trim().refine(rupees, "Amount in ₹"),
    from: z.string().min(1, "Required"),
    to: z.string(),
    fromIso: z.string(),
    toIso: z.string(),
  })
  .superRefine((r, ctx) => {
    if (r.min !== "" && r.max !== "" && Number(r.min) > Number(r.max)) ctx.addIssue({ code: "custom", path: ["max"], message: "Must be at least the minimum" });
    if (r.to && r.from && r.to <= r.from) ctx.addIssue({ code: "custom", path: ["to"], message: "Must be after the start date" });
  });

const schema = z
  .object({
    code: z.string().trim().regex(/^[A-Z0-9_]{2,30}$/, "2–30 characters: A–Z, 0–9 and _"),
    name: z.string().trim().min(2, "At least 2 characters").max(80),
    description: z.string().refine(withinChars(500), "At most 500 characters"),
    isDefault: z.boolean(),
    rates: z.array(rateSchema).min(1, "Add at least one rate").max(20, "At most 20 rates"),
  })
  .superRefine((c, ctx) => {
    // Mirrors the API: slabs starting on the same day must not overlap.
    const sorted = [...c.rates].sort((a, b) => Number(a.min || 0) - Number(b.min || 0));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (prev.from === cur.from && (prev.max === "" || Number(cur.min || 0) <= Number(prev.max))) {
        ctx.addIssue({ code: "custom", path: ["rates"], message: `Price slabs starting ${cur.from} overlap. Each slab's minimum must be above the previous slab's maximum.` });
        return;
      }
    }
  });
type Values = z.infer<typeof schema>;
type RateValues = Values["rates"][number];

const blankRate = (): RateValues => ({ percent: "", min: "", max: "", from: istDaysAgo(0), to: "", fromIso: "", toIso: "" });

const toFormRate = (r: TaxRateRow): RateValues => ({
  percent: String(r.rateBps / 100),
  min: toRupees(r.minUnitPrice),
  max: toRupees(r.maxUnitPrice),
  from: istDay(r.effectiveFrom),
  to: r.effectiveTo ? istDay(r.effectiveTo) : "",
  fromIso: r.effectiveFrom,
  toIso: r.effectiveTo ?? "",
});

/** Keeps the exact stored instant when the date was not changed. */
const keepOrDay = (day: string, iso: string) => (iso && istDay(iso) === day ? iso : istStartOf(day));

const API_RATE_FIELDS: Record<string, keyof RateValues> = { rateBps: "percent", minUnitPrice: "min", maxUnitPrice: "max", effectiveFrom: "from", effectiveTo: "to" };

function TaxClassModal({ taxClass, onClose }: { taxClass: TaxClassRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState<Values | null>(null);
  const [saving, setSaving] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: taxClass?.code ?? "",
      name: taxClass?.name ?? "",
      description: taxClass?.description ?? "",
      isDefault: taxClass?.isDefault ?? false,
      rates: taxClass ? taxClass.rates.map(toFormRate) : [blankRate()],
    },
  });
  const rates = useFieldArray({ control, name: "rates" });

  const save = async (v: Values) => {
    setSaving(true);
    const body = {
      code: v.code,
      name: v.name,
      description: v.description || null,
      isDefault: v.isDefault,
      rates: v.rates.map((r) => ({
        rateBps: Math.round(Number(r.percent) * 100),
        minUnitPrice: r.min === "" ? null : toPaise(r.min),
        maxUnitPrice: r.max === "" ? null : toPaise(r.max),
        effectiveFrom: keepOrDay(r.from, r.fromIso),
        effectiveTo: r.to ? keepOrDay(r.to, r.toIso) : null,
      })),
    };
    try {
      if (taxClass) await api.put(`/tax-classes/${taxClass.id}`, body);
      else await api.post("/tax-classes", body);
      void qc.invalidateQueries({ queryKey: ["admin", "tax-classes"] });
      toast(taxClass ? "Tax class saved" : "Tax class created");
      onClose();
    } catch (err) {
      setConfirming(null);
      if (err instanceof ApiError && err.errors.length) {
        const other: string[] = [];
        for (const e of err.errors) {
          const parts = e.path.split(".");
          if (["code", "name", "description"].includes(parts[0]!)) setError(parts[0] as Path<Values>, { message: e.message });
          else if (parts[0] === "rates" && parts.length >= 2 && /^\d+$/.test(parts[1]!)) setError(`rates.${parts[1]}.${API_RATE_FIELDS[parts[2] ?? ""] ?? "max"}` as Path<Values>, { message: e.message });
          else if (parts[0] === "rates") setError("rates", { message: e.message });
          else other.push(`${e.path}: ${e.message}`);
        }
        if (other.length) setError("root", { message: other.join(" · ") });
      } else setError("root", { message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const submit = handleSubmit((v) => setConfirming(v));
  const ratesError = errors.rates?.root?.message ?? errors.rates?.message;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={taxClass ? `Edit ${taxClass.name}` : "New tax class"}
      footer={
        confirming ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <p className="mr-auto text-sm text-warning">This changes the GST charged on new orders. Confirmed with your accountant?</p>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={saving}>
              Back
            </Button>
            <Button loading={saving} onClick={() => void save(confirming)}>
              Yes, save
            </Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit}>{taxClass ? "Save tax class" : "Create tax class"}</Button>
          </>
        )
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <fieldset disabled={!!confirming} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="tc-name" error={errors.name?.message} required>
              <Input id="tc-name" placeholder="Apparel" invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field label="Code" htmlFor="tc-code" error={errors.code?.message} hint="e.g. GST_APPAREL" required>
              <Input id="tc-code" className="font-mono uppercase" invalid={!!errors.code} {...register("code", { setValueAs: (v: string) => v.toUpperCase().trim() })} />
            </Field>
            <Field label="Description" htmlFor="tc-desc" error={errors.description?.message} className="sm:col-span-2">
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <RichTextEditor id="tc-desc" variant="compact" aria-label="Description" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.description} disabled={!!confirming} />
                )}
              />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox label="Default class — used for products without a tax class" {...register("isDefault")} />
              {taxClass?.isDefault && <p className="mt-1 text-xs text-ink/50">To change the default, mark another class as default instead of unticking this one.</p>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  Rates <MoneyMark />
                </p>
                <p className="text-xs text-ink/50">
                  Leave min / max empty for a single rate. Slabs use the taxable value of one unit (₹). A rate applies from its start date until the day before its end date (IST).
                </p>
              </div>
              <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => rates.append(blankRate())} disabled={rates.fields.length >= 20}>
                Add rate
              </Button>
            </div>
            {ratesError && (
              <p role="alert" className="mb-2 rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
                {ratesError}
              </p>
            )}
            <ul className="space-y-3">
              {rates.fields.map((f, i) => {
                const e = errors.rates?.[i];
                return (
                  <li key={f.id} className="rounded-2xl border border-black/[0.08] p-3">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-[100px_1fr_1fr_1fr_1fr_auto]">
                      <Field label="GST %" htmlFor={`r-${i}-p`} error={e?.percent?.message}>
                        <Input id={`r-${i}-p`} inputMode="decimal" placeholder="18" invalid={!!e?.percent} {...register(`rates.${i}.percent`)} />
                      </Field>
                      <Field label="Min ₹ / unit" htmlFor={`r-${i}-min`} error={e?.min?.message}>
                        <Input id={`r-${i}-min`} inputMode="decimal" placeholder="No minimum" invalid={!!e?.min} {...register(`rates.${i}.min`)} />
                      </Field>
                      <Field label="Max ₹ / unit" htmlFor={`r-${i}-max`} error={e?.max?.message}>
                        <Input id={`r-${i}-max`} inputMode="decimal" placeholder="No maximum" invalid={!!e?.max} {...register(`rates.${i}.max`)} />
                      </Field>
                      <Field label="Starts" htmlFor={`r-${i}-from`} error={e?.from?.message}>
                        <Input id={`r-${i}-from`} type="date" invalid={!!e?.from} {...register(`rates.${i}.from`)} />
                      </Field>
                      <Field label="Ends (optional)" htmlFor={`r-${i}-to`} error={e?.to?.message}>
                        <Input id={`r-${i}-to`} type="date" invalid={!!e?.to} {...register(`rates.${i}.to`)} />
                      </Field>
                      <div className="flex items-end justify-end pb-1">
                        <Button variant="ghost" size="sm" aria-label={`Remove rate ${i + 1}`} icon={<X size={15} />} disabled={rates.fields.length <= 1} onClick={() => rates.remove(i)} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </fieldset>
        {errors.root && (
          <p role="alert" className="rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
