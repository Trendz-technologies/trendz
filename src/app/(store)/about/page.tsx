import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowUpRight, MapPin, MessageCircle, Phone } from "lucide-react";
import { BrandLogo } from "@/components/store/brand-logo";
import { Doodle } from "@/components/store/doodle";
import { Breadcrumbs } from "@/components/store/shop-breadcrumbs";
import { MaskedHeading } from "@/components/store/shop-heading";
import { RichText } from "@/components/ui/rich-text";
import { contactDetails, displayPhone, lines, localize, phoneHref, shopLogo, whatsappHref } from "@/lib/cms";
import { getI18n } from "@/lib/i18n/server";
import { NotFoundError, serverGet, STORE_CONFIG_TAG } from "@/lib/server-api";
import type { CategoryNode, PublishedAbout, StoreConfig } from "@/lib/types";

// Cached with the store config's tag, so saving in the admin refreshes it at once.
const load = cache(async () => {
  try {
    return await serverGet<PublishedAbout>("/store/about", 300, [STORE_CONFIG_TAG]);
  } catch (err) {
    // Switched off in the admin: the page does not exist as far as the storefront is concerned.
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const [about, { t, locale }] = await Promise.all([load(), getI18n()]);
  const say = localize(locale);
  return { title: say(about.title) || t("About us"), description: say(about.intro) || undefined, alternates: { canonical: "/about" } };
}

/** The About us page: the shop's own story as written in Admin → CMS → About us, with its collections and where to find it beside the text. */
export default async function AboutPage() {
  const [about, config, categories, { t, tx, locale }] = await Promise.all([
    load(),
    serverGet<StoreConfig>("/store/config", 60).catch(() => null),
    serverGet<CategoryNode[]>("/store/categories", 120).catch(() => [] as CategoryNode[]),
    getI18n(),
  ]);
  const say = localize(locale);
  const title = say(about.title) || t("About us");
  const contact = contactDetails(config);
  const address = lines(say(contact.address));

  return (
    <div className="container-x pt-6 md:pt-8">
      <Breadcrumbs items={[{ name: t("Home"), href: "/" }, { name: title }]} />

      {/* Banner: the heading beside the shop's picture (above the heading on phones), or its logo while there is no picture. */}
      <header className="gold-frame mt-5 grid overflow-hidden rounded-[2rem] bg-white md:mt-6 md:min-h-[22rem] md:grid-cols-2 lg:min-h-[26rem] lg:rounded-[2.5rem]">
        <div className="relative isolate flex min-w-0 flex-col justify-center gap-4 p-6 sm:p-10 md:p-8 lg:p-14">
          <Doodle art="flower" className="absolute -bottom-10 -right-4 -z-10 w-44 rotate-12 text-gold/35 sm:w-56 lg:-bottom-14 lg:right-2 lg:w-72" />
          {say(about.eyebrow) && <p className="eyebrow animate-rise">{say(about.eyebrow)}</p>}
          <MaskedHeading className="text-[clamp(2.25rem,4.6vw,4rem)] leading-[1.1] [overflow-wrap:anywhere] ta:text-[clamp(1.75rem,3.4vw,3rem)]" delay={0.05}>
            {title}
          </MaskedHeading>
          {say(about.intro) && <p className="max-w-md animate-rise text-base leading-relaxed text-ink/65 [animation-delay:200ms]">{say(about.intro)}</p>}
        </div>
        {about.imageUrl ? (
          <div className="relative order-first aspect-[3/2] overflow-hidden bg-offwhite md:order-none md:aspect-auto">
            <img src={about.imageUrl} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-top" />
          </div>
        ) : (
          <div className="on-dark order-first grid place-items-center bg-night p-6 md:order-none md:p-10">
            <BrandLogo src={shopLogo(config)} className="max-h-72 w-full max-w-xs lg:max-w-sm" />
          </div>
        )}
      </header>

      <div className="mt-8 grid items-start gap-5 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        {say(about.body) && (
          <article className="card p-6 md:p-10">
            <RichText html={say(about.body)} className="text-[15px] leading-relaxed text-ink/75" />
          </article>
        )}

        <aside className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {categories.length > 0 && (
            <section className="card p-6">
              <p className="eyebrow">{t("Collections")}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/category/${c.slug}`}
                      className="inline-flex h-10 items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                    >
                      {tx(c.name)}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/products" className="link-draw mt-5 inline-block text-sm font-semibold text-gold-bright">
                {t("Browse everything")}
              </Link>
            </section>
          )}

          {/* Where the shop is and how to reach it, from Admin → CMS → Contact us. */}
          <section className="card p-6">
            <p className="eyebrow flex items-center gap-2.5">
              <MapPin size={15} className="text-accent" aria-hidden="true" /> {t("Visit the shop")}
            </p>
            {address.length > 0 && (
              <address className="mt-4 text-sm not-italic leading-relaxed text-ink/75">
                {address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            )}
            <ul className="mt-4 space-y-2.5 text-sm">
              {contact.whatsapp && (
                <li>
                  <a href={whatsappHref(contact.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                    <MessageCircle size={16} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="link-draw">WhatsApp {displayPhone(contact.whatsapp)}</span>
                  </a>
                </li>
              )}
              {contact.phone && (
                <li>
                  <a href={phoneHref(contact.phone)} className="flex items-center gap-3">
                    <Phone size={16} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="link-draw">{t("Call {phone}", { phone: displayPhone(contact.phone) })}</span>
                  </a>
                </li>
              )}
            </ul>
            <Link href="/contact" className="group mt-6 inline-flex items-center gap-3 text-sm font-semibold">
              <span className="ribbon grid h-10 w-10 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-45">
                <ArrowUpRight size={16} />
              </span>
              {t("Contact us")}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
