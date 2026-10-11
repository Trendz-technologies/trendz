import type { Metadata } from "next";
import { Listing, type SearchParams } from "@/components/store/listing";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const { t } = await getI18n();
  const q = typeof sp.q === "string" ? sp.q : null;
  return {
    title: q ? t("Search: {query}", { query: q }) : t("Shop all"),
    alternates: { canonical: "/products" },
    // Search result pages should not compete with category pages in search engines.
    robots: q ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { t } = await getI18n();
  const q = typeof sp.q === "string" ? sp.q : null;
  const eyebrow = q ? t("Search results") : sp.featured === "true" ? t("Most loved") : t("The collection");
  return (
    <Listing
      searchParams={sp}
      title={q ? t("Results for “{query}”", { query: q }) : t("Shop all")}
      eyebrow={eyebrow}
      breadcrumb={[{ name: t("Home"), href: "/" }, q ? { name: t("Shop all"), href: "/products" } : { name: t("Shop all") }, ...(q ? [{ name: t("Search") }] : [])]}
    />
  );
}
