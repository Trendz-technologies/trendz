"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m, useMotionValueEvent, useScroll } from "motion/react";
import { clsx } from "clsx";
import { ArrowRight, ArrowUpRight, BadgePercent, ChevronDown, ChevronRight, Heart, LogIn, LogOut, Menu, Package, Search, ShoppingBag, Store, User, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { useI18n } from "@/lib/i18n/client";
import type { CategoryNode, SessionUser } from "@/lib/types";
import { useCartDrawer } from "./cart-drawer";
import { LanguageSwitch } from "./language-switch";
import { ThemeToggle } from "./theme-toggle";
import { useWishlist } from "./wishlist-button";
import { EASE_OUT, Marquee } from "./motion";
import { plainText } from "@/lib/rich-text";

/** One or two letters for a shopper: from their name, or else from their email address. */
function initialsOf(user: SessionUser | null): string | null {
  const first = (word: string | undefined) => (word ? [...word][0] ?? "" : "");
  const words = user?.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const letters = words.length ? first(words[0]) + (words.length > 1 ? first(words[words.length - 1]) : "") : first(user?.email?.trim());
  return letters ? letters.toUpperCase() : null;
}

/** The signed-in shopper's own mark in the header: their initials on the brand colour (accounts have no photo). */
function Avatar({ user }: { user: SessionUser | null }) {
  const initials = initialsOf(user);
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-[13px] font-bold tracking-wide text-white ring-2 ring-gold/40">
      {initials ?? <User size={17} strokeWidth={2} />}
    </span>
  );
}

export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2 L13.8 9.2 21 11 13.8 12.8 12 20 10.2 12.8 3 11 10.2 9.2 Z" fill="currentColor" />
    </svg>
  );
}

/** `logo` is the picture uploaded in Admin → CMS → Home page; without one the emblem that ships with the app is shown. */
function Wordmark({ logo }: { logo: string | null }) {
  const { t } = useI18n();
  return (
    <Link href="/" className="group flex items-center gap-2.5 max-[380px]:gap-1.5" aria-label={t("{store} home", { store: BRAND.fullName })}>
      {/* The shop's logo is drawn for a black background, so it sits on a black chip (which disappears into the page in dark mode). */}
      {/* On the narrowest phones (up to 380px) the emblem and the name are a size smaller, or the name runs into the search icon. */}
      <span className="grid h-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-night px-1 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 max-[380px]:h-9">
        {logo ? (
          // An uploaded logo can be any shape: it is fitted whole into the chip, up to a wordmark's width.
          <img src={logo} alt="" className="h-10 w-auto max-w-28 object-contain max-[380px]:h-8 max-[380px]:max-w-20" />
        ) : (
          <img src={BRAND.emblem} alt="" width={262} height={184} className="h-10 w-auto max-[380px]:h-8" />
        )}
      </span>
      <span lang="en" className="flex flex-col leading-none">
        <span className="text-gold-shine font-display text-xl font-bold tracking-[0.14em] max-[380px]:text-base max-[380px]:tracking-[0.08em]">TRENDZ</span>
        <span className="mt-1 hidden font-display text-[8px] font-semibold uppercase tracking-[0.42em] text-gold/75 sm:block">Women&apos;s Wear</span>
      </span>
    </Link>
  );
}

type Suggestion = { name: string; slug: string; sellingPrice: number; image: string | null };

