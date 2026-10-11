"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { isPhoneNumber } from "@/lib/phone";
import { applyApiErrors, FormError, GSTIN_PATTERN, orNull, PIN_PATTERN, StateOptions, useIndianStates } from "./inventory-shared";
import type { Supplier } from "./inventory-types";
import { gstinStateIssue } from "./inventory-warehouse-form";

const schema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{2,20}$/, "2–20 letters, numbers or hyphens"),
  name: z.string().trim().min(2, "At least 2 characters").max(120),
  companyName: z.string().trim().max(200),
  contactPerson: z.string().trim().max(100),
  phone: z.string().trim().refine((v) => !v || isPhoneNumber(v), "Enter a valid phone number"),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  gstin: z.string().trim().refine((v) => v === "" || GSTIN_PATTERN.test(v.toUpperCase()), "Enter a valid 15-character GSTIN"),
  addressLine1: z.string().trim().max(200),
  addressLine2: z.string().trim().max(200),
  city: z.string().trim().max(100),
  state: z.string(),
  postalCode: z.string().trim().regex(new RegExp(`^$|${PIN_PATTERN.source}`), "Enter a valid 6-digit PIN code"),
  paymentTermsDays: z.number({ error: "Enter a number of days" }).int("Whole days only").min(0, "0 or more").max(365, "At most 365 days").nullable(),
  paymentTerms: z.string().trim().max(300, "300 characters at most"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  notes: z.string().trim().max(2000, "2,000 characters at most"),
});
type Values = z.infer<typeof schema>;
const FIELDS = Object.keys(schema.shape);

export function SupplierFormModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved?: (s: Supplier) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const states = useIndianStates();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: supplier?.code ?? "",
      name: supplier?.name ?? "",
      companyName: supplier?.companyName ?? "",
      contactPerson: supplier?.contactPerson ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      gstin: supplier?.gstin ?? "",
      addressLine1: supplier?.addressLine1 ?? "",
      addressLine2: supplier?.addressLine2 ?? "",
      city: supplier?.city ?? "",
      state: supplier?.state ?? "",
      postalCode: supplier?.postalCode ?? "",
      paymentTermsDays: supplier?.paymentTermsDays ?? null,
      paymentTerms: supplier?.paymentTerms ?? "",
      status: supplier?.status ?? "ACTIVE",
      notes: supplier?.notes ?? "",
    },
  });

  const submit = handleSubmit(async (v) => {
    const gstIssue = gstinStateIssue(v.gstin, v.state, states.data);
    if (gstIssue) {
      setError("gstin", { message: gstIssue });
      return;
    }
    const body = {
      code: v.code.trim().toUpperCase(),
      name: v.name.trim(),
      companyName: orNull(v.companyName),
      contactPerson: orNull(v.contactPerson),
      phone: orNull(v.phone),
      email: orNull(v.email),
      gstin: orNull(v.gstin)?.toUpperCase() ?? null,
      addressLine1: orNull(v.addressLine1),
      addressLine2: orNull(v.addressLine2),
      city: orNull(v.city),
      state: orNull(v.state),
      postalCode: orNull(v.postalCode),
      paymentTermsDays: v.paymentTermsDays,
      paymentTerms: orNull(v.paymentTerms),
      status: v.status,
      notes: orNull(v.notes),
    };
    try {
      const saved = supplier ? await api.put<Supplier>(`/suppliers/${supplier.id}`, body) : await api.post<Supplier>("/suppliers", body);
      void qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      toast(supplier ? "Supplier updated" : "Supplier created");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      applyApiErrors(err, setError, FIELDS);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? `Edit ${supplier.name}` : "New supplier"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit}>
            {supplier ? "Save changes" : "Create supplier"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <Field label="Code" htmlFor="sup-code" error={errors.code?.message} hint="e.g. SUP-ACME" required>
            <Input id="sup-code" className="uppercase" autoComplete="off" invalid={!!errors.code} {...register("code")} />
          </Field>
          <Field label="Display name" htmlFor="sup-name" error={errors.name?.message} required>
            <Input id="sup-name" invalid={!!errors.name} {...register("name")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal / company name" htmlFor="sup-company" error={errors.companyName?.message}>
            <Input id="sup-company" autoComplete="organization" {...register("companyName")} />
          </Field>
          <Field label="GSTIN" htmlFor="sup-gstin" error={errors.gstin?.message} hint="Needed to claim input tax credit">
            <Input id="sup-gstin" className="uppercase" maxLength={15} autoComplete="off" invalid={!!errors.gstin} {...register("gstin")} />
          </Field>
        </div>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Contact</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Contact person" htmlFor="sup-person" error={errors.contactPerson?.message}>
              <Input id="sup-person" autoComplete="name" {...register("contactPerson")} />
            </Field>
            <Field label="Phone" htmlFor="sup-phone" error={errors.phone?.message}>
              <Controller control={control} name="phone" render={({ field }) => <PhoneInput id="sup-phone" invalid={!!errors.phone} {...field} />} />
            </Field>
            <Field label="Email" htmlFor="sup-email" error={errors.email?.message}>
              <Input id="sup-email" type="email" invalid={!!errors.email} {...register("email")} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Address</legend>
          <Field label="Address line 1" htmlFor="sup-a1" error={errors.addressLine1?.message}>
            <Input id="sup-a1" autoComplete="address-line1" {...register("addressLine1")} />
          </Field>
          <Field label="Address line 2" htmlFor="sup-a2" error={errors.addressLine2?.message}>
            <Input id="sup-a2" autoComplete="address-line2" {...register("addressLine2")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" htmlFor="sup-city" error={errors.city?.message}>
              <Input id="sup-city" autoComplete="address-level2" {...register("city")} />
            </Field>
            <Field label="State" htmlFor="sup-state" error={errors.state?.message} hint="Decides CGST + SGST vs IGST on purchases">
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <Select id="sup-state" {...field}>
                    <option value="">{states.isLoading ? "Loading…" : "Select state…"}</option>
                    <StateOptions />
                  </Select>
                )}
              />
            </Field>
            <Field label="PIN code" htmlFor="sup-pin" error={errors.postalCode?.message}>
              <Input id="sup-pin" inputMode="numeric" maxLength={6} autoComplete="postal-code" invalid={!!errors.postalCode} {...register("postalCode")} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Terms</legend>
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label="Payment terms (days)" htmlFor="sup-days" error={errors.paymentTermsDays?.message} hint="e.g. 30 for Net 30">
              <Input
                id="sup-days"
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                step={1}
                invalid={!!errors.paymentTermsDays}
                {...register("paymentTermsDays", { setValueAs: (v: unknown) => (v === "" || v == null ? null : Number(v)) })}
              />
            </Field>
            <Field label="Payment terms" htmlFor="sup-terms" error={errors.paymentTerms?.message} hint="e.g. 50% advance, balance on delivery">
              <Input id="sup-terms" invalid={!!errors.paymentTerms} {...register("paymentTerms")} />
            </Field>
          </div>
          <Field label="Status" htmlFor="sup-status" error={errors.status?.message} hint="Inactive suppliers cannot receive new purchase orders">
            <Select id="sup-status" className="sm:w-56" {...register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
          <Field label="Internal notes" htmlFor="sup-notes" error={errors.notes?.message}>
            <Textarea id="sup-notes" rows={3} invalid={!!errors.notes} {...register("notes")} />
          </Field>
        </fieldset>
        <FormError message={errors.root?.message} />
      </form>
    </Modal>
  );
}
