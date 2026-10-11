import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Reveal } from "@/components/store/motion";
import { PdpAccordion, type AccordionSection } from "@/components/store/pdp-accordion";
import { ProductPurchase } from "@/components/store/product-purchase";
import { ProductRail } from "@/components/store/product-rail";
import { Breadcrumbs } from "@/components/store/shop-breadcrumbs";
import { msg } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { NotFoundError, serverGet, SITE_URL } from "@/lib/server-api";
import type { ProductDetail } from "@/lib/types";
import { RichText } from "@/components/ui/rich-text";
import { plainText } from "@/lib/rich-text";
import { ProductReviewsSection } from "@/components/store/reviews";
import type { ProductReviews } from "@/lib/reviews";

async function load(slug: string) {
  try {
    return await serverGet<ProductDetail>(`/store/products/${encodeURIComponent(slug)}`, 30);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  const image = p.images[0]?.large ?? p.images[0]?.url ?? undefined;
  return {
    title: p.seo.title,
    description: p.seo.description ?? undefined,
    keywords: p.seo.keywords ?? undefined,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { type: "website", title: p.seo.title, description: p.seo.description ?? undefined, url: `/products/${p.slug}`, images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title: p.seo.title, images: image ? [image] : undefined },
  };
}

const PROMISES = [
  { icon: Truck, title: msg("Tracked delivery"), body: msg("Shipping is calculated at checkout.") },
  { icon: RotateCcw, title: msg("Easy returns"), body: msg("Request a return from your account in a few taps.") },
  { icon: ShieldCheck, title: msg("Secure checkout"), body: msg("Pay with UPI, cards or netbanking through Razorpay.") },
];

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  const { t, tx } = await getI18n();
  // The first reviews are part of the page's HTML and structured data. Reviews failing to load must not take the page down.
  const reviews = await serverGet<ProductReviews>(`/store/products/${encodeURIComponent(p.slug)}/reviews?limit=5`, 60).catch(() => null);
  const rating = reviews?.enabled && reviews.summary.count > 0 ? reviews.summary : null;
  const inStock = p.variants.some((v) => v.inStock);
  const prices = p.variants.map((v) => v.sellingPrice);

  // schema.org Product structured data for rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.baseSku,
    description: plainText(p.shortDescription) || undefined,
    image: p.images.map((i) => i.large ?? i.url).filter(Boolean),
    brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    aggregateRating: rating ? { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count } : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: (Math.min(...prices) / 100).toFixed(2),
      highPrice: (Math.max(...prices) / 100).toFixed(2),
      offerCount: p.variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/products/${p.slug}`,
    },
  };

  const info: { label: string; value: string }[] = [{ label: t("Style code"), value: p.baseSku }];
  if (p.productType) info.push({ label: t("Type"), value: p.productType });
  if (p.brand) info.push({ label: t("Brand"), value: p.brand.name });
  if (p.hsnCode) info.push({ label: "HSN", value: p.hsnCode });

  const sections: AccordionSection[] = [];
  if (p.description) {
    sections.push({
      id: "details",
      title: t("Details"),
      content: (
        // Descriptions are authored by staff in the admin panel.
        <RichText html={p.description} className="max-w-2xl text-[15px] leading-relaxed text-ink/70" />
      ),
    });
  }
  sections.push(
    {
      id: "delivery",
      title: t("Delivery & returns"),
      content: (
        <ul className="grid gap-3 sm:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl bg-white p-5 shadow-neu">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-offwhite">
                <Icon size={17} strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-sm font-semibold">{t(title)}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">{t(body)}</p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "info",
      title: t("Product info"),
      content: (
        <dl className="max-w-xl divide-y divide-black/5 rounded-2xl bg-white px-5 shadow-neu">
          {info.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4 py-3.5 text-sm">
              <dt className="text-ink/50">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      ),
    },
  );

  return (
    <div className="container-x pt-6 md:pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs className="mb-6 md:mb-8" items={[{ name: t("Home"), href: "/" }, ...p.breadcrumb.map((b) => ({ name: tx(b.name), href: `/category/${b.slug}` })), { name: p.name }]} />

      <ProductPurchase product={p} rating={rating} />

      <section className="mt-20 grid gap-8 md:mt-28 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow">{t("Know your piece")}</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tighter md:text-5xl">{t("The details")}</h2>
          {p.tags.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label={t("Tags")}>
              {p.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-ink/60">
                  #{tag}
                </li>
              ))}
            </ul>
          )}
        </Reveal>
        <Reveal delay={0.1} className="min-w-0 lg:col-span-8">
          <PdpAccordion sections={sections} defaultOpen={[sections[0]!.id]} />
        </Reveal>
      </section>

      {reviews && <ProductReviewsSection slug={p.slug} productName={p.name} initial={reviews} />}

      {p.related.length > 0 && (
        <section className="mt-24 md:mt-32">
          <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{t("Complete the look")}</p>
              <h2 className="mt-2 text-4xl font-bold tracking-tighter md:text-5xl">{t("You may also like")}</h2>
            </div>
            <Link href={`/category/${p.category.slug}`} className="link-draw text-sm font-semibold">
              {t("More {category}", { category: tx(p.category.name) })}
            </Link>
          </Reveal>
          <ProductRail products={p.related} label={t("You may also like")} />
        </section>
      )}
    </div>
  );
}
