"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Loader2, MailWarning, MapPin, Package, RotateCcw } from "lucide-react";
import { AccountHeader, EmptyPanel, OrderRow, Panel, RowArrow, RowsSkeleton, StaggerList, StaggerRow } from "@/components/store/account-ui";
import { CtaLink, delay } from "@/components/store/checkout-ui";
import { api, errorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { date } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { OrderListItem } from "@/lib/types";

export default function AccountOverview() {
  const { user } = useAuth();
  const { t, tn, locale } = useI18n();
  const orders = useQuery({ queryKey: ["my-orders", 1], queryFn: () => api.page<OrderListItem[]>("/account/orders", { page: 1, limit: 5 }) });
  const total = orders.data?.meta.total;
  const firstName = user?.name?.split(" ")[0];
  const tiles = [
    { href: "/account/orders", label: t("Orders"), icon: Package, meta: total != null ? tn(total, "{n} order", "{n} orders") : t("Your history") },
    { href: "/account/returns", label: t("Returns"), icon: RotateCcw, meta: t("Refund status") },
    { href: "/account/wishlist", label: t("Wishlist"), icon: Heart, meta: t("Saved for later") },
    { href: "/account/addresses", label: t("Addresses"), icon: MapPin, meta: t("Faster checkout") },
  ];

  return (
    <div className="space-y-8">
      <AccountHeader
        eyebrow={t("Your account")}
        title={firstName == null ? t("Hi there 👋") : t("Hi {name} 👋", { name: firstName })}
        description={t("Track orders, manage returns and keep your details up to date.")}
      />
      {!user?.emailVerified && user?.email && <VerifyBanner />}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {tiles.map(({ href, label, icon: Icon, meta }, i) => (
          <li key={href} className="animate-rise" style={delay(150 + i * 70)}>
            <Link
              href={href}
              className="group flex h-full flex-col justify-between gap-6 rounded-3xl bg-white p-5 shadow-neu transition duration-500 hover:-translate-y-1 hover:shadow-neu-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-offwhite transition-colors duration-500 group-hover:bg-ink group-hover:text-white">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <RowArrow className="h-8 w-8 border-transparent" />
              </div>
              <div>
                <p className="font-semibold">{label}</p>
                <p className="text-xs text-ink/50">{meta}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Panel
        title={t("Recent orders")}
        actions={
          <Link href="/account/orders" className="link-draw text-xs font-semibold">
            {t("View all")}
          </Link>
        }
        padded={false}
        delay={0.15}
      >
        {orders.isLoading ? (
          <RowsSkeleton label={t("Loading your orders")} />
        ) : !orders.data?.data.length ? (
          <EmptyPanel
            bare
            icon={<Package size={28} strokeWidth={1.5} />}
            title={t("No orders yet")}
            body={t("When you place an order it will appear here.")}
            action={<CtaLink href="/products">{t("Start shopping")}</CtaLink>}
          />
        ) : (
          <StaggerList className="divide-y divide-black/5 pb-2">
            {orders.data.data.map((o) => (
              <StaggerRow key={o.id}>
                <OrderRow
                  order={o}
                  meta={
                    <>
                      {date(o.placedAt, locale)} · {tn(o._count.items, "{n} item", "{n} items")}
                    </>
                  }
                />
              </StaggerRow>
            ))}
          </StaggerList>
        )}
      </Panel>
    </div>
  );
}

function VerifyBanner() {
  const toast = useToast();
  const { t } = useI18n();
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try {
      await api.post("/auth/verify-email/request");
      toast(t("Verification email sent. Check your inbox."));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="flex animate-rise flex-wrap items-center justify-between gap-4 rounded-3xl border border-warning/20 bg-warning/10 px-5 py-4 text-sm text-warning sm:px-6" style={delay(100)}>
      <span className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/15">
          <MailWarning size={17} />
        </span>
        {t("Please verify your email address to receive order updates.")}
      </span>
      <button
        type="button"
        onClick={send}
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-full bg-warning px-4 py-2 text-xs font-semibold text-white transition hover:bg-warning/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-warning/25 disabled:opacity-60"
      >
        {sending && <Loader2 size={13} className="animate-spin" />}
        {t("Resend verification email")}
      </button>
    </div>
  );
}
