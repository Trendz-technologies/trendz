import Link from "next/link";
import { clsx } from "clsx";
import { ArrowUpRight } from "lucide-react";
import { Doodle } from "./doodle";
import { ActiveFilters, FilterSidebar, ListingCount, ListingEmpty, ListingProvider, ListingResults, MobileFilters, SortSelect, type Facets } from "./filters";
import { ListingProducts } from "./listing-products";
import { Reveal, Stagger, StaggerItem } from "./motion";
import { ProductImage } from "./product-card";
import { Breadcrumbs, type Crumb } from "./shop-breadcrumbs";
import { MaskedHeading } from "./shop-heading";
import { getI18n } from "@/lib/i18n/server";
import { serverGet, serverPage } from "@/lib/server-api";
import type { ImageView, ProductCard } from "@/lib/types";
import { RichText } from "@/components/ui/rich-text";

export type SearchParams = Record<string, string | string[] | undefined>;

const PASS_THROUGH = ["q", "brand", "minPrice", "maxPrice", "inStock", "sort", "page", "featured"];

/** Builds the API query from page search params (only known keys are forwarded). */
function apiQuery(sp: SearchParams, category?: string) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (!value) continue;
    if (PASS_THROUGH.includes(k) || k.startsWith("opt.")) q.set(k, value);
  }
  if (category) q.set("category", category);
  q.set("limit", "24");
  return q;
}

/** The page's own query string (plain string params), used for filter state and the links to further pages. */
function pageParams(sp: SearchParams) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) p.set(k, v);
  return p;
}

