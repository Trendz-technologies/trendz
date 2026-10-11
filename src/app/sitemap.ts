import type { MetadataRoute } from "next";
import { serverGet, SITE_URL } from "@/lib/server-api";
import type { StoreConfig } from "@/lib/types";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [data, config] = await Promise.all([
    serverGet<{ products: { slug: string; updatedAt: string }[]; categories: { slug: string }[] }>("/store/sitemap", 3600).catch(() => ({ products: [], categories: [] })),
    serverGet<StoreConfig>("/store/config", 60).catch(() => null),
  ]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/offers`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.4 },
    ...(config?.aboutPublished ? [{ url: `${SITE_URL}/about`, changeFrequency: "monthly" as const, priority: 0.4 }] : []),
    // The legal pages that are published in Admin → CMS.
    ...(config?.pages ?? []).map((page) => ({ url: `${SITE_URL}/${page.slug}`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...data.categories.map((c) => ({ url: `${SITE_URL}/category/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...data.products.map((p) => ({ url: `${SITE_URL}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
