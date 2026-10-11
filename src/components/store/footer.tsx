import Link from "next/link";
import { ArrowUp, AtSign, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { displayPhone, instagramHref, lines, localize, phoneHref, whatsappHref } from "@/lib/cms";
import { getI18n } from "@/lib/i18n/server";
import type { CategoryNode, ContactDetails, StoreConfig } from "@/lib/types";
import { BrandLogo } from "./brand-logo";
import { Doodle } from "./doodle";
import { Reveal, Stagger, StaggerItem } from "./motion";

/** `contact`, `pages`, `about` (whether the About us page is switched on) and `logo` (the uploaded logo, if any) come from Admin → CMS; a detail left empty there is left out here. */
export async function Footer({
  categories,
  contact,
  pages,
  about,
  logo,
  onlinePayments,
}: {
  categories: CategoryNode[];
  contact: ContactDetails;
  pages: StoreConfig["pages"];
  about: boolean;
  logo: string | null;
  onlinePayments: boolean;
}) {
  const { t, tx, locale } = await getI18n();
  const say = localize(locale);
  const address = lines(say(contact.address));
  const columns = [
    {
      title: t("Shop"),
      links: [{ label: t("Shop all"), href: "/products" }, ...categories.map((c) => ({ label: tx(c.name), href: `/category/${c.slug}` })), { label: t("Offers"), href: "/offers" }],
    },
    {
      title: t("Help"),
      links: [
        { label: t("Track an order"), href: "/account/orders" },
        { label: t("Returns & refunds"), href: "/account/returns" },
        { label: t("My account"), href: "/account" },
        { label: t("Wishlist"), href: "/account/wishlist" },
        ...(about ? [{ label: t("About us"), href: "/about" }] : []),
        { label: t("Contact us"), href: "/contact" },
      ],
    },
  ];

  return (
    <footer className="on-dark relative mt-32 overflow-hidden border-t border-gold/30 bg-night text-white">
      {/* Stage-light glows. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-accent/20 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-gold/10 blur-[110px]" />
      {/* Doodles behind the links. */}
      <Doodle art="dress" className="absolute -right-8 top-6 w-56 rotate-6 text-gold/20 sm:w-72 lg:right-[4%] lg:w-80" />
      <Doodle art="vine" className="absolute -left-10 bottom-24 w-56 text-gold/20 sm:w-72 lg:w-80" />

      <div className="container-x relative grid gap-12 pb-12 pt-16 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr]">
        <div>
          {/* Not inside the reveal animation: an animated wrapper cuts the logo off from the footer behind it, and a logo drawn on black then shows as a black box over the glow. */}
          <BrandLogo src={logo} lazy className="-ml-3 max-h-44 w-56 object-left" />
          <Reveal>
            <p className="mt-1 font-script text-3xl text-accent-bright ta:mt-3 ta:text-xl">{t(BRAND.promise)}</p>
            <a href="#main" className="group mt-7 inline-flex items-center gap-3 text-sm font-semibold text-gold-bright hover:text-white">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-gold/40 transition-transform duration-500 group-hover:-translate-y-1 group-hover:border-gold-bright">
                <ArrowUp size={16} />
              </span>
              {t("Back to top")}
            </a>
          </Reveal>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="eyebrow">{col.title}</p>
            <Stagger className="mt-5 space-y-3 text-sm" gap={0.04}>
              {col.links.map((l) => (
                <StaggerItem key={l.href}>
                  <Link href={l.href} className="link-draw text-white/70 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        ))}

        <div>
          <p className="eyebrow">{t("Visit & contact")}</p>
          <ul className="mt-5 space-y-4 text-sm text-white/75">
            {address.length > 0 && (
              <li className="flex gap-3">
                <MapPin size={17} className="mt-0.5 shrink-0 text-accent" />
                <address className="not-italic leading-relaxed">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </li>
            )}
            {contact.whatsapp && (
              <li>
                <a href={whatsappHref(contact.whatsapp)} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 hover:text-white">
                  <MessageCircle size={17} className="shrink-0 text-accent" />
                  <span className="link-draw">WhatsApp {displayPhone(contact.whatsapp)}</span>
                </a>
              </li>
            )}
            {contact.phone && (
              <li>
                <a href={phoneHref(contact.phone)} className="group flex items-center gap-3 hover:text-white">
                  <Phone size={17} className="shrink-0 text-accent" />
                  <span className="link-draw">{t("Call {phone}", { phone: displayPhone(contact.phone) })}</span>
                </a>
              </li>
            )}
            {contact.email && (
              <li>
                <a href={`mailto:${contact.email}`} className="group flex items-center gap-3 hover:text-white">
                  <Mail size={17} className="shrink-0 text-accent" />
                  <span className="link-draw break-all">{contact.email}</span>
                </a>
              </li>
            )}
            {contact.instagram && (
              <li>
                <a href={instagramHref(contact.instagram)} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 hover:text-white">
                  <AtSign size={17} className="shrink-0 text-accent" />
                  <span className="link-draw">{contact.instagram}</span>
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Oversized gold wordmark that rises in as the footer appears. */}
      <div aria-hidden="true" className="container-x relative select-none overflow-hidden">
        <Reveal y={120} amount={0.1}>
          <p lang="en" className="text-gold-shine -mb-[0.16em] text-center font-display text-[clamp(4.5rem,21vw,20rem)] font-bold leading-none tracking-wide opacity-25">TRENDZ</p>
        </Reveal>
      </div>

      <div className="relative border-t border-gold/20">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-white/50 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-x-8">
          <p>
            © {new Date().getFullYear()} {BRAND.fullName}. {t("All prices in INR.")}
          </p>
          {pages.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link href={`/${page.slug}`} className="link-draw transition-colors hover:text-white">
                    {say(page.title)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {onlinePayments && <p>{t("Secure payments by Razorpay")}</p>}
        </div>
      </div>
    </footer>
  );
}