export async function Listing({
  searchParams,
  category,
  title,
  eyebrow,
  description,
  breadcrumb,
  subcategories,
  picture,
}: {
  searchParams: SearchParams;
  category?: string;
  title: string;
  eyebrow?: string;
  description?: string;
  breadcrumb?: Crumb[];
  subcategories?: { id: string; name: string; slug: string }[];
  /** Category pages pass their picture (null when there is none): the header is then a framed banner like the home page's. */
  picture?: ImageView | string | null;
}) {
  const { t, tn, tx } = await getI18n();
  const query = apiQuery(searchParams, category);
  const facetQuery = new URLSearchParams(query);
  facetQuery.delete("page");
  facetQuery.delete("sort");
  facetQuery.delete("limit");

  const [{ data: products, meta }, facets] = await Promise.all([
    serverPage<ProductCard[]>(`/store/products?${query.toString()}`, 30),
    serverGet<Facets>(`/store/products/facets?${facetQuery.toString()}`, 60).catch(() => ({ brands: [], price: { min: 0, max: 0 }, options: [] })),
  ]);

  const current = pageParams(searchParams);
  // The list loads further pages itself, so it gets both queries without a page number.
  const listQuery = new URLSearchParams(query);
  listQuery.delete("page");
  const pageQuery = new URLSearchParams(current);
  pageQuery.delete("page");
  const from = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = Math.min(meta.page * meta.limit, meta.total);

  // Links to the sub-categories, in a row that scrolls sideways on phones (`className` sets how far it reaches to the sides there).
  const subcategoryLinks = (className: string) =>
    subcategories &&
    subcategories.length > 0 && (
      <Stagger className={clsx("no-scrollbar flex gap-2 overflow-x-auto py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0", className)} gap={0.04} amount={0}>
        <StaggerItem className="shrink-0">
          <span aria-current="page" className="ribbon inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold text-pearl">
            {t("All {title}", { title })}
          </span>
        </StaggerItem>
        {subcategories.map((child) => (
          <StaggerItem key={child.id} className="shrink-0">
            <Link
              href={`/category/${child.slug}`}
              className="group inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white pl-5 pr-3 text-sm font-medium transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
            >
              {tx(child.name)}
              <ArrowUpRight size={14} className="transition-transform duration-500 group-hover:rotate-45" />
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    );

  return (
    <ListingProvider query={current.toString()}>
      {picture !== undefined ? (
        /* Category banner: one framed panel with the category's words and its picture (above the words on phones). */
        <header className="container-x pb-8 pt-6 md:pb-10 md:pt-8">
          {breadcrumb && <Breadcrumbs items={breadcrumb} />}
          <div className={clsx("gold-frame grid overflow-hidden rounded-[2rem] bg-white lg:rounded-[2.5rem]", breadcrumb && "mt-5 md:mt-6", picture && "md:min-h-[20rem] md:grid-cols-2 lg:min-h-[24rem]")}>
            <div className="relative isolate flex min-w-0 flex-col justify-center gap-4 p-6 sm:p-10 md:p-8 lg:p-14">
              <Doodle art="hanger" className="absolute -bottom-8 -right-6 -z-10 w-44 rotate-12 text-gold/35 sm:w-56 lg:-bottom-12 lg:w-72" />
              <p className="eyebrow animate-rise">{eyebrow ?? t("The collection")}</p>
              <MaskedHeading className="text-[clamp(2.25rem,4.6vw,4rem)] leading-[1.1] [overflow-wrap:anywhere] ta:text-[clamp(1.75rem,3.4vw,3rem)]" delay={0.05}>
                {title}
              </MaskedHeading>
              {description && <RichText html={description} className="max-w-md animate-rise text-sm leading-relaxed text-ink/65 [animation-delay:200ms] md:text-base" />}
              <p className="w-fit animate-rise rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-semibold tabular-nums text-ink/65 [animation-delay:300ms]">
                {meta.total ? tn(meta.total, "{n} product", "{n} products") : t("No products")}
              </p>
              {subcategoryLinks("-mx-6 mt-2 px-6")}
            </div>
            {picture && (
              <div className="relative order-first aspect-[3/2] overflow-hidden bg-offwhite md:order-none md:aspect-auto">
                {typeof picture === "string" ? (
                  <img src={picture} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-top" />
                ) : (
                  <ProductImage image={picture} alt="" priority sizes="(min-width: 768px) 50vw, 100vw" className="absolute inset-0 h-full w-full object-cover object-top" />
                )}
              </div>
            )}
          </div>
        </header>
      ) : (
        /* Editorial header */
        <header className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-32 h-96 w-96 rounded-full bg-sand/60 blur-3xl" />
          <div className="container-x relative pb-8 pt-8 md:pb-12 md:pt-12">
            {breadcrumb && <Breadcrumbs items={breadcrumb} />}
            <div className={clsx("flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12", breadcrumb && "mt-8 md:mt-12")}>
              <div className="min-w-0 max-w-4xl">
                <Reveal y={10}>
                  <p className="eyebrow">{eyebrow ?? t("The collection")}</p>
                </Reveal>
                <MaskedHeading className="mt-3 text-[clamp(2.75rem,8vw,6.5rem)] font-bold leading-[0.9] tracking-tighter [overflow-wrap:anywhere] ta:text-[clamp(2.25rem,6vw,4.75rem)]" delay={0.05}>
                  {title}
                  <sup aria-hidden="true" className="ml-2 align-super text-[0.24em] font-semibold tracking-normal text-ink/35 tabular-nums">
                    ({meta.total})
                  </sup>
                </MaskedHeading>
              </div>
              {description && (
                <Reveal delay={0.25} y={14} className="max-w-sm lg:pb-2">
                  <RichText html={description} className="text-sm leading-relaxed text-ink/60 md:text-base" />
                </Reveal>
              )}
            </div>
            {subcategoryLinks("-mx-4 mt-8 px-4")}
          </div>
        </header>
      )}

      <div className="container-x">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-y border-black/[0.07] py-3">
          <div className="flex min-w-0 items-center gap-3">
            <MobileFilters facets={facets} total={meta.total} />
            <ListingCount from={from} to={to} total={meta.total} />
          </div>
          <SortSelect />
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-14">
          <aside aria-label={t("Product filters")} className="hidden lg:block">
            <div className="no-scrollbar sticky top-28 -mx-1 max-h-[calc(100svh-8rem)] overflow-y-auto px-1 pb-10">
              <FilterSidebar facets={facets} />
            </div>
          </aside>

          <div className="min-w-0">
            <ActiveFilters facets={facets} />
            <ListingResults>
              {/* Keyed by the query: each new result set fades in (CSS) and gets fresh scroll reveals. */}
              <div key={current.toString()} className="animate-fade">
                {/* The first row loads at once where it opens the page; under a category banner it is below the fold, so it waits like the rest. */}
                {products.length ? (
                  <ListingProducts apiQuery={listQuery.toString()} pageQuery={pageQuery.toString()} first={{ data: products, meta }} priorityCount={picture !== undefined ? 0 : 3} />
                ) : (
                  <ListingEmpty />
                )}
              </div>
            </ListingResults>
          </div>
        </div>
      </div>
    </ListingProvider>
  );
}
