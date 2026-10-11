import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Listing, type SearchParams } from "@/components/store/listing";
import type { Crumb } from "@/components/store/shop-breadcrumbs";
import { getI18n } from "@/lib/i18n/server";
import { NotFoundError, serverGet, serverPage } from "@/lib/server-api";
import { plainText } from "@/lib/rich-text";
import type { ProductCard } from "@/lib/types";

interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  children: { id: string; name: string; slug: string }[];
  breadcrumb: { id: string; name: string; slug: string }[];
}

async function load(slug: string) {
  try {
    return await serverGet<CategoryDetail>(`/store/categories/${encodeURIComponent(slug)}`, 120);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

/** A product photo for the banner of a category that has no picture of its own (set in Admin → Categories). */
const productPhoto = (slug: string) =>
  serverPage<ProductCard[]>(`/store/products?category=${encodeURIComponent(slug)}&limit=4`, 120)
    .then(({ data }) => data.find((p) => p.image)?.image ?? null)
    .catch(() => null);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [c, { tx }] = await Promise.all([load((await params).slug), getI18n()]);
  return {
    title: c.seoTitle ?? tx(c.name),
    description: c.seoDescription ?? (plainText(c.description) || `Shop ${c.name} at Trendz.`),
    keywords: c.seoKeywords ?? undefined,
    alternates: { canonical: `/category/${c.slug}` },
    openGraph: { title: c.seoTitle ?? c.name, url: `/category/${c.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [c, photo, { t, tx }] = await Promise.all([load(slug), productPhoto(slug), getI18n()]);

  // Home / …parents / this category (the last crumb is the current page).
  const trail: Crumb[] = [{ name: t("Home"), href: "/" }, ...c.breadcrumb.map((b) => ({ name: tx(b.name), href: `/category/${b.slug}` }))];
  if (c.breadcrumb.at(-1)?.slug !== c.slug) trail.push({ name: tx(c.name) });
  const parent = c.breadcrumb.filter((b) => b.slug !== c.slug).at(-1);

  return (
    <Listing
      searchParams={sp}
      category={c.slug}
      title={tx(c.name)}
      eyebrow={parent ? tx(parent.name) : t("Collection")}
      description={c.description ?? undefined}
      breadcrumb={trail}
      subcategories={c.children}
      picture={c.imageUrl ?? photo}
    />
  );
}