/** Full-width search panel with live suggestions. */
function SearchPanel({ categories, onClose }: { categories: CategoryNode[]; onClose: () => void }) {
  const router = useRouter();
  const { t, tx } = useI18n();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isFetching } = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => api.get<Suggestion[]>("/store/search/suggest", { q: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });
  const results = debounced.length >= 2 ? (data ?? []) : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    onClose();
    router.push(`/products?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      {/* Dims the page below the bar. Hung from the bar (not fixed to the screen): the bar's backdrop blur would hold a fixed layer inside the bar itself. */}
      <m.div className="absolute inset-x-0 top-full z-30 h-screen bg-night/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <m.div
        className="absolute inset-x-0 top-full z-40 border-b border-black/5 bg-offwhite shadow-neu-lg"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        <div className="container-x py-8">
          <form role="search" onSubmit={submit} className="relative">
            <label htmlFor="site-search" className="sr-only">
              {t("Search products")}
            </label>
            <Search size={22} className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              ref={input}
              id="site-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Search kurtis, anarkalis, lehengas…")}
              autoComplete="off"
              className="w-full border-b-2 border-ink/10 bg-transparent py-4 pl-10 pr-28 text-2xl font-semibold tracking-tight outline-none transition placeholder:font-normal placeholder:text-ink/30 focus:border-ink md:text-3xl"
            />
            <button type="submit" className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white">
              {t("Search")} <ArrowRight size={14} />
            </button>
          </form>

          {results.length > 0 ? (
            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {results.map((s, i) => (
                <m.li key={s.slug} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.45, ease: EASE_OUT }}>
                  <Link href={`/products/${s.slug}`} onClick={onClose} className="group block">
                    <span className="block aspect-[4/5] overflow-hidden rounded-2xl bg-white">
                      {s.image ? <img src={s.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <span className="block h-full w-full bg-mist" />}
                    </span>
                    <span className="mt-2 line-clamp-1 block text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-ink/55">{money(s.sellingPrice)}</span>
                  </Link>
                </m.li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="eyebrow mr-2">{debounced.length >= 2 && !isFetching ? t("No matches — try") : t("Popular")}</span>
              {categories.flatMap((c) => [c, ...c.children]).slice(0, 8).map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} onClick={onClose} className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm transition hover:border-ink hover:bg-ink hover:text-white">
                  {tx(c.name)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </m.div>
    </>
  );
}

/** One of the two big shortcuts at the top of the phone menu. */
function MenuTile({ href, label, icon, active, onClick }: { href: string; label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      // Tamil words are longer: there the label sits under the icon, with the tile's whole width to itself.
      className={clsx("flex items-center gap-3 rounded-2xl border p-3 text-sm font-semibold transition ta:flex-col ta:items-start ta:gap-2", active ? "border-accent/40 bg-accent-soft" : "border-black/[0.07] bg-white shadow-neu")}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">{icon}</span>
      <span className="min-w-0 leading-tight [overflow-wrap:anywhere]">{label}</span>
    </Link>
  );
}

/**
 * The menu on phones and small tablets. From the top: who is signed in (or the
 * way in), the two busiest doors, the collections, a signed-in shopper's own
 * shortcuts and the shop's pages. The logo and the close button above, and the
 * language switch below, stay in place while the middle scrolls.
 */
function MobileMenu({ links, categories, logo, onClose }: { links: { label: string; href: string }[]; categories: CategoryNode[]; logo: string | null; onClose: () => void }) {
  const { user, status, logout } = useAuth();
  const { t, tx } = useI18n();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } } };

  const shortcut = (href: string) => links.find((l) => l.href === href);
  const [shopAll, offers] = [shortcut("/products"), shortcut("/offers")];
  const collections = links.filter((l) => l.href.startsWith("/category/"));
  const pages = links.filter((l) => !l.href.startsWith("/category/") && l !== shopAll && l !== offers);

  return (
    <div className={clsx(MENU_PANEL, "fixed inset-0 z-[55]")}>
      <m.div className="absolute inset-0 bg-night/70 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <m.nav
        aria-label={t("Menu")}
        className="absolute inset-y-0 left-0 flex w-[22rem] max-w-[88vw] flex-col overflow-hidden rounded-r-[1.75rem] bg-offwhite shadow-neu-lg"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-5 py-3.5">
          <Wordmark logo={logo} />
          <button aria-label={t("Close menu")} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white transition hover:rotate-90">
            <X size={18} />
          </button>
        </div>

        <m.div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.12 } } }}>
          {/* Who is signed in, or the way in. */}
          <m.div variants={item}>
            {status === "authenticated" ? (
              <Link href="/account" onClick={onClose} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-neu">
                <Avatar user={user} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-semibold">{user?.name || t("My account")}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink/55">{user?.email ?? user?.phone}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink/35" />
              </Link>
            ) : status === "anonymous" ? (
              <div className="on-dark gold-frame relative overflow-hidden rounded-2xl bg-night p-4 text-white">
                <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-accent/40 blur-3xl" />
                <p className="relative text-[13px] leading-snug text-white/75">{t("Sign in to track orders, save addresses and check out faster.")}</p>
                <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link href="/login" onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white">
                    <LogIn size={15} strokeWidth={2} aria-hidden="true" /> {t("Login")}
                  </Link>
                  <Link href="/register" onClick={onClose} className="text-sm font-semibold text-gold-bright">
                    {t("Create account")}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="skeleton h-[4.25rem]" />
            )}
          </m.div>

          {(shopAll || offers) && (
            <m.div variants={item} className="mt-4 grid grid-cols-2 gap-3">
              {shopAll && <MenuTile href={shopAll.href} label={shopAll.label} icon={<Store size={18} strokeWidth={1.75} />} active={pathname === shopAll.href} onClick={onClose} />}
              {offers && <MenuTile href={offers.href} label={offers.label} icon={<BadgePercent size={18} strokeWidth={1.75} />} active={pathname === offers.href} onClick={onClose} />}
            </m.div>
          )}

          {collections.length > 0 && (
            <>
              <m.p variants={item} className="eyebrow mt-7">
                {t("Collections")}
              </m.p>
              <ul className="mt-1.5">
                {collections.map((l) => {
                  const cat = categories.find((c) => `/category/${c.slug}` === l.href);
                  const open = expanded === l.href;
                  const active = pathname === l.href;
                  return (
                    <m.li key={l.href} variants={item} className="border-b border-black/[0.06] last:border-b-0">
                      <div className="flex items-center">
                        <Link href={l.href} onClick={onClose} aria-current={active ? "page" : undefined} className={clsx("flex min-h-12 flex-1 items-center gap-3 py-2 text-[15px] font-medium", active && "text-accent")}>
                          <span aria-hidden="true" className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-accent" : "bg-gold/60")} />
                          {l.label}
                        </Link>
                        {cat?.children.length ? (
                          <button aria-label={open ? t("Hide {name} categories", { name: l.label }) : t("Show {name} categories", { name: l.label })} aria-expanded={open} onClick={() => setExpanded(open ? null : l.href)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5">
                            <ChevronDown size={18} className={clsx("transition-transform duration-300", open && "rotate-180")} />
                          </button>
                        ) : (
                          <ChevronRight size={16} aria-hidden="true" className="mr-1 shrink-0 text-ink/30" />
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {open && cat && (
                          <m.ul className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
                            {cat.children.map((c) => (
                              <li key={c.id}>
                                <Link href={`/category/${c.slug}`} onClick={onClose} className="block py-2 pl-[1.125rem] text-sm text-ink/65 hover:text-ink">
                                  {tx(c.name)}
                                </Link>
                              </li>
                            ))}
                            <li className="pb-2" />
                          </m.ul>
                        )}
                      </AnimatePresence>
                    </m.li>
                  );
                })}
              </ul>
            </>
          )}

          {/* A signed-in shopper's own places. */}
          {status === "authenticated" && (
            <m.div variants={item} className="mt-6 grid grid-cols-2 gap-3 text-sm font-semibold">
              <Link href="/account/orders" onClick={onClose} className="flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-4">
                <Package size={16} strokeWidth={1.75} className="shrink-0 text-accent" /> <span className="truncate">{t("Your orders")}</span>
              </Link>
              <Link href="/account/wishlist" onClick={onClose} className="flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-4">
                <Heart size={16} strokeWidth={1.75} className="shrink-0 text-accent" /> <span className="truncate">{t("Wishlist")}</span>
              </Link>
            </m.div>
          )}

          {(pages.length > 0 || user?.isStaff) && (
            <m.ul variants={item} className="mt-6 border-t border-black/[0.06] pt-2 text-sm">
              {pages.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={onClose} aria-current={pathname === l.href ? "page" : undefined} className={clsx("flex min-h-11 items-center justify-between font-medium", pathname === l.href ? "text-accent" : "text-ink/75")}>
                    {l.label}
                    <ArrowUpRight size={15} aria-hidden="true" className="mr-1 text-ink/30" />
                  </Link>
                </li>
              ))}
              {user?.isStaff && (
                <li>
                  <Link href="/admin" onClick={onClose} className="flex min-h-11 items-center justify-between font-medium text-ink/75">
                    {t("Admin panel")}
                    <ArrowUpRight size={15} aria-hidden="true" className="mr-1 text-ink/30" />
                  </Link>
                </li>
              )}
            </m.ul>
          )}
        </m.div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-black/[0.06] px-5 py-3.5 text-sm">
          <LanguageSwitch />
          {status === "authenticated" && (
            <button type="button" onClick={() => void logout().then(onClose)} className="inline-flex items-center gap-1.5 font-medium text-ink/65 hover:text-ink">
              <LogOut size={15} strokeWidth={1.75} aria-hidden="true" /> {t("Sign out")}
            </button>
          )}
        </div>
      </m.nav>
    </div>
  );
}

/** Top-level categories shown as their own links in the bar; a longer list is grouped under "Collections". */
const MAX_BAR_CATEGORIES = 3;
/** Menu key of the "Collections" menu (not a possible category slug). */
const ALL_COLLECTIONS = "*";
const MEGA_ID = "nav-mega-menu";
/*
 * The row of links only fits beside the icons while the search is an icon, so
 * the search field is shown where the links leave room for it:
 *   English  links from 1024px with the search icon, the search field back from 1280px
 *   Tamil    (longer words) links from 1280px with the search icon; below that the menu button and the search field
 */
const BAR_NAV = "hidden lg:flex ta:lg:hidden ta:xl:flex";
const MENU_BUTTON = "grid lg:hidden ta:lg:grid ta:xl:hidden";
const MENU_PANEL = "lg:hidden ta:lg:block ta:xl:hidden";
const SEARCH_FIELD = "hidden md:flex lg:hidden xl:flex ta:lg:flex ta:xl:hidden";
const SEARCH_ICON = "flex md:hidden lg:flex xl:hidden ta:lg:hidden ta:xl:flex";
// Slightly tighter between 1024 and 1279px, where the row is at its fullest.
const BAR_LINK = "relative flex items-center gap-1 whitespace-nowrap px-2.5 py-2 text-sm font-medium transition-colors xl:px-3.5";
const BAR_UNDERLINE = "absolute inset-x-2.5 -bottom-0.5 h-[2px] rounded-full bg-accent xl:inset-x-3.5";
const UNDERLINE_SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

/** `about` is whether the About us page is switched on in Admin → CMS; its link is left out otherwise. `logo` is the logo uploaded there, if any. */
export function Navbar({ categories, announcements = [], about = false, logo = null }: { categories: CategoryNode[]; announcements?: string[]; about?: boolean; logo?: string | null }) {
  const pathname = usePathname();
  const { status, user } = useAuth();
  const { data: cart } = useCart();
  // How many products the shopper has saved (asked for only once they are signed in).
  const saved = useWishlist().data?.length ?? 0;
  const { openCart } = useCartDrawer();
  const { t, tn, tx } = useI18n();
  const [mobile, setMobile] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [megaFor, setMegaFor] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeSearch = useCallback(() => setSearching(false), []);
  const closeMobile = useCallback(() => setMobile(false), []);

  // Close menus on navigation (adjusting state during render, not in an effect).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobile(false);
    setSearching(false);
    setMegaFor(null);
  }

  // The header stays at the top of the screen; once the page has moved under it, the bar gets its hairline and shadow.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  // "/" opens search from anywhere (except while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (e.key === "/" && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const links = [
    { label: t("Shop all"), href: "/products" },
    ...categories.map((c) => ({ label: tx(c.name), href: `/category/${c.slug}` })),
    { label: t("Offers"), href: "/offers" },
    ...(about ? [{ label: t("About us"), href: "/about" }] : []),
    { label: t("Contact us"), href: "/contact" },
  ];
  // The bar has room for a few categories. A longer list (the shop's collections) goes into one "Collections" menu.
  const grouped = categories.length > MAX_BAR_CATEGORIES;
  const barLinks = grouped ? links.filter((l) => !l.href.startsWith("/category/")) : links;
  const inCategory = pathname.startsWith("/category/");
  const megaCategory = categories.find((c) => c.slug === megaFor && c.children.length);
  // What the open menu shows: every collection, or one category's subcategories.
  const mega =
    grouped && megaFor === ALL_COLLECTIONS
      ? { key: ALL_COLLECTIONS, eyebrow: t("Collections"), title: t("Shop by category"), description: null, href: "/products", cta: t("Browse everything"), items: categories }
      : megaCategory && {
          key: megaCategory.slug,
          eyebrow: t("Collection"),
          title: tx(megaCategory.name),
          description: megaCategory.description,
          href: `/category/${megaCategory.slug}`,
          cta: t("Shop all {name}", { name: tx(megaCategory.name) }),
          items: megaCategory.children,
        };
  const openMega = (slug: string | null) => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setMegaFor(slug), slug ? 80 : 160);
  };
  const count = cart?.itemCount ?? 0;
  const searchButton = { onClick: () => setSearching((s) => !s), "aria-label": searching ? t("Close search") : t("Search"), "aria-expanded": searching };
  const searchIcon = searching ? <X size={18} /> : <Search size={18} strokeWidth={1.75} />;

  return (
    <header className="sticky top-0 z-40">
      {/* Top strip: the announcement ticker, with the language switch pinned over its right end. */}
      <div className="on-dark relative min-h-8 border-b border-gold/25 bg-night">
        {announcements.length > 0 && (
          <div className="py-2 font-display text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-bright/90 ta:font-sans ta:text-xs">
            <Marquee>
              {announcements.map((a) => (
                <span key={a} className="flex items-center gap-8 pr-8">
                  {a}
                  <span className="text-accent">✦</span>
                </span>
              ))}
            </Marquee>
          </div>
        )}
        {/* On phones the light / dark toggle sits here too: the main row below has no room for it. */}
        <div className="absolute inset-y-0 right-0 flex items-stretch">
          <LanguageSwitch bar className="max-sm:pr-0.5" />
          <ThemeToggle bar />
        </div>
      </div>
      {/* The bar is frosted glass: the page shows through it, blurred, as it scrolls underneath. */}
      <div className={clsx("relative border-b bg-offwhite/75 backdrop-blur-xl transition-[box-shadow,border-color] duration-500", scrolled || searching || megaFor ? "border-gold/15 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.9)]" : "border-transparent")}>
        <div className="container-x flex h-16 items-center gap-4">
          <button className={clsx(MENU_BUTTON, "-ml-2 h-10 w-10 place-items-center rounded-full hover:bg-black/5")} aria-label={t("Open menu")} onClick={() => setMobile(true)}>
            <Menu size={20} />
          </button>
          <Wordmark logo={logo} />

          <nav aria-label={t("Main menu")} className={clsx(BAR_NAV, "ml-8 items-center")} onMouseLeave={() => { setHovered(null); openMega(null); }}>
            {barLinks.map((l) => {
              const cat = categories.find((c) => `/category/${c.slug}` === l.href);
              const active = pathname === l.href || (l.href !== "/products" && pathname.startsWith(l.href));
              return (
                <Fragment key={l.href}>
                  <Link
                    href={l.href}
                    onMouseEnter={() => {
                      setHovered(l.href);
                      openMega(cat?.children.length ? cat.slug : null);
                    }}
                    onFocus={() => setHovered(l.href)}
                    className={clsx(BAR_LINK, active || hovered === l.href ? "text-ink" : "text-ink/60")}
                  >
                    {l.label}
                    {!!cat?.children.length && <ChevronDown size={13} className={clsx("transition-transform duration-300", megaFor === cat.slug && "rotate-180")} />}
                    {(hovered ?? (active ? l.href : null)) === l.href && <m.span layoutId="nav-underline" className={BAR_UNDERLINE} transition={UNDERLINE_SPRING} />}
                  </Link>
                  {/* All collections in one menu, right after "Shop all". Opens on hover, focus-and-Enter or click. */}
                  {grouped && l.href === "/products" && (
                    <button
                      type="button"
                      aria-haspopup="true"
                      aria-expanded={megaFor === ALL_COLLECTIONS}
                      aria-controls={MEGA_ID}
                      onMouseEnter={() => {
                        setHovered(ALL_COLLECTIONS);
                        openMega(ALL_COLLECTIONS);
                      }}
                      onFocus={() => setHovered(ALL_COLLECTIONS)}
                      onClick={() => openMega(ALL_COLLECTIONS)}
                      onKeyDown={(e) => e.key === "Escape" && openMega(null)}
                      className={clsx(BAR_LINK, inCategory || hovered === ALL_COLLECTIONS ? "text-ink" : "text-ink/60")}
                    >
                      {t("Collections")}
                      <ChevronDown size={13} className={clsx("transition-transform duration-300", megaFor === ALL_COLLECTIONS && "rotate-180")} />
                      {(hovered ?? (inCategory ? ALL_COLLECTIONS : null)) === ALL_COLLECTIONS && <m.span layoutId="nav-underline" className={BAR_UNDERLINE} transition={UNDERLINE_SPRING} />}
                    </button>
                  )}
                </Fragment>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {/* The same button twice: as a field where there is room, as an icon where there is not (see BAR_NAV). */}
            <button {...searchButton} className={clsx(SEARCH_FIELD, "h-10 w-56 items-center justify-between gap-2 rounded-full border border-black/10 bg-white px-3 text-sm text-ink/60 transition hover:bg-black/5 hover:text-ink")}>
              {t("Search…")}
              <span className="flex items-center gap-2">
                <kbd className="rounded-md border border-black/10 px-1.5 text-[10px] font-semibold text-ink/40">/</kbd>
                {searchIcon}
              </span>
            </button>
            <button {...searchButton} className={clsx(SEARCH_ICON, "h-10 w-10 items-center justify-center rounded-full text-ink/60 transition hover:bg-black/5 hover:text-ink")}>
              {searchIcon}
            </button>
            {status === "authenticated" ? (
              <>
                {/* On phones the heart is in the menu instead: the bar only has room for the bag and the account. */}
                <Link href="/account/wishlist" aria-label={t("Wishlist")} className="relative hidden h-10 w-10 place-items-center rounded-full transition hover:bg-black/5 sm:grid">
                  <Heart size={19} strokeWidth={1.75} />
                  {saved > 0 && <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{saved}</span>}
                </Link>
                <button onClick={openCart} aria-label={tn(count, "Open bag, {n} item", "Open bag, {n} items")} className="relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5">
                  <ShoppingBag size={19} strokeWidth={1.75} />
                  <AnimatePresence>
                    {count > 0 && (
                      <m.span
                        key={count}
                        className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: [1.45, 1], opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                      >
                        {count}
                      </m.span>
                    )}
                  </AnimatePresence>
                </button>
                <Link href="/account" aria-label={t("Your account")} className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5">
                  <Avatar user={user} />
                </Link>
              </>
            ) : status === "anonymous" ? (
              <Link href="/login" className="ml-1 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white sm:px-5">
                <LogIn size={16} strokeWidth={2} aria-hidden="true" /> {t("Login")}
              </Link>
            ) : (
              // While the session is being checked: the room the buttons will take, so nothing jumps and nobody is shown the wrong ones.
              <span aria-hidden="true" className="h-10 w-24" />
            )}
          </div>
        </div>

        {/* Category mega menu */}
        <AnimatePresence>
          {mega && (
            <m.div
              key={mega.key}
              id={MEGA_ID}
              className="absolute inset-x-0 top-full hidden border-b border-black/5 bg-offwhite shadow-neu-lg lg:block"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              onMouseEnter={() => openMega(mega.key)}
              onMouseLeave={() => openMega(null)}
              onKeyDown={(e) => e.key === "Escape" && openMega(null)}
            >
              <div className="container-x grid grid-cols-[1fr_2fr] gap-10 py-10">
                <div>
                  <p className="eyebrow">{mega.eyebrow}</p>
                  <p className="mt-2 text-4xl font-bold tracking-tighter">{mega.title}</p>
                  {mega.description && <p className="mt-2 line-clamp-3 max-w-xs text-sm text-ink/55">{plainText(mega.description)}</p>}
                  <Link href={mega.href} className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                    {mega.cta}
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
                <m.ul className="grid grid-cols-3 gap-3" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
                  {mega.items.map((c) => (
                    <m.li key={c.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                      <Link href={`/category/${c.slug}`} className="group flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold shadow-neu transition hover:-translate-y-0.5 hover:shadow-neu-lg">
                        {tx(c.name)}
                        <ArrowRight size={14} className="-translate-x-2 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </m.li>
                  ))}
                </m.ul>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{searching && <SearchPanel categories={categories} onClose={closeSearch} />}</AnimatePresence>
      </div>

      <AnimatePresence>{mobile && <MobileMenu links={links} categories={categories} logo={logo} onClose={closeMobile} />}</AnimatePresence>
    </header>
  );
}
