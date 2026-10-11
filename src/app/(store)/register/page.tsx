"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthFallback, AuthShell, AuthSubmit, FormAlert } from "@/components/store/auth-shell";
import { Field, Input, PasswordInput } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { msg } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

const schema = z
  .object({
    firstName: z.string().trim().min(1, msg("Enter your first name")),
    lastName: z.string().trim().optional(),
    email: z.email(msg("Enter a valid email")),
    phone: z.string().trim().regex(/^$|^(\+?91[\s-]?)?[6-9]\d{9}$/, msg("Enter a valid mobile number")).optional(),
    password: z.string().min(8, msg("At least 8 characters")).regex(/[A-Za-z]/, msg("Include a letter")).regex(/\d/, msg("Include a number")),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: msg("Passwords do not match") });

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Register />
    </Suspense>
  );
}

function Register() {
  const { t, tr, tx } = useI18n();
  const { register: signUp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (v) => {
    try {
      await signUp({ firstName: v.firstName, lastName: v.lastName || undefined, email: v.email, phone: v.phone || undefined, password: v.password });
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) for (const e of err.errors) setError(e.path as "email", { message: e.message });
      else setError("root", { message: errorMessage(err) });
    }
  });

  return (
    <AuthShell
      eyebrow={t("Join Trendz")}
      title={t("Create your account")}
      subtitle={t("It takes less than a minute — then checkout, tracking and returns are a tap away.")}
      tagline={t("Join the crew.")}
      footer={tr("Already have an account? {link}", {
        link: (
          <Link href="/login" className="link">
            {t("Sign in")}
          </Link>
        ),
      })}
    >
      <form onSubmit={submit} className="grid gap-x-4 gap-y-5 sm:grid-cols-2" noValidate>
        <Field label={t("First name")} error={tx(errors.firstName?.message)} htmlFor="firstName" required>
          <Input id="firstName" autoComplete="given-name" className="h-12" invalid={!!errors.firstName} {...register("firstName")} />
        </Field>
        <Field label={t("Last name")} htmlFor="lastName">
          <Input id="lastName" autoComplete="family-name" className="h-12" {...register("lastName")} />
        </Field>
        <Field label={t("Email")} error={tx(errors.email?.message)} htmlFor="email" className="sm:col-span-2" required>
          <Input id="email" type="email" autoComplete="email" className="h-12" invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label={t("Mobile number")} error={tx(errors.phone?.message)} htmlFor="phone" className="sm:col-span-2" hint={t("Optional — for delivery updates by SMS")}>
          <Controller control={control} name="phone" render={({ field }) => <PhoneInput id="phone" className="h-12" invalid={!!errors.phone} {...field} />} />
        </Field>
        <Field label={t("Password")} error={tx(errors.password?.message)} htmlFor="password" required>
          <PasswordInput id="password" autoComplete="new-password" className="h-12" invalid={!!errors.password} {...register("password")} />
        </Field>
        <Field label={t("Confirm password")} error={tx(errors.confirm?.message)} htmlFor="confirm" required>
          <PasswordInput id="confirm" autoComplete="new-password" className="h-12" invalid={!!errors.confirm} {...register("confirm")} />
        </Field>
        <FormAlert message={errors.root?.message} className="sm:col-span-2" />
        <AuthSubmit loading={isSubmitting} className="sm:col-span-2">
          {t("Create account")}
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
