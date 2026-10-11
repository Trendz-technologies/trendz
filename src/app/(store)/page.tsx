import Link from "next/link";
import { clsx } from "clsx";
import { ArrowUpRight, RotateCcw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { BrandLogo } from "@/components/store/brand-logo";
import { HomeOffers, offersHiddenReason } from "@/components/store/home-offers";
import { Magnetic, Parallax, Reveal, SplitWords, Stagger, StaggerItem } from "@/components/store/motion";
import { ProductGrid, ProductImage } from "@/components/store/product-card";
import { ProductRail } from "@/components/store/product-rail";
import { contactDetails, homeContent, localize, shopLogo, whatsappHref } from "@/lib/cms";
import { getI18n } from "@/lib/i18n/server";
import { serverGet, serverPage } from "@/lib/server-api";
import { money } from "@/lib/format";
import type { CategoryNode, ImageView, ProductCard, StoreConfig } from "@/lib/types";

export const revalidate = 60;

/*
 * The banner picture is a link that fills its half of the panel (the top of it
 * on phones); the photo is kept to the top so a model's face is not cropped
 * away. No entrance animation on the link: an animated layer under the panel's
 * rounded corners leaves a stray box at the corner in Chrome.
 */
const HERO_PICTURE_LINK = "group relative order-first aspect-[4/3] overflow-hidden bg-offwhite md:order-none md:aspect-auto";
const HERO_PICTURE = "absolute inset-0 h-full w-full object-cover object-top transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105";

/** Small heading, heading and link above a product section. Each is left out when its text is empty. */
function SectionHeader({ eyebrow, title, link, href, className }: { eyebrow: string; title: string; link: string; href: string; className?: string }) {
  if (!eyebrow && !title && !link) return null;
  return (
    <Reveal className={clsx("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && <h2 className="mt-2 text-4xl md:text-5xl">{title}</h2>}
      </div>
      {link && (
        <Link href={href} className="link-draw text-sm font-semibold text-gold-bright">
          {link}
        </Link>
      )}
    </Reveal>
  );
}

export default async function HomePage() {
  const [featured, latest, categories, config, { t, tx, locale }] = await Promise.all([
    serverPage<ProductCard[]>("/store/products?featured=true&limit=10").catch(() => ({ data: [] as ProductCard[] })),
    serverPage<ProductCard[]>("/store/products?sort=newest&limit=8").catch(() => ({ data: [] as ProductCard[] })),
    serverGet<CategoryNode[]>("/store/categories", 120).catch(() => [] as CategoryNode[]),
    serverGet<StoreConfig>("/store/config", 60).catch(() => null),
    getI18n(),
  ]);
  const all = [...featured.data, ...latest.data];
  // The banner shows a product only when it has a photo.
  const hero = all.find((p) => p.image);
  const editorial = all.find((p) => p.id !== hero?.id && p.image);
  const freeShipping = config?.shipping.freeShippingThreshold;
  // Written in Admin → Home page offers; gone once switched off or past its end date.
  const offers = config?.homeOffers && !offersHiddenReason(config.homeOffers) ? config.homeOffers : null;
  // The other sections are written in Admin → CMS → Home page; text left empty there is left out here.
  const home = homeContent(config);
  const banner = home.hero;
  const hasPicture = Boolean(banner.imageUrl || hero);
  const say = localize(locale);
  const whatsapp = contactDetails(config).whatsapp;
  const highlights = [
    { icon: Sparkles, value: say(banner.highlightValue), label: say(banner.highlightLabel) },
    { icon: Truck, value: freeShipping ? money(freeShipping) : t("Tracked"), label: freeShipping ? t("Free shipping above") : t("Delivery") },
    { icon: RotateCcw, value: t("{days} days", { days: config?.returns.windowDays ?? 7 }), label: t("Easy returns") },
  ].filter((h) => h.value || h.label);
  const editorialPoints = home.editorial.points.map(say).filter(Boolean);

  // A representative product photo for each top-level category (category images win when set).
  const imageFor = (cat: CategoryNode): ImageView | string | null => {
    if (cat.imageUrl) return cat.imageUrl;
    const slugs = new Set([cat.slug, ...cat.children.map((c) => c.slug)]);
    // Prefer a photo that is not already the hero image.
    const inCat = all.filter((p) => slugs.has(p.category.slug) && p.image);
    return (inCat.find((p) => p.id !== hero?.id) ?? inCat[0])?.image ?? null;
  };

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="container-x pt-4 sm:pt-6">
        {/* One framed panel: the words on one side, one picture on the other (above the words on phones). */}
        <div className={clsx("gold-frame grid overflow-hidden rounded-[2rem] bg-white lg:rounded-[2.5rem]", hasPicture && "md:min-h-[30rem] md:grid-cols-2 lg:min-h-[36rem]")}>
          <div className="flex flex-col justify-center gap-5 p-6 sm:p-10 md:p-8 lg:gap-6 lg:p-14 xl:p-16">
            {say(banner.tagline) && <p className="animate-rise font-script text-3xl leading-tight text-accent lg:text-4xl ta:text-xl ta:lg:text-2xl">{say(banner.tagline)}</p>}
            <h1 className="text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.15] ta:text-[clamp(1.75rem,3.4vw,3rem)]">
              {say(banner.titleTop) && <SplitWords text={say(banner.titleTop)} className="block" delay={0.1} wordClassName="text-gold-shine" />}
              {say(banner.titleBottom) && <SplitWords text={say(banner.titleBottom)} className="block" delay={0.25} wordClassName="text-accent" />}
            </h1>
            {say(banner.body) && <p className="max-w-md animate-rise text-base leading-relaxed text-ink/65 [animation-delay:400ms]">{say(banner.body)}</p>}
            <div className="flex animate-rise flex-wrap items-center gap-x-6 gap-y-4 [animation-delay:500ms]">
              {say(banner.primaryLabel) && banner.primaryHref && (
                <Magnetic>
                  <Link href={banner.primaryHref} className="group flex items-center gap-6 rounded-full bg-ink py-2 pl-7 pr-2 text-sm font-semibold text-white">
                    {say(banner.primaryLabel)}
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:rotate-45">
                      <ArrowUpRight size={17} />
                    </span>
                  </Link>
                </Magnetic>
              )}
              {say(banner.secondaryLabel) && banner.secondaryHref && (
                <Link href={banner.secondaryHref} className="link-draw text-sm font-semibold text-gold-bright">
                  {say(banner.secondaryLabel)}
                </Link>
              )}
            </div>
            {highlights.length > 0 && (
              <dl className="mt-1 flex animate-rise flex-wrap gap-x-8 gap-y-4 border-t border-black/10 pt-6 [animation-delay:600ms] md:gap-x-6 lg:gap-x-8">
                {highlights.map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <Icon size={18} className="shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
                    <div className="flex flex-col-reverse leading-tight">
                      <dt className="text-xs text-ink/55">{label}</dt>
                      <dd className="text-sm font-bold">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* The shop's own picture, or else the first featured product with its name and price. */}
          {banner.imageUrl ? (
            <Link href={banner.primaryHref || "/products"} aria-label={say(banner.primaryLabel) || t("Shop all")} className={HERO_PICTURE_LINK}>
              <img src={banner.imageUrl} alt="" fetchPriority="high" className={HERO_PICTURE} />
            </Link>
          ) : (
            hero && (
              <Link href={`/products/${hero.slug}`} className={HERO_PICTURE_LINK}>
                <ProductImage image={hero.image} alt={hero.name} priority sizes="(min-width: 768px) 50vw, 100vw" className={HERO_PICTURE} />
                <p className="absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-full bg-white/90 py-2 pl-4 pr-2 text-sm backdrop-blur-md lg:bottom-6 lg:left-6">
                  <span className="truncate font-semibold">{hero.name}</span>
                  <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">{money(hero.sellingPrice)}</span>
                </p>
              </Link>
            )
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ Offers */}
      {offers && (
        <section className="container-x mt-12 md:mt-16">
          <Reveal>
            <HomeOffers offers={offers} locale={locale} />
          </Reveal>
        </section>
      )}

      {/* -------------------------------------------------------- Categories */}
      {home.categories.enabled && categories.length > 0 && (
        <section className="container-x mt-28">
          <SectionHeader className="mb-10" eyebrow={say(home.categories.eyebrow)} title={say(home.categories.title)} link={say(home.categories.linkLabel)} href="/products" />
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" gap={0.1}>
            {categories.map((c) => {
              const img = imageFor(c);
              return (
                <StaggerItem key={c.id}>
                  <Link href={`/category/${c.slug}`} className="on-dark gold-frame group relative block h-full min-h-80 overflow-hidden rounded-[2rem] bg-sand lg:min-h-[28rem]">
                    {img &&
                      (typeof img === "string" ? (
                        <img src={img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110" />
                      ) : (
                        <ProductImage image={img} alt="" sizes="(min-width: 1024px) 33vw, 100vw" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110" />
                      ))}
                    <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/15 to-transparent" />
                    <div className="absolute inset-x-6 bottom-6 flex items-end justify-between text-white">
                      <div>
                        <p className="font-serif text-3xl font-bold text-gold-bright md:text-4xl">{tx(c.name)}</p>
                        <p className="mt-1 max-h-0 overflow-hidden text-xs text-white/80 opacity-0 transition-all duration-500 group-hover:max-h-10 group-hover:opacity-100">
                          {c.children.map((x) => tx(x.name)).join(" · ")}
                        </p>
                      </div>
                      <span className="ribbon grid h-12 w-12 shrink-0 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-45">
                        <ArrowUpRight size={18} />
                      </span>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>
      )}

      {/* ----------------------------------------------------- Popular picks */}
      {home.popular.enabled && featured.data.length > 0 && (
        <section className="container-x mt-28">
          <SectionHeader className="mb-8" eyebrow={say(home.popular.eyebrow)} title={say(home.popular.title)} link={say(home.popular.linkLabel)} href="/products?featured=true" />
          <ProductRail products={featured.data} label={say(home.popular.title) || t("Popular picks")} />
        </section>
      )}

      {/* --------------------------------------------------------- Editorial */}
      {home.editorial.enabled && editorial && (
        <section className="container-x mt-28">
          <div className="gold-frame grid items-center gap-10 overflow-hidden rounded-[2.5rem] bg-white p-6 md:p-10 lg:grid-cols-2 lg:gap-16 lg:p-14">
            <Parallax offset={40} className="aspect-[4/5] rounded-[2rem] bg-offwhite lg:aspect-square">
              <ProductImage image={editorial.image} alt={editorial.name} sizes="(min-width: 1024px) 45vw, 100vw" className="h-full w-full object-cover" />
            </Parallax>
            <div>
              <Reveal>
                {say(home.editorial.eyebrow) && <p className="eyebrow">{say(home.editorial.eyebrow)}</p>}
                {(say(home.editorial.title) || say(home.editorial.titleAccent)) && (
                  <h2 className="mt-3 text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.02]">
                    {say(home.editorial.title)}
                    {say(home.editorial.title) && say(home.editorial.titleAccent) && <br />}
                    <span className="text-accent">{say(home.editorial.titleAccent)}</span>
                  </h2>
                )}
              </Reveal>
              {say(home.editorial.body) && (
                <Reveal delay={0.1}>
                  <p className="mt-6 max-w-md text-base leading-relaxed text-ink/65">{say(home.editorial.body)}</p>
                </Reveal>
              )}
              {editorialPoints.length > 0 && (
                <Stagger className="mt-8 grid gap-3 sm:grid-cols-3" gap={0.08}>
                  {editorialPoints.map((point, i) => (
                    <StaggerItem key={i} className="rounded-2xl border border-gold/25 bg-offwhite px-4 py-3 text-sm font-semibold text-gold-bright">
                      {point}
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
              <Reveal delay={0.2}>
                <Link href={`/products/${editorial.slug}`} className="group mt-10 inline-flex items-center gap-3 text-sm font-semibold">
                  <span className="ribbon grid h-12 w-12 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-45">
                    <ArrowUpRight size={17} />
                  </span>
                  {t("Shop {name}", { name: editorial.name })}
                </Link>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- Promises */}
      {home.promises.enabled && (
        <section className="container-x mt-28">
          <Stagger className="grid gap-4 md:grid-cols-3" gap={0.1}>
            {[
              // The first two headings state the store's rules, so they follow Settings rather than the CMS.
              { icon: Truck, title: freeShipping ? t("Free shipping above {amount}", { amount: money(freeShipping) }) : t("Tracked delivery"), body: say(home.promises.shippingBody) },
              { icon: RotateCcw, title: t("{days}-day returns", { days: config?.returns.windowDays ?? 7 }), body: say(home.promises.returnsBody) },
              { icon: ShieldCheck, title: say(home.promises.paymentTitle), body: say(home.promises.paymentBody) },
            ]
              .filter(({ title, body }) => title || body)
              .map(({ icon: Icon, title, body }, i) => (
                <StaggerItem key={i} className="group card flex gap-4 p-7 transition duration-500 hover:-translate-y-1 hover:shadow-neu-lg">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-offwhite text-gold-bright transition-colors duration-500 group-hover:border-accent group-hover:text-accent">
                    <Icon size={19} strokeWidth={1.75} />
                  </span>
                  <div>
                    {title && <p className="font-semibold">{title}</p>}
                    {body && <p className="mt-1 text-sm leading-relaxed text-ink/55">{body}</p>}
                  </div>
                </StaggerItem>
              ))}
          </Stagger>
        </section>
      )}

      {/* ------------------------------------------------------ New arrivals */}
      {home.newArrivals.enabled && latest.data.length > 0 && (
        <section className="container-x mt-28">
          <SectionHeader className="mb-8" eyebrow={say(home.newArrivals.eyebrow)} title={say(home.newArrivals.title)} link={say(home.newArrivals.linkLabel)} href="/products?sort=newest" />
          <ProductGrid products={latest.data} />
        </section>
      )}

      {/* ---------------------------------------------------------- Closing */}
      {home.closing.enabled && (
        <section className="container-x mt-28">
          <Reveal>
            <div className="on-dark gold-frame relative overflow-hidden rounded-[2.5rem] bg-ink px-8 py-14 text-center text-white md:px-16 md:py-20">
              <div aria-hidden="true" className="absolute -left-24 -top-24 h-80 w-80 animate-float rounded-full bg-accent/35 blur-[90px]" />
              <div aria-hidden="true" className="absolute -bottom-28 -right-20 h-80 w-80 animate-float rounded-full bg-gold/20 blur-[90px] [animation-delay:-3s]" />
              <BrandLogo src={shopLogo(config)} lazy className="relative mx-auto max-h-72 w-full max-w-sm" />
              <p className="ornament relative mt-2">❖</p>
              {say(home.closing.title) && <h2 className="relative mx-auto mt-6 max-w-2xl text-[clamp(2rem,5vw,3.75rem)] leading-[1.05]">{say(home.closing.title)}</h2>}
              <div className="relative mt-9 flex flex-wrap justify-center gap-4">
                {say(home.closing.buttonLabel) && home.closing.buttonHref && (
                  <Magnetic>
                    <Link href={home.closing.buttonHref} className="group flex items-center gap-4 rounded-full bg-ink py-2 pl-7 pr-2 text-sm font-semibold text-white">
                      {say(home.closing.buttonLabel)}
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:rotate-45">
                        <ArrowUpRight size={17} />
                      </span>
                    </Link>
                  </Magnetic>
                )}
                {say(home.closing.whatsappLabel) && whatsapp && (
                  <a href={whatsappHref(whatsapp)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-gold/50 px-7 py-4 text-sm font-semibold text-gold-bright transition hover:border-gold-bright hover:bg-white/5">
                    {say(home.closing.whatsappLabel)}
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        </section>
      )}
    </>
  );
}
