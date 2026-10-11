"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { Minus, Plus, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { clsx } from "clsx";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useCart, useRemoveCartItem, useUpdateCartItem } from "@/lib/cart";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { Cart } from "@/lib/types";
import { EASE_OUT } from "./motion";

interface CartDrawerApi {
  openCart: () => void;
  closeCart: () => void;
}

const CartDrawerContext = createContext<CartDrawerApi | null>(null);

/** Opens the slide-in bag from anywhere in the storefront (navbar, add-to-bag, …). */
export function useCartDrawer() {
  const ctx = useContext(CartDrawerContext);
  if (!ctx) throw new Error("useCartDrawer must be used inside <CartDrawerProvider>");
  return ctx;
}

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openCart, closeCart }), [openCart, closeCart]);
  return (
    <CartDrawerContext.Provider value={value}>
      {children}
      <AnimatePresence>{open && <CartDrawer onClose={closeCart} />}</AnimatePresence>
    </CartDrawerContext.Provider>
  );
}

function CartDrawer({ onClose }: { onClose: () => void }) {
  const { data: cart, isLoading } = useCart();
  const { t } = useI18n();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]">
      <m.div className="absolute inset-0 bg-night/70 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      <m.aside
        role="dialog"
        aria-modal="true"
        aria-label={t("Your bag")}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-offwhite shadow-neu-lg"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.55, ease: EASE_OUT }}
      >
        <header className="flex items-center justify-between border-b border-black/5 px-6 py-5">
          <p className="text-lg font-bold tracking-tight">
            {t("Your bag")}{" "}
            {!!cart?.itemCount && (
              <m.span key={cart.itemCount} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="inline-block text-ink/40">
                ({cart.itemCount})
              </m.span>
            )}
          </p>
          <button ref={closeButton} onClick={onClose} aria-label={t("Close bag")} className="grid h-10 w-10 place-items-center rounded-full transition hover:rotate-90 hover:bg-black/5">
            <X size={20} />
          </button>
        </header>

        {isLoading || !cart ? (
          <div className="space-y-4 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-24 w-20" />
                <div className="flex-1 space-y-2 py-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !cart.items.length ? (
          <EmptyBag onClose={onClose} />
        ) : (
          <>
            <FreeShippingMeter cart={cart} />
            <ul className="flex-1 overflow-y-auto px-6">
              <AnimatePresence initial={false}>
                {cart.items.map((item) => (
                  <DrawerLine key={item.itemId} item={item} onNavigate={onClose} />
                ))}
              </AnimatePresence>
            </ul>
            <footer className="border-t border-black/5 bg-white/70 px-6 py-5 backdrop-blur">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink/60">{t("Subtotal")}</span>
                <span className="text-xl font-bold tabular-nums">{money(cart.items.reduce((s, i) => s + i.lineTotal, 0))}</span>
              </div>
              {cart.savings > 0 && <p className="mt-1 text-right text-xs font-medium text-success">{t("You save {amount}", { amount: money(cart.savings) })}</p>}
              <p className="mt-1 text-xs text-ink/45">{cart.pricesIncludeTax ? `${t("Prices include GST.")} ` : ""}{t("Shipping is calculated at checkout.")}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link href="/cart" onClick={onClose} className="flex h-12 items-center justify-center rounded-full border border-ink/15 text-sm font-semibold transition hover:border-ink">
                  {t("View bag")}
                </Link>
                <Link href="/checkout" onClick={onClose} className="group flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-ink/90">
                  {t("Checkout")}
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </footer>
          </>
        )}
      </m.aside>
    </div>
  );
}

function FreeShippingMeter({ cart }: { cart: Cart }) {
  const { t, tr } = useI18n();
  const threshold = cart.shipping.freeShippingThreshold;
  if (!threshold) return null;
  const left = cart.shipping.amountToFreeShipping;
  const progress = Math.min(1, Math.max(0, (threshold - left) / threshold));
  return (
    <div className="px-6 pt-5">
      <p className="flex items-center gap-2 text-xs font-medium text-ink/70">
        <Truck size={14} />
        {left > 0 ? (
          <span>{tr("Add {amount} more for free shipping", { amount: <strong className="text-ink">{money(left)}</strong> })}</span>
        ) : (
          <span className="text-success">{t("You've unlocked free shipping")}</span>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
        <m.div className={clsx("h-full rounded-full", left > 0 ? "bg-accent" : "bg-success")} initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.9, ease: EASE_OUT }} />
      </div>
    </div>
  );
}

function DrawerLine({ item, onNavigate }: { item: Cart["items"][number]; onNavigate: () => void }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const toast = useToast();
  const { t } = useI18n();
  const busy = update.isPending || remove.isPending;
  const setQty = (quantity: number) => update.mutate({ itemId: item.itemId, quantity }, { onError: (e) => toast(errorMessage(e), "error") });

  return (
    <m.li
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
      className={clsx("flex gap-4 overflow-hidden border-b border-black/5 py-5", busy && "opacity-60")}
    >
      <Link href={`/products/${item.slug}`} onClick={onNavigate} className="block h-28 w-22 shrink-0 overflow-hidden rounded-2xl bg-white">
        {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 hover:scale-105" /> : <span className="block h-full w-full bg-mist" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/products/${item.slug}`} onClick={onNavigate} className="line-clamp-1 text-sm font-semibold hover:underline">
              {item.name}
            </Link>
            <p className="mt-0.5 text-xs text-ink/50">{item.variantTitle}</p>
          </div>
          <button aria-label={t("Remove {name}", { name: item.name })} disabled={busy} onClick={() => remove.mutate(item.itemId, { onError: (e) => toast(errorMessage(e), "error") })} className="h-8 w-8 shrink-0 rounded-full text-ink/40 transition hover:bg-black/5 hover:text-danger">
            <Trash2 size={15} className="mx-auto" />
          </button>
        </div>
        {item.issue && <p className="mt-1 text-xs font-medium text-danger">{item.issue}</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-center rounded-full border border-black/10 bg-white">
            <button aria-label={t("Decrease quantity")} disabled={busy || item.quantity <= 1} onClick={() => setQty(item.quantity - 1)} className="grid h-8 w-8 place-items-center text-ink/60 hover:text-ink disabled:opacity-30">
              <Minus size={13} />
            </button>
            <span className="relative w-7 overflow-hidden text-center text-sm font-semibold tabular-nums">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span key={item.quantity} className="inline-block" initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }} transition={{ duration: 0.25 }}>
                  {item.quantity}
                </m.span>
              </AnimatePresence>
            </span>
            <button aria-label={t("Increase quantity")} disabled={busy || item.quantity >= item.maxQuantity} onClick={() => setQty(item.quantity + 1)} className="grid h-8 w-8 place-items-center text-ink/60 hover:text-ink disabled:opacity-30">
              <Plus size={13} />
            </button>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums">{money(item.lineTotal)}</p>
            {item.mrp > item.unitPrice && <s className="text-[11px] text-ink/35">{money(item.mrp * item.quantity)}</s>}
          </div>
        </div>
      </div>
    </m.li>
  );
}

function EmptyBag({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <m.span
        className="grid h-20 w-20 place-items-center rounded-full bg-white shadow-neu"
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
      >
        <ShoppingBag size={30} strokeWidth={1.5} />
      </m.span>
      <div>
        <p className="text-lg font-bold">{t("Your bag is empty")}</p>
        <p className="mt-1 text-sm text-ink/55">{t("Find something you love and it will show up here.")}</p>
      </div>
      <Link href="/products" onClick={onClose} className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.03]">
        {t("Start shopping")}
      </Link>
    </div>
  );
}
