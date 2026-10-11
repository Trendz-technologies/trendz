"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { FlaskConical, Loader2, Lock } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { createPaymentSession, payWithMock, payWithRazorpay, type PaymentOutcome } from "@/lib/payment";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { PaymentSession, StoreConfig } from "@/lib/types";

/**
 * Starts payment for an existing order and reports the verified outcome.
 * Styling uses CSS only (no motion components): this button is also used by
 * the POS, which renders outside the storefront's animation provider.
 */
export function PayButton({ orderId, amount, onOutcome, label, size = "lg" }: { orderId: string; amount: number; onOutcome: (o: PaymentOutcome) => void; label?: string; size?: "md" | "lg" }) {
  const { data: config } = useQuery({ queryKey: ["store-config"], queryFn: () => api.get<StoreConfig>("/store/config"), staleTime: 300_000 });
  const { t, tr, tx } = useI18n();
  const [busy, setBusy] = useState(false);
  const [mockSession, setMockSession] = useState<PaymentSession | null>(null);

  // Failure messages written in lib/payment are translated here; ones from the API or Razorpay pass through as they are.
  const report = (o: PaymentOutcome) => onOutcome(o.status === "failed" ? { ...o, message: tx(o.message) } : o);

  const start = async () => {
    setBusy(true);
    try {
      const session = await createPaymentSession(orderId);
      if (session.provider === "mock") {
        setMockSession(session);
        return;
      }
      report(await payWithRazorpay(session, config?.appearance?.brandColor));
    } catch (err) {
      report({ status: "failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const simulate = async (outcome: "success" | "failure") => {
    if (!mockSession) return;
    setBusy(true);
    try {
      report(await payWithMock(mockSession, outcome));
    } catch (err) {
      report({ status: "failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
      setMockSession(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        aria-busy={busy || undefined}
        className={clsx(
          "group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-full bg-ink pl-6 pr-1.5 text-sm font-semibold text-white shadow-neu-lg transition-[background-color,box-shadow] duration-300 hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:bg-ink/60 disabled:shadow-none",
          size === "lg" ? "h-14" : "h-12",
        )}
      >
        {/* A soft sheen sweeps across while the payment window is opening. */}
        {busy && <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.14)_50%,transparent_70%)] bg-[length:250%_100%]" />}
        <span className="relative truncate">
          {label ?? t("Pay now")} · {money(amount)}
        </span>
        <span className={clsx("relative grid shrink-0 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-enabled:group-hover:-rotate-12", size === "lg" ? "h-11 w-11" : "h-9 w-9")}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
        </span>
      </button>
      {config?.payments.provider === "mock" && (
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-warning">
          <FlaskConical size={13} /> {t("Test mode: no real money is charged.")}
        </p>
      )}
      <Modal open={!!mockSession} onClose={() => setMockSession(null)} title={t("Test payment (development)")}>
        <div className="space-y-5 text-sm">
          <div className="flex items-start gap-3 rounded-2xl bg-warning/10 p-4 text-warning">
            <FlaskConical size={18} className="mt-0.5 shrink-0" />
            <p>
              {t("Razorpay keys are not configured, so this local test gateway stands in for the Razorpay popup. The server still verifies the payment signature and processes the webhook exactly as in production.")}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-offwhite px-4 py-3.5">
            <span className="text-ink/60">{tr("Order {number}", { number: <strong className="text-ink">{mockSession?.orderNumber}</strong> })}</span>
            <span className="text-lg font-bold tabular-nums">{money(mockSession?.amount ?? 0)}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="h-12 flex-1" loading={busy} onClick={() => simulate("success")}>
              {t("Simulate successful payment")}
            </Button>
            <Button className="h-12 flex-1" variant="outline" disabled={busy} onClick={() => simulate("failure")}>
              {t("Simulate failure")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
