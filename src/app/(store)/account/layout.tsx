"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { m } from "motion/react";
import { clsx } from "clsx";
import { Star, Bell, Heart, LayoutDashboard, LogOut, MapPin, Package, RotateCcw, Shield, UserCog } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth";
import { msg } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

const NAV = [
  { href: "/account", label: msg("Overview"), icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: msg("Orders"), icon: Package },
  { href: "/account/returns", label: msg("Returns & refunds"), icon: RotateCcw },
  { href: "/account/reviews", label: msg("Reviews"), icon: Star },
  { href: "/account/wishlist", label: msg("Wishlist"), icon: Heart },
  { href: "/account/addresses", label: msg("Addresses"), icon: MapPin },
  { href: "/account/notifications", label: msg("Notifications"), icon: Bell },
  { href: "/account/profile", label: msg("Profile & security"), icon: UserCog },
];

const itemClass =
  "relative isolate flex shrink-0 items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 lg:rounded-2xl";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const name = user?.name ?? user?.email ?? user?.phone;
  const initial = (name ?? "T").trim().charAt(0).toUpperCase();

  // On the horizontally scrolling (mobile) nav, keep the active tab in view.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
  }, [pathname, user]);

  return (
    <RequireAuth>
      <div className="container-x py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <div className="flex animate-rise items-center gap-3">
              <span aria-hidden="true" className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-lg font-bold text-white">
                {initial}
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-offwhite bg-success" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-ink/50">{t("Signed in as")}</p>
                <p className="truncate font-semibold">{name}</p>
              </div>
            </div>

            <nav
              ref={navRef}
              aria-label={t("Account")}
              className="no-scrollbar relative -mx-4 mt-6 flex gap-1 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
            >
              {NAV.map(({ href, label, icon: Icon, exact }, i) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <div key={href} className="shrink-0 animate-fade" style={{ animationDelay: `${50 + i * 40}ms` }}>
                    <Link href={href} aria-current={active ? "page" : undefined} className={clsx(itemClass, active ? "text-white lg:text-ink" : "text-ink/60 hover:bg-black/[0.03] hover:text-ink")}>
                      {active && (
                        <m.span
                          layoutId="account-nav-pill"
                          aria-hidden="true"
                          className="absolute inset-0 -z-10 rounded-full bg-ink lg:rounded-2xl lg:bg-white lg:shadow-neu"
                          transition={{ type: "spring", stiffness: 400, damping: 34 }}
                        />
                      )}
                      <Icon size={16} strokeWidth={1.75} /> {t(label)}
                    </Link>
                  </div>
                );
              })}
              <span aria-hidden="true" className="mx-2 my-2 hidden h-px bg-black/[0.06] lg:block" />
              {user?.isStaff && (
                <Link href="/admin" className={clsx(itemClass, "text-ink/60 hover:bg-black/[0.03] hover:text-ink")}>
                  <Shield size={16} strokeWidth={1.75} /> {t("Admin panel")}
                </Link>
              )}
              <button type="button" onClick={() => void logout()} className={clsx(itemClass, "text-left text-ink/60 hover:bg-danger/[0.06] hover:text-danger")}>
                <LogOut size={16} strokeWidth={1.75} /> {t("Sign out")}
              </button>
            </nav>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </RequireAuth>
  );
}
