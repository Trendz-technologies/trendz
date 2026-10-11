"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ArrowUpRight } from "lucide-react";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { ImageView, ProductCard as Card } from "@/lib/types";
import { isColorOption, swatch } from "./colors";
import { Stagger, StaggerItem } from "./motion";
import { WishlistButton } from "./wishlist-button";

/** Responsive product image: AVIF first, WebP fallback, lazy by default. */
export function ProductImage({ image, alt, sizes = "(min-width: 1024px) 25vw, 50vw", className, priority = false }: { image: ImageView | null; alt: string; sizes?: string; className?: string; priority?: boolean }) {
  const { t } = useI18n();
  if (!image?.medium && !image?.url) {
    return <div className={clsx("flex items-center justify-center bg-gradient-to-br from-sand/60 to-offwhite text-xs text-ink/30", className)}>{t("No image")}</div>;
  }
  const webp = [image.thumb && `${image.thumb} 320w`, image.medium && `${image.medium} 800w`, image.large && `${image.large} 1600w`].filter(Boolean).join(", ");
  const avif = [image.avif.medium && `${image.avif.medium} 800w`, image.avif.large && `${image.avif.large} 1600w`].filter(Boolean).join(", ");
  return (
    <picture>
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      <source type="image/webp" srcSet={webp} sizes={sizes} />
      <img
        src={image.medium ?? image.url ?? undefined}
        alt={image.altText ?? alt}
        width={image.width ?? 800}
        height={image.height ?? 1000}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}

export function Price({ price, mrp, className }: { price: number; mrp?: number; className?: string }) {
  const { t } = useI18n();
  const off = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return (
    <span className={clsx("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className="font-semibold">{money(price)}</span>
      {off > 0 && (
        <>
          <s className="text-xs text-ink/40">{money(mrp)}</s>
          <span className="text-xs font-semibold text-accent">{t("{percent}% off", { percent: off })}</span>
        </>
      )}
    </span>
  );
}

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const { t, tn, tx } = useI18n();
  const colors = product.options.find((o) => isColorOption(o.name))?.values ?? [];
  return (
    <article className="group relative">
      <Link href={`/products/${product.slug}`} className="block" aria-label={product.name}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-gold/15 bg-white shadow-neu transition-[box-shadow,border-color] duration-500 group-hover:border-gold/50 group-hover:shadow-neu-lg">
          <ProductImage
            image={product.image}
            alt={product.name}
            priority={priority}
            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]"
          />
          {product.hoverImage && (
            <div className="absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100">
              <ProductImage image={product.hoverImage} alt="" className="h-full w-full scale-[1.07] object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-100" />
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {product.discountPercent > 0 && <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white">−{product.discountPercent}%</span>}
            {product.isFeatured && product.inStock && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" /> {t("Trending")}
              </span>
            )}
            {!product.inStock && <span className="rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white">{t("Sold out")}</span>}
          </div>
          {/* Slides up on hover (pointer devices). */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex translate-y-[130%] items-center justify-between rounded-2xl bg-white/90 px-4 py-3 text-xs font-semibold opacity-0 shadow-neu backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100">
            <span>{product.inStock ? t("View product") : t("See details")}</span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-white transition-transform duration-500 group-hover:rotate-45">
              <ArrowUpRight size={14} />
            </span>
          </div>
        </div>
        <div className="mt-3.5 px-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">{product.brand?.name ?? tx(product.category.name)}</p>
          <h3 className="mt-1 line-clamp-1 text-sm font-semibold">{product.name}</h3>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Price price={product.sellingPrice} mrp={product.mrp} className="text-sm" />
            {colors.length > 1 && (
              <span className="flex items-center" aria-label={tn(colors.length, "{n} colour", "{n} colours")}>
                {colors.slice(0, 4).map((c, i) => (
                  <span key={c} title={tx(c)} className={clsx("h-3.5 w-3.5 rounded-full border-2 border-offwhite", i > 0 && "-ml-1")} style={{ backgroundColor: swatch(c) }} />
                ))}
                {colors.length > 4 && <span className="ml-1 text-[10px] text-ink/45">+{colors.length - 4}</span>}
              </span>
            )}
          </div>
        </div>
      </Link>
      <WishlistButton productId={product.id} productName={product.name} className="absolute right-3 top-3 h-9 w-9 bg-white/85 shadow-neu backdrop-blur hover:scale-110" />
    </article>
  );
}

/** Product grid whose cards rise in one after another as it scrolls into view. */
export function ProductGrid({ products, priorityCount = 0, columns = 4 }: { products: Card[]; priorityCount?: number; columns?: 3 | 4 }) {
  return (
    <Stagger className={clsx("grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6", columns === 4 ? "md:grid-cols-3 lg:grid-cols-4" : "md:grid-cols-3")} gap={0.06}>
      {products.map((p, i) => (
        <StaggerItem key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** Loading placeholder matching the card layout. */
export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[4/5] rounded-3xl" />
      <div className="mt-3.5 space-y-2 px-1">
        <div className="skeleton h-2.5 w-1/3" />
        <div className="skeleton h-3.5 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, columns = 4 }: { count?: number; columns?: 3 | 4 }) {
  const { t } = useI18n();
  return (
    <div className={clsx("grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6", columns === 4 ? "md:grid-cols-3 lg:grid-cols-4" : "md:grid-cols-3")} aria-busy="true" aria-label={t("Loading products")}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
