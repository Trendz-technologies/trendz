"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { ArrowUpRight, Heart } from "lucide-react";
import { AccountHeader, EmptyPanel } from "@/components/store/account-ui";
import { CtaLink, delay } from "@/components/store/checkout-ui";
import { EASE_OUT } from "@/components/store/motion";
import { Price, ProductCardSkeleton, ProductImage } from "@/components/store/product-card";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/client";
import type { ImageView } from "@/lib/types";

interface WishItem {
  productId: string;
  name: string;
  slug: string;
  available: boolean;
  mrp: number;
  sellingPrice: number;
  image: ImageView | null;
}

export default function WishlistPage() {
  const qc = useQueryClient();
  const { t, tn } = useI18n();
  const q = useQuery({ queryKey: ["wishlist"], queryFn: () => api.get<WishItem[]>("/account/wishlist") });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/account/wishlist/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }) });

  return (
    <div className="space-y-8">
      <AccountHeader eyebrow={t("Saved for later")} title={t("Wishlist")} description={q.data?.length ? tn(q.data.length, "{n} piece you've got your eye on.", "{n} pieces you've got your eye on.") : t("Pieces you've saved for later.")} />
      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3" aria-busy="true">
          <p role="status" className="sr-only">
            {t("Loading your wishlist")}…
          </p>
          {Array.from({ length: 6 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : !q.data?.length ? (
        <EmptyPanel
          icon={<Heart size={28} strokeWidth={1.5} />}
          title={t("Nothing saved yet")}
          body={t("Tap the heart on any product to save it here.")}
          action={<CtaLink href="/products">{t("Browse products")}</CtaLink>}
        />
      ) : (
        <ul className="relative grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3">
          {/* Cards on the first render rise in via CSS; removals pop out and the grid closes the gap. */}
          <AnimatePresence initial={false} mode="popLayout">
            {q.data.map((w, i) => (
              <m.li key={w.productId} layout exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.35, ease: EASE_OUT } }} transition={{ layout: { duration: 0.55, ease: EASE_OUT } }}>
                <div className="animate-rise" style={delay(120 + Math.min(i, 8) * 60)}>
                  <WishCard item={w} removing={remove.isPending && remove.variables === w.productId} onRemove={() => remove.mutate(w.productId)} />
                </div>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/** Mirrors the storefront product card for the leaner wishlist data (no category / options). */
function WishCard({ item: w, removing, onRemove }: { item: WishItem; removing: boolean; onRemove: () => void }) {
  const { t } = useI18n();
  return (
    <article className={clsx("group relative transition-opacity duration-300", removing && "opacity-50")}>
      <Link href={`/products/${w.slug}`} className="block rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25" aria-label={w.name}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-white shadow-neu transition-shadow duration-500 group-hover:shadow-neu-lg">
          <ProductImage
            image={w.image}
            alt={w.name}
            sizes="(min-width: 768px) 25vw, 50vw"
            className={clsx("h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]", !w.available && "grayscale")}
          />
          {!w.available && <span className="absolute left-3 top-3 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white">{t("Unavailable")}</span>}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex translate-y-[130%] items-center justify-between rounded-2xl bg-white/90 px-4 py-3 text-xs font-semibold opacity-0 shadow-neu backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100">
            <span>{t("View product")}</span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-white transition-transform duration-500 group-hover:rotate-45">
              <ArrowUpRight size={14} />
            </span>
          </div>
        </div>
        <div className="mt-3.5 px-1">
          <h3 className="line-clamp-1 text-sm font-semibold">{w.name}</h3>
          <div className="mt-1.5">{w.available ? <Price price={w.sellingPrice} mrp={w.mrp} className="text-sm" /> : <p className="text-sm text-ink/50">{t("No longer available")}</p>}</div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={t("Remove {name}", { name: w.name })}
        title={t("Remove from wishlist")}
        onClick={onRemove}
        disabled={removing}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow-neu backdrop-blur transition hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:cursor-wait"
      >
        <Heart size={16} strokeWidth={1.8} className="fill-accent text-accent" />
      </button>
    </article>
  );
}
