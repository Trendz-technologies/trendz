"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Loader2, MailX } from "lucide-react";
import { AuthFallback, AuthMedallion, AuthShell } from "@/components/store/auth-shell";
import { CtaLink, DrawnCheck } from "@/components/store/checkout-ui";
import { EASE_OUT } from "@/components/store/motion";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { msg } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Verify />
    </Suspense>
  );
}

const TITLES = { working: msg("Verifying your email"), done: msg("Email verified"), error: msg("Could not verify") } as const;

function Verify() {
  const { t } = useI18n();
  const token = useSearchParams().get("token");
  const { reload } = useAuth();
  const [result, setState] = useState<"working" | "done" | "error">("working");
  const [error, setMessage] = useState("");
  // A link without a token is an error straight away; no request is made.
  const state = token ? result : "error";
  const message = token ? error : t("This verification link is incomplete.");
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    api
      .post("/auth/verify-email/confirm", { token })
      .then(() => {
        setState("done");
        void reload();
      })
      .catch((err) => {
        setState("error");
        setMessage(errorMessage(err));
      });
  }, [token, reload]);

  return (
    <AuthShell eyebrow={t("Email verification")} title={t(TITLES[state])} tagline={t("Almost there.")}>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={state}
          role="status"
          className="flex flex-col items-start gap-5"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          {state === "working" && (
            <>
              <AuthMedallion>
                <Loader2 size={28} className="animate-spin" />
              </AuthMedallion>
              <p className="text-sm text-ink/60">{t("Verifying your email")}…</p>
            </>
          )}
          {state === "done" && (
            <>
              <span className="grid h-20 w-20 place-items-center rounded-full bg-success/10 text-success">
                <DrawnCheck className="h-14 w-14" />
              </span>
              <p className="text-sm text-ink/60">{t("Thanks — your email address is confirmed.")}</p>
              <CtaLink href="/account">{t("Go to my account")}</CtaLink>
            </>
          )}
          {state === "error" && (
            <>
              <AuthMedallion tone="danger">
                <MailX size={30} strokeWidth={1.6} />
              </AuthMedallion>
              <p className="text-sm text-ink/60">{message}</p>
              <Link href="/account" className="link text-sm">
                {t("Request a new link from your account")}
              </Link>
            </>
          )}
        </m.div>
      </AnimatePresence>
    </AuthShell>
  );
}
