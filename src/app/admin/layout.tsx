"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { clsx } from "clsx";
import { ExternalLink, LogOut, Menu, ScanLine, X } from "lucide-react";
import { ADMIN_NAV, NAV_LINK } from "@/components/admin/nav";
import { LogoMark } from "@/components/store/navbar";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth staff>
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  // Close the mobile menu on navigation (adjusting state during render, not in an effect).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  const nav = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.any.some((p) => can(p))) })).filter((g) => g.items.length);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const sidebar = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-2 px-5 py-5">
        <LogoMark />
        <span className="text-sm font-semibold tracking-[0.25em]">TRENDZ</span>
        <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">Admin</span>
      </Link>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {nav.map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink/40">{g.group}</p>
            {g.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={clsx(NAV_LINK.base, isActive(href) ? NAV_LINK.active : NAV_LINK.idle)}
              >
                <Icon size={16} strokeWidth={1.75} /> {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-black/5 bg-offwhite lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-night/70 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <aside className="h-full w-64 animate-rise bg-offwhite">
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-full p-2 hover:bg-black/5 lg:hidden">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-black/5 bg-offwhite/85 px-4 backdrop-blur-md sm:px-6">
          <button aria-label="Open menu" className="-ml-1 rounded-full p-2 lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="ml-auto flex items-center gap-2">
            {can("pos.use") && (
              <Link href="/pos" className="flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white">
                <ScanLine size={14} /> Billing / POS
              </Link>
            )}
            <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink/60 hover:bg-black/5 sm:flex">
              Storefront <ExternalLink size={12} />
            </Link>
            <span className="hidden max-w-40 truncate text-xs text-ink/50 md:block">{user?.name ?? user?.email}</span>
            <button aria-label="Sign out" onClick={() => void logout()} className="rounded-full p-2 text-ink/50 hover:bg-black/5 hover:text-ink">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<Spinner />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
