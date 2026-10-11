"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { ArrowUpRight, Loader2, PackageX } from "lucide-react";
import { AccountHeader, DetailSkeleton, EmptyPanel, Panel, StaggerList, StaggerRow, Thumb } from "@/components/store/account-ui";
import { CtaLink, delay, RollingNumber } from "@/components/store/checkout-ui";
import { Field, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import { msg } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { Order } from "@/lib/types";

// Sent to the API as written here (English); only the label shown to the shopper is translated.
const REASONS = [msg("Size too small"), msg("Size too large"), msg("Damaged or defective"), msg("Not as described"), msg("Wrong item received"), msg("Changed my mind")];

export default function NewReturnPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <NewReturn />
    </Suspense>
  );
}

function NewReturn() {
  const orderNumber = useSearchParams().get("order") ?? "";
  const router = useRouter();
  const toast = useToast();
  const { t, tr } = useI18n();
  const q = useQuery({ queryKey: ["order", orderNumber], queryFn: () => api.get<Order>(`/account/orders/${orderNumber}`), enabled: !!orderNumber });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState(REASONS[0]!);
  const [notes, setNotes] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ returnNumber: string }>("/account/returns", {
        orderNumber,
        reason,
        notes: notes || undefined,
        items: Object.entries(qty)
          .filter(([, n]) => n > 0)
          .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      }),
    onSuccess: (r) => {
      toast(t("Return {number} requested", { number: r.returnNumber }));
      router.replace(`/account/returns/${r.returnNumber}`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  if (q.isLoading || !q.data) return <DetailSkeleton label={t("Loading your order")} />;
  const o = q.data;
  if (!o.canReturn) {
    return (
      <EmptyPanel
        icon={<PackageX size={28} strokeWidth={1.5} />}
        title={t("This order is not eligible for return.")}
        body={t("Returns open once an order is delivered and stay open for the return window.")}
        action={
          <CtaLink href={`/account/orders/${o.orderNumber}`} tone="light">
            {t("Back to the order")}
          </CtaLink>
        }
      />
    );
  }

  // Units already in another return request cannot be requested again.
  const inReturn = (itemId: string) => o.returnRequests.filter((r) => !["REJECTED", "CANCELLED"].includes(r.status)).flatMap((r) => r.items).filter((i) => i.orderItemId === itemId).reduce((s, i) => s + i.quantity, 0);
  const selected = Object.values(qty).reduce((s, n) => s + n, 0);
  const selectedCount = <RollingNumber value={selected} />;

  return (
    <div className="space-y-6">
      <AccountHeader eyebrow={t("New return")} title={t("Return items from {number}", { number: o.orderNumber })} long back={{ href: `/account/orders/${o.orderNumber}`, label: t("Back to order") }} />

      <Panel eyebrow={t("Step {n}", { n: 1 })} title={t("Choose items")} padded={false}>
        <StaggerList className="divide-y divide-black/5">
          {o.items.map((i) => {
            const max = i.quantity - inReturn(i.id);
            const picked = (qty[i.id] ?? 0) > 0;
            return (
              <StaggerRow key={i.id} className={clsx("transition-colors duration-300", picked && "bg-offwhite/70")}>
                <div className={clsx("flex items-center gap-4 px-5 py-4 sm:px-7", max <= 0 && "opacity-50")}>
                <Thumb src={i.imageUrl} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{i.productName}</p>
                  <p className="text-ink/55">
                    {i.variantTitle} · {t("paid {amount} each", { amount: money(Math.round(i.lineTotal / i.quantity)) })}
                  </p>
                  {max <= 0 && <p className="mt-0.5 text-xs text-ink/50">{t("Already in a return request")}</p>}
                </div>
                <Select aria-label={t("Quantity to return for {name}", { name: i.productName })} className="w-22 rounded-full" value={qty[i.id] ?? 0} disabled={max <= 0} onChange={(e) => setQty((s) => ({ ...s, [i.id]: Number(e.target.value) }))}>
                  {Array.from({ length: Math.max(0, max) + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
                </div>
              </StaggerRow>
            );
          })}
        </StaggerList>
      </Panel>

      <Panel eyebrow={t("Step {n}", { n: 2 })} title={t("Why are you returning?")} delay={0.08}>
        <fieldset>
          <legend className="label">{t("Reason")}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {REASONS.map((r) => {
              const active = reason === r;
              return (
                <label
                  key={r}
                  className={clsx(
                    "relative isolate cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-300 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10",
                    active ? "border-accent text-on-accent" : "border-black/10 text-ink/70 hover:border-accent/50 hover:text-ink",
                  )}
                >
                  <input type="radio" name="reason" value={r} checked={active} onChange={() => setReason(r)} className="sr-only" />
                  {active && <m.span layoutId="return-reason-pill" aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-accent" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  {t(r)}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field label={t("Anything else? (optional)")} htmlFor="notes" className="mt-6">
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="rounded-2xl" />
        </Field>
      </Panel>

      <div className="flex animate-rise flex-wrap items-center gap-4" style={delay(250)}>
        <button
          type="button"
          disabled={!selected || submit.isPending}
          aria-busy={submit.isPending || undefined}
          onClick={() => submit.mutate()}
          className="group flex h-14 items-center gap-5 rounded-full bg-ink py-1.5 pl-7 pr-2 text-sm font-semibold text-white shadow-neu-lg transition-[background-color,box-shadow] duration-300 hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:bg-ink/35 disabled:shadow-none"
        >
          <span>{selected === 1 ? tr("Request return ({n} item)", { n: selectedCount }) : tr("Request return ({n} items)", { n: selectedCount })}</span>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-enabled:group-hover:rotate-45">
            {submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={17} />}
          </span>
        </button>
        <AnimatePresence initial={false}>
          {!selected && (
            <m.p key="hint" className="text-xs text-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {t("Pick at least one item to continue.")}
            </m.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
