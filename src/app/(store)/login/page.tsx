"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthFallback, AuthShell, AuthSubmit, FormAlert } from "@/components/store/auth-shell";
import { Field, Input, PasswordInput } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { msg } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

/** Only same-site relative paths are allowed as post-login redirects (no open redirect). */
function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Login />
    </Suspense>
  );
}

const schema = z.object({ identifier: z.string().trim().min(3, msg("Enter your email or mobile number")), password: z.string().min(1, msg("Enter your password")) });

/** Sign in with an email or mobile number and a password (the only way to sign in). */
function Login() {
  const { t, tr, tx } = useI18n();
  const { status, user, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(safeNext(params.get("next"), user.isStaff ? "/admin" : "/account"));
  }, [status, user, router, params]);

  const submit = handleSubmit(async (v) => {
    try {
      await login(v.identifier, v.password);
    } catch (err) {
      setError("root", { message: errorMessage(err) });
    }
  });

  return (
    <AuthShell
      eyebrow={t("Sign in")}
      title={t("Welcome back")}
      subtitle={t("Sign in to track orders, save addresses and check out faster.")}
      tagline={t("Good to see you again.")}
      footer={tr("New here? {link}", {
        link: (
          <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="link">
            {t("Create an account")}
          </Link>
        ),
      })}
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label={t("Email or mobile number")} error={tx(errors.identifier?.message)} htmlFor="identifier">
          <Input id="identifier" autoComplete="username" className="h-12" invalid={!!errors.identifier} {...register("identifier")} />
        </Field>
        <Field label={t("Password")} error={tx(errors.password?.message)} htmlFor="password">
          <PasswordInput id="password" autoComplete="current-password" className="h-12" invalid={!!errors.password} {...register("password")} />
        </Field>
        <FormAlert message={errors.root?.message} />
        <AuthSubmit loading={isSubmitting}>{t("Sign in")}</AuthSubmit>
        <p className="text-center">
          <Link href="/forgot-password" className="link-draw text-sm text-ink/55 hover:text-ink">
            {t("Forgot password?")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
