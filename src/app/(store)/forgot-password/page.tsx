"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthMedallion, AuthShell, AuthSubmit, FormAlert } from "@/components/store/auth-shell";
import { EASE_OUT } from "@/components/store/motion";
import { Field, Input } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n/client";

export default function ForgotPasswordPage() {
  const { t, tx } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ message: string }>("/auth/password/forgot", { email });
      setSent(res.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow={t("Account recovery")}
      title={t("Reset your password")}
      subtitle={sent ? undefined : t("Enter the email on your account and we will send you a link to choose a new password.")}
      tagline={t("Locked out? It happens.")}
      footer={
        <Link href="/login" className="group inline-flex items-center gap-2 font-medium text-ink/55 hover:text-ink">
          <ArrowLeft size={14} className="transition-transform duration-300 group-hover:-translate-x-1" /> {t("Back to sign in")}
        </Link>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <m.div key="sent" role="status" className="flex flex-col items-start gap-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
            <AuthMedallion tone="success">
              <MailCheck size={30} strokeWidth={1.6} />
            </AuthMedallion>
            <p className="text-sm leading-relaxed text-ink/70">{tx(sent)} {t("The link is valid for one hour.")}</p>
          </m.div>
        ) : (
          <m.form key="form" onSubmit={submit} className="space-y-5" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
            <Field label={t("Email")} htmlFor="email">
              <Input id="email" type="email" autoComplete="email" className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <FormAlert message={error} />
            <AuthSubmit loading={busy}>{t("Send reset link")}</AuthSubmit>
          </m.form>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
