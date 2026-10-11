"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Checkbox, Field, Input, Modal, Select } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { isPhoneNumber } from "@/lib/phone";
import { applyApiErrors, FormError, GSTIN_PATTERN, orNull, PIN_PATTERN, StateOptions, useIndianStates } from "./inventory-shared";
import type { IndianState, WarehouseBase, WarehouseLocation } from "./inventory-types";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { withinChars } from "@/lib/rich-text";

// ---------------------------------------------------------------------------
// Warehouse create / edit
// ---------------------------------------------------------------------------

/** GSTIN's first two digits are the GST state code; it must match the selected state. */
export function gstinStateIssue(gstin: string, state: string, states: IndianState[] | undefined) {
  const g = gstin.trim().toUpperCase();
  if (!g || !state || !states?.length || !GSTIN_PATTERN.test(g)) return null;
  const code = states.find((s) => s.name === state)?.code;
  return code && g.slice(0, 2) !== code ? `This GSTIN is registered in another state (code ${g.slice(0, 2)}; ${state} is ${code})` : null;
}

const optionalEmail = z.union([z.literal(""), z.email("Enter a valid email")]);
const optionalGstin = z.string().trim().refine((v) => v === "" || GSTIN_PATTERN.test(v.toUpperCase()), "Enter a valid 15-character GSTIN");

const warehouseSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{2,20}$/, "2–20 letters, numbers or hyphens"),
  name: z.string().trim().min(2, "At least 2 characters").max(100),
  addressLine1: z.string().trim().min(3, "Enter the street address").max(200),
  addressLine2: z.string().trim().max(200),
  city: z.string().trim().min(2, "Enter the city").max(100),
  state: z.string().min(1, "Select a state"),
  postalCode: z.string().trim().regex(PIN_PATTERN, "Enter a valid 6-digit PIN code"),
  contactName: z.string().trim().max(100),
  contactPhone: z.string().trim().refine((v) => !v || isPhoneNumber(v), "Enter a valid phone number"),
  contactEmail: optionalEmail,
  gstin: optionalGstin,
  status: z.enum(["ACTIVE", "INACTIVE"]),
  isOnlineFulfillment: z.boolean(),
  priority: z.number({ error: "Enter a number" }).int("Whole numbers only").min(0, "0 or more").max(10_000, "At most 10,000"),
});
type WarehouseValues = z.infer<typeof warehouseSchema>;
const WAREHOUSE_FIELDS = Object.keys(warehouseSchema.shape);

