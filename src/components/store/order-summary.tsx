"use client";

import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { Sparkles } from "lucide-react";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { QuoteTotals } from "@/lib/types";
import { FreeShippingMeter, RollingNumber } from "./checkout-ui";
import { EASE_OUT } from "./motion";

/** Server-calculated totals. The browser never computes money. */
export function OrderSummary({ totals, shippingLabel, shippingHint = true }: { totals: QuoteTotals; shippingLabel?: string; shippingHint?: boolean }) {
  const { t, tn } = useI18n();
  const rows: { key: string; label: string; value: string; show: boolean; success?: boolean }[] = [
    { key: "subtotal", label: tn(totals.itemCount, "Subtotal ({n} item)", "Subtotal ({n} items)"), value: money(totals.subtotal), show: true },
    { key: "offers", label: t("Offers"), value: `− ${money(totals.autoDiscountTotal)}`, show: totals.autoDiscountTotal > 0, success: true },
    { key: "coupon", label: t("Coupon {code}", { code: totals.coupon?.code ?? "" }), value: `− ${money(totals.couponDiscountTotal)}`, show: totals.couponDiscountTotal > 0, success: true },
    { key: "shipping", label: shippingLabel ?? t("Shipping"), value: totals.shipping.total === 0 ? t("Free") : money(totals.shipping.total), show: true },
    { key: "gst", label: t("GST"), value: money(totals.taxTotal), show: !totals.pricesIncludeTax },
    { key: "round", label: t("Round off"), value: money(totals.roundOff), show: totals.roundOff !== 0 },
  ];
  const threshold = totals.shipping.freeShippingThreshold;

  return (
    <section aria-label={t("Order summary")} className="rounded-3xl bg-white p-6 shadow-neu sm:p-7">
      <p className="eyebrow">{t("Order summary")}</p>
      <dl className="mt-4">
        <AnimatePresence initial={false}>
          {rows
            .filter((r) => r.show)
            .map((r) => (
              <m.div
                key={r.key}
                className={clsx("flex justify-between gap-4 overflow-hidden text-sm", r.success && "text-success")}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              >
                <dt className={clsx("py-1.5", !r.success && "text-ink/60")}>{r.label}</dt>
                <dd className="py-1.5 tabular-nums">{r.value}</dd>
              </m.div>
            ))}
        </AnimatePresence>
      </dl>

      <div className="mt-4 flex items-end justify-between gap-4 border-t border-dashed border-black/10 pt-5">
        <span className="text-sm font-semibold">{t("Total")}</span>
        <RollingNumber value={totals.grandTotal} format={money} className="text-2xl font-bold tracking-tight" />
      </div>
      {totals.pricesIncludeTax && totals.taxTotal > 0 && <p className="mt-1 text-right text-xs text-ink/45">{t("Includes {amount} GST", { amount: money(totals.taxTotal) })}</p>}

      {shippingHint && totals.shipping.amountToFreeShipping > 0 && threshold != null && (
        <FreeShippingMeter threshold={threshold} left={totals.shipping.amountToFreeShipping} className="mt-5 rounded-2xl bg-offwhite p-4" />
      )}

      <AnimatePresence initial={false}>
        {totals.savings > 0 && (
          <m.p
            key="savings"
            className="mt-5 flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-xs font-semibold text-success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            <Sparkles size={14} className="shrink-0" /> {t("You save {amount} on this order", { amount: money(totals.savings) })}
          </m.p>
        )}
      </AnimatePresence>
    </section>
  );
}
