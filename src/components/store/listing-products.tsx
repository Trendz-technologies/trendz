"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowDown, LoaderCircle } from "lucide-react";
import { api, type Paged } from "@/lib/api";
import { useI18n } from "@/lib/i18n/client";
import type { ProductCard } from "@/lib/types";
import { useListingProgress } from "./filters";
import { ProductGrid, ProductGridSkeleton } from "./product-card";

type Page = Paged<ProductCard[]>;

/** How far before the end of the list the next products are asked for: about one screen, so they are usually there in time. */
const LOAD_AHEAD = "900px 0px";
/** Placeholder cards shown while the next products load (two rows on a desktop, three on a phone). */
const PLACEHOLDERS = 6;

/**
 * The products of a listing, loaded as the shopper scrolls.
 *
 * The server sends the first page, already on the page when it arrives. The
 * rest are fetched a page at a time as the end of the list comes near, and are
 * kept (React Query) while the shopper looks at a product, so coming back
 * returns to the same place in the list. The link under the list does the same
 * on demand; it is a real link to the next page, so it also works without
 * JavaScript and search engines can follow it.
 *
 * `apiQuery` is the query sent to /store/products and `pageQuery` the page's own
 * query string, both without a page number.
 */
export function ListingProducts({ apiQuery, pageQuery, first, priorityCount }: { apiQuery: string; pageQuery: string; first: Page; priorityCount: number }) {
  const { t } = useI18n();
  const report = useListingProgress();
  const firstPage = first.meta.page;

  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = useInfiniteQuery({
    queryKey: ["store-products", apiQuery, firstPage],
    queryFn: ({ pageParam }) => api.page<ProductCard[]>(`/store/products?${apiQuery}&page=${pageParam}`),
    initialPageParam: firstPage,
    initialData: { pages: [first], pageParams: [firstPage] },
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    // Coming back from a product must not refetch every page already on screen.
    staleTime: 5 * 60_000,
  });
  // Asked for twice in a row (the list end is seen again before the first answer is in), the page is still fetched once.
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);

  // A product that moved between pages while the shopper scrolled (a new arrival pushes the rest down) is shown once.
  const pages = useMemo(() => {
    const seen = new Set<string>();
    return data.pages.map((page) => ({ number: page.meta.page, products: page.data.filter((p) => !seen.has(p.id) && seen.add(p.id)) }));
  }, [data.pages]);
  const shown = pages.reduce((count, page) => count + page.products.length, 0);
  const total = data.pages[data.pages.length - 1]!.meta.total;
  const nextPage = hasNextPage ? data.pages[data.pages.length - 1]!.meta.page + 1 : null;

  // The count in the toolbar ("Showing 1–48 of 120") follows the list.
  useEffect(() => report(shown), [report, shown]);

  // Load the next page when the end of the list comes near. After a failure the shopper decides when to try again.
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const marker = end.current;
    if (!marker || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: LOAD_AHEAD });
    observer.observe(marker);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, loadMore]);

  const href = (page: number | null) => `?${[pageQuery, page && page > 1 ? `page=${page}` : ""].filter(Boolean).join("&")}`;

  return (
    <>
      {/* Opened in the middle of the list (an old link, or a search engine's): the earlier products are one click away. */}
      {firstPage > 1 && (
        <p className="mb-8">
          <Link href={href(null)} className="link text-sm">
            {t("Show products from the start")}
          </Link>
        </p>
      )}

      <div className="space-y-10">
        {pages.map((page, i) => page.products.length > 0 && <ProductGrid key={page.number} products={page.products} priorityCount={i === 0 ? priorityCount : 0} columns={3} />)}
      </div>

      {isFetchingNextPage && (
        <div className="mt-10">
          <ProductGridSkeleton count={Math.max(1, Math.min(PLACEHOLDERS, total - shown))} columns={3} />
        </div>
      )}
      <div ref={end} aria-hidden="true" />

      <div className="mt-12 flex min-h-11 flex-col items-center justify-center gap-3 text-center text-sm" aria-live="polite">
        {nextPage ? (
          isFetchNextPageError ? (
            <>
              <p className="text-ink/60">{t("Could not load more products.")}</p>
              <button type="button" onClick={loadMore} className="rounded-full border border-black/15 bg-white px-5 py-2.5 font-semibold transition hover:border-ink">
                {t("Try again")}
              </button>
            </>
          ) : isFetchingNextPage ? (
            <p className="flex items-center gap-2 text-ink/55">
              <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> {t("Loading more products")}…
            </p>
          ) : (
            <a
              href={href(nextPage)}
              rel="next"
              onClick={(e) => {
                e.preventDefault();
                loadMore();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-5 py-2.5 font-semibold transition hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              {t("Load more products")} <ArrowDown size={15} aria-hidden="true" />
            </a>
          )
        ) : (
          // Only worth saying when the list was long enough to load in parts.
          pages.length > 1 && <p className="text-ink/50">{t("You have seen all {count} products.", { count: total })}</p>
        )}
      </div>
    </>
  );
}