export function WarehouseFormModal({ warehouse, onClose, onSaved }: { warehouse: WarehouseBase | null; onClose: () => void; onSaved?: (w: WarehouseBase) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const states = useIndianStates();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WarehouseValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      code: warehouse?.code ?? "",
      name: warehouse?.name ?? "",
      addressLine1: warehouse?.addressLine1 ?? "",
      addressLine2: warehouse?.addressLine2 ?? "",
      city: warehouse?.city ?? "",
      state: warehouse?.state ?? "",
      postalCode: warehouse?.postalCode ?? "",
      contactName: warehouse?.contactName ?? "",
      contactPhone: warehouse?.contactPhone ?? "",
      contactEmail: warehouse?.contactEmail ?? "",
      gstin: warehouse?.gstin ?? "",
      status: warehouse?.status ?? "ACTIVE",
      isOnlineFulfillment: warehouse?.isOnlineFulfillment ?? true,
      priority: warehouse?.priority ?? 100,
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
      addressLine1: v.addressLine1.trim(),
      addressLine2: orNull(v.addressLine2),
      city: v.city.trim(),
      state: v.state,
      postalCode: v.postalCode.trim(),
      contactName: orNull(v.contactName),
      contactPhone: orNull(v.contactPhone),
      contactEmail: orNull(v.contactEmail),
      gstin: orNull(v.gstin)?.toUpperCase() ?? null,
      status: v.status,
      isOnlineFulfillment: v.isOnlineFulfillment,
      priority: v.priority,
    };
    try {
      const saved = warehouse ? await api.put<WarehouseBase>(`/warehouses/${warehouse.id}`, body) : await api.post<WarehouseBase>("/warehouses", body);
      void qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      void qc.invalidateQueries({ queryKey: ["admin", "warehouse", saved.id] });
      toast(warehouse ? "Warehouse updated" : "Warehouse created");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      applyApiErrors(err, setError, WAREHOUSE_FIELDS);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={warehouse ? `Edit ${warehouse.name}` : "New warehouse"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit}>
            {warehouse ? "Save changes" : "Create warehouse"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <Field label="Code" htmlFor="wh-code" error={errors.code?.message} hint="e.g. WH-BLR" required>
            <Input id="wh-code" className="uppercase" autoComplete="off" invalid={!!errors.code} {...register("code")} />
          </Field>
          <Field label="Name" htmlFor="wh-name" error={errors.name?.message} required>
            <Input id="wh-name" invalid={!!errors.name} {...register("name")} />
          </Field>
        </div>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Address</legend>
          <Field label="Address line 1" htmlFor="wh-a1" error={errors.addressLine1?.message} required>
            <Input id="wh-a1" autoComplete="address-line1" invalid={!!errors.addressLine1} {...register("addressLine1")} />
          </Field>
          <Field label="Address line 2" htmlFor="wh-a2" error={errors.addressLine2?.message}>
            <Input id="wh-a2" autoComplete="address-line2" {...register("addressLine2")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" htmlFor="wh-city" error={errors.city?.message} required>
              <Input id="wh-city" autoComplete="address-level2" invalid={!!errors.city} {...register("city")} />
            </Field>
            <Field label="State" htmlFor="wh-state" error={errors.state?.message ?? (states.error ? "Could not load states" : undefined)} required>
              {/* Controlled: the options load after the saved value is set. */}
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <Select id="wh-state" invalid={!!errors.state} {...field}>
                    <option value="">{states.isLoading ? "Loading…" : "Select state…"}</option>
                    <StateOptions />
                  </Select>
                )}
              />
            </Field>
            <Field label="PIN code" htmlFor="wh-pin" error={errors.postalCode?.message} required>
              <Input id="wh-pin" inputMode="numeric" maxLength={6} autoComplete="postal-code" invalid={!!errors.postalCode} {...register("postalCode")} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Contact & tax</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Contact name" htmlFor="wh-cname" error={errors.contactName?.message}>
              <Input id="wh-cname" {...register("contactName")} />
            </Field>
            <Field label="Phone" htmlFor="wh-cphone" error={errors.contactPhone?.message}>
              <Controller control={control} name="contactPhone" render={({ field }) => <PhoneInput id="wh-cphone" invalid={!!errors.contactPhone} {...field} />} />
            </Field>
            <Field label="Email" htmlFor="wh-cemail" error={errors.contactEmail?.message}>
              <Input id="wh-cemail" type="email" invalid={!!errors.contactEmail} {...register("contactEmail")} />
            </Field>
          </div>
          <Field label="GSTIN" htmlFor="wh-gstin" error={errors.gstin?.message} hint="Registration for this state, if any — used on invoices shipped from here">
            <Input id="wh-gstin" className="uppercase" maxLength={15} autoComplete="off" invalid={!!errors.gstin} {...register("gstin")} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Operations</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="wh-status" error={errors.status?.message}>
              <Select id="wh-status" {...register("status")}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </Field>
            <Field label="Allocation priority" htmlFor="wh-priority" error={errors.priority?.message} hint="Lower numbers are picked first for online orders">
              <Input id="wh-priority" type="number" inputMode="numeric" min={0} max={10000} step={1} invalid={!!errors.priority} {...register("priority", { valueAsNumber: true })} />
            </Field>
          </div>
          <Checkbox label="Fulfils online orders (stock here is sellable on the storefront)" {...register("isOnlineFulfillment")} />
        </fieldset>
        <FormError message={errors.root?.message} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bin / shelf locations
// ---------------------------------------------------------------------------

const locationSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{1,30}$/, "1–30 letters, numbers or hyphens (e.g. A-01-03)"),
  name: z.string().trim().max(100),
  description: z.string().refine(withinChars(300), "300 characters at most"),
  isActive: z.boolean(),
});
type LocationValues = z.infer<typeof locationSchema>;

export function LocationFormModal({ warehouseId, location, onClose }: { warehouseId: string; location: WarehouseLocation | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LocationValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { code: location?.code ?? "", name: location?.name ?? "", description: location?.description ?? "", isActive: location?.isActive ?? true },
  });

  const submit = handleSubmit(async (v) => {
    const body = { code: v.code.trim().toUpperCase(), name: orNull(v.name), description: orNull(v.description), isActive: v.isActive };
    try {
      if (location) await api.put(`/warehouses/${warehouseId}/locations/${location.id}`, body);
      else await api.post(`/warehouses/${warehouseId}/locations`, body);
      void qc.invalidateQueries({ queryKey: ["admin", "warehouse", warehouseId] });
      void qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      toast(location ? "Location updated" : "Location added");
      onClose();
    } catch (err) {
      applyApiErrors(err, setError, ["code", "name", "description", "isActive"]);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={location ? `Edit location ${location.code}` : "New location"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="loc-code" error={errors.code?.message} hint="Aisle-rack-bin, e.g. A-01-03" required>
            <Input id="loc-code" className="uppercase" autoComplete="off" invalid={!!errors.code} {...register("code")} />
          </Field>
          <Field label="Name" htmlFor="loc-name" error={errors.name?.message}>
            <Input id="loc-name" {...register("name")} />
          </Field>
        </div>
        <Field label="Description" htmlFor="loc-desc" error={errors.description?.message}>
          <Controller
            control={control}
            name="description"
            render={({ field }) => <RichTextEditor id="loc-desc" variant="compact" aria-label="Description" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.description} />}
          />
        </Field>
        <Checkbox label="Active (available for putaway and picking)" {...register("isActive")} />
        <FormError message={errors.root?.message} />
      </form>
    </Modal>
  );
}
