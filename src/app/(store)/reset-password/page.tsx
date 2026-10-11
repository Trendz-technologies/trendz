"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { CircleAlert } from "lucide-react";
import { AuthFallback, AuthMedallion, AuthShell, AuthSubmit, FormAlert } from "@/components/store/auth-shell";
import { CtaLink, DrawnCheck } from "@/components/store/checkout-ui";
import { EASE_OUT } from "@/components/store/motion";
import { Field, PasswordInput } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n/client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Reset />
    </Suspense>
  );
}

function Reset() {
  const { t } = useI18n();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError(t("Passwords do not match"));
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/password/reset", { token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell eyebrow={t("Account recovery")} title={t("Choose a new password")} tagline={t("Fresh start, same fit.")}>
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <m.div key="done" role="status" className="flex flex-col items-start gap-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
            <span className="grid h-20 w-20 place-items-center rounded-full bg-success/10 text-success">
              <DrawnCheck className="h-14 w-14" />
            </span>
            <p className="text-sm leading-relaxed text-ink/70">{t("Your password has been changed and all other sessions were signed out.")}</p>
            <CtaLink href="/login">{t("Sign in")}</CtaLink>
          </m.div>
        ) : !token ? (
          <m.div key="no-token" className="flex flex-col items-start gap-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
            <AuthMedallion tone="danger">
              <CircleAlert size={30} strokeWidth={1.6} />
            </AuthMedallion>
            <p className="text-sm text-danger">{t("This reset link is incomplete. Request a new one.")}</p>
            <Link href="/forgot-password" className="link text-sm">
              {t("Request a new link")}
            </Link>
          </m.div>
        ) : (
          <m.form key="form" onSubmit={submit} className="space-y-5" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
            <Field label={t("New password")} htmlFor="password" hint={t("At least 8 characters with letters and numbers")}>
              <PasswordInput id="password" autoComplete="new-password" className="h-12" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </Field>
            <Field label={t("Confirm password")} htmlFor="confirm">
              <PasswordInput id="confirm" autoComplete="new-password" className="h-12" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
            <FormAlert message={error} />
            <AuthSubmit loading={busy}>{t("Update password")}</AuthSubmit>
          </m.form>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
