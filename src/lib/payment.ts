"use client";

import { api, newIdempotencyKey } from "./api";
import { msg } from "./i18n";
import type { PaymentSession } from "./types";

/**
 * Pays for an order. With Razorpay the official Checkout popup is used; with
 * the local mock gateway a simulation dialog stands in for it. Either way the
 * result is verified by the API (signature + gateway lookup) — the browser's
 * word is never taken for it.
 */
export type PaymentOutcome = { status: "paid"; orderNumber: string } | { status: "failed"; message: string } | { status: "dismissed" };

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (r: { error: { description: string } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(msg("Could not load the payment window. Check your connection and try again.")));
    document.body.appendChild(s);
  });
}

export async function createPaymentSession(orderId: string) {
  return api.post<PaymentSession>("/payments/create", { orderId }, { idempotencyKey: newIdempotencyKey() });
}

export async function verifyPayment(r: RazorpayResponse) {
  return api.post<{ orderNumber: string; status: string; paymentStatus: string }>("/payments/verify", r);
}

export async function payWithRazorpay(session: PaymentSession, theme = "#111111"): Promise<PaymentOutcome> {
  await loadRazorpay();
  return new Promise((resolve) => {
    let settled = false;
    const rzp = new window.Razorpay!({
      key: session.keyId,
      amount: session.amount,
      currency: session.currency,
      name: session.storeName,
      description: `Order ${session.orderNumber}`,
      order_id: session.razorpayOrderId,
      prefill: session.prefill,
      theme: { color: theme },
      handler: async (resp: RazorpayResponse) => {
        settled = true;
        try {
          const order = await verifyPayment(resp);
          resolve({ status: "paid", orderNumber: order.orderNumber });
        } catch (err) {
          resolve({ status: "failed", message: err instanceof Error ? err.message : msg("Payment could not be verified") });
        }
      },
      modal: { ondismiss: () => !settled && resolve({ status: "dismissed" }) },
    });
    rzp.on("payment.failed", (r) => {
      settled = true;
      resolve({ status: "failed", message: r.error.description || msg("Payment failed") });
    });
    rzp.open();
  });
}

/** Mock gateway (development only): completes the payment server-side. */
export async function payWithMock(session: PaymentSession, outcome: "success" | "failure"): Promise<PaymentOutcome> {
  const res = await api.post<{ checkoutResponse: RazorpayResponse | null; error: { description: string } | null }>("/payments/mock/complete", {
    razorpayOrderId: session.razorpayOrderId,
    outcome,
  });
  if (!res.checkoutResponse) return { status: "failed", message: res.error?.description ?? msg("Payment failed") };
  const order = await verifyPayment(res.checkoutResponse);
  return { status: "paid", orderNumber: order.orderNumber };
}
