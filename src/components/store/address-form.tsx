"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { CircleAlert, Loader2 } from "lucide-react";
import { Field, Input, Select } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import { api, ApiError } from "@/lib/api";
import { msg } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { Address, StoreConfig } from "@/lib/types";
import { EASE_OUT } from "./motion";

const schema = z.object({
  fullName: z.string().trim().min(2, msg("Enter the recipient's name")),
  phone: z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{9}$/, msg("Enter a valid 10-digit mobile number")),
  line1: z.string().trim().min(3, msg("Enter the house / street")),
  line2: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  city: z.string().trim().min(2, msg("Enter the city")),
  state: z.string().min(2, msg("Select a state")),
  postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, msg("Enter a 6-digit PIN code")),
  isDefaultShipping: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const { data: config } = useQuery({ queryKey: ["store-config"], queryFn: () => api.get<StoreConfig>("/store/config"), staleTime: 300_000 });
  const { t, tx } = useI18n();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: initial?.fullName ?? "",
      phone: initial?.phone ?? "",
      line1: initial?.line1 ?? "",
      line2: initial?.line2 ?? "",
      landmark: initial?.landmark ?? "",
      city: initial?.city ?? "",
      state: initial?.state ?? "",
      postalCode: initial?.postalCode ?? "",
      isDefaultShipping: initial?.isDefaultShipping ?? false,
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      const body = { ...values, line2: values.line2 || null, landmark: values.landmark || null };
      const saved = initial ? await api.patch<Address>(`/account/addresses/${initial.id}`, body) : await api.post<Address>("/account/addresses", body);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) {
        for (const e of err.errors) setError(e.path as keyof Values, { message: e.message });
      } else setError("root", { message: err instanceof Error ? err.message : t("Could not save the address") });
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-x-4 gap-y-5 sm:grid-cols-2" noValidate>
      <p className="eyebrow sm:col-span-2">{t("Contact")}</p>
      <Field label={t("Full name")} error={tx(errors.fullName?.message)} htmlFor="fullName" required>
        <Input id="fullName" autoComplete="name" invalid={!!errors.fullName} {...register("fullName")} />
      </Field>
      <Field label={t("Mobile number")} error={tx(errors.phone?.message)} htmlFor="phone" required>
        <Controller control={control} name="phone" render={({ field }) => <PhoneInput id="phone" invalid={!!errors.phone} {...field} />} />
      </Field>

      <p className="eyebrow mt-2 sm:col-span-2">{t("Address")}</p>
      <Field label={t("House / flat, street")} error={tx(errors.line1?.message)} htmlFor="line1" className="sm:col-span-2" required>
        <Input id="line1" autoComplete="address-line1" invalid={!!errors.line1} {...register("line1")} />
      </Field>
      <Field label={t("Area / locality")} htmlFor="line2">
        <Input id="line2" autoComplete="address-line2" {...register("line2")} />
      </Field>
      <Field label={t("Landmark")} htmlFor="landmark">
        <Input id="landmark" {...register("landmark")} />
      </Field>
      <Field label={t("City")} error={tx(errors.city?.message)} htmlFor="city" required>
        <Input id="city" autoComplete="address-level2" invalid={!!errors.city} {...register("city")} />
      </Field>
      <Field label={t("PIN code")} error={tx(errors.postalCode?.message)} htmlFor="postalCode" required>
        <Input id="postalCode" autoComplete="postal-code" inputMode="numeric" maxLength={6} invalid={!!errors.postalCode} {...register("postalCode")} />
      </Field>
      <Field label={t("State")} error={tx(errors.state?.message)} htmlFor="state" className="sm:col-span-2" required>
        <Select id="state" invalid={!!errors.state} {...register("state")}>
          <option value="">{t("Select state")}</option>
          {config?.states.map((s) => (
            <option key={s.code} value={s.name}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-offwhite px-4 py-3.5 text-sm transition-colors hover:bg-mist has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 sm:col-span-2">
        <span>
          <span className="block font-semibold">{t("Use as my default delivery address")}</span>
          <span className="block text-xs text-ink/50">{t("We'll pre-select it at checkout.")}</span>
        </span>
        <input type="checkbox" className="peer sr-only" {...register("isDefaultShipping")} />
        <span
          aria-hidden="true"
          className="relative h-6 w-11 shrink-0 rounded-full bg-black/15 transition-colors duration-300 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)] peer-checked:bg-ink peer-checked:after:translate-x-5"
        />
      </label>

      <AnimatePresence initial={false}>
        {errors.root && (
          <m.p
            key="root"
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger sm:col-span-2"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            <CircleAlert size={16} className="mt-0.5 shrink-0" /> {errors.root.message}
          </m.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2 pt-1 sm:col-span-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-7 text-sm font-semibold text-white transition hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:bg-ink/40"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {t("Save address")}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold text-ink/60 transition hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
          >
            {t("Cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
