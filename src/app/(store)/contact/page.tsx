import type { Metadata } from "next";
import { ArrowUpRight, AtSign, Clock, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/store/motion";
import { Breadcrumbs } from "@/components/store/shop-breadcrumbs";
import { MaskedHeading } from "@/components/store/shop-heading";
import { contactDetails, displayPhone, instagramHref, lines, localize, phoneHref, whatsappHref } from "@/lib/cms";
import { getI18n } from "@/lib/i18n/server";
import { serverGet } from "@/lib/server-api";
import type { StoreConfig } from "@/lib/types";

const load = async () => contactDetails(await serverGet<StoreConfig>("/store/config", 60).catch(() => null));

export async function generateMetadata(): Promise<Metadata> {
  const [contact, { t, locale }] = await Promise.all([load(), getI18n()]);
  const say = localize(locale);
  return { title: say(contact.title) || t("Contact us"), description: say(contact.intro) || undefined, alternates: { canonical: "/contact" } };
}

/** The contact page: where the shop is and how to reach it, as written in Admin → CMS → Contact us. */
export default async function ContactPage() {
  const [contact, { t, locale }] = await Promise.all([load(), getI18n()]);
  const say = localize(locale);
  const title = say(contact.title) || t("Contact us");
  const address = lines(say(contact.address));
  const hours = lines(say(contact.hours));

  // One card per way of reaching the shop that has been filled in.
  const channels: { icon: LucideIcon; label: string; value: string; href: string; external?: boolean }[] = [];
  if (contact.whatsapp) channels.push({ icon: MessageCircle, label: t("Message us on WhatsApp"), value: displayPhone(contact.whatsapp), href: whatsappHref(contact.whatsapp), external: true });
  if (contact.phone) channels.push({ icon: Phone, label: t("Call the shop"), value: displayPhone(contact.phone), href: phoneHref(contact.phone) });
  if (contact.email) channels.push({ icon: Mail, label: t("Email us"), value: contact.email, href: `mailto:${contact.email}` });
  if (contact.instagram) channels.push({ icon: AtSign, label: t("Follow us on Instagram"), value: contact.instagram, href: instagramHref(contact.instagram), external: true });

  return (
    <div className="container-x pt-6 md:pt-8">
      <Breadcrumbs items={[{ name: t("Home"), href: "/" }, { name: title }]} />

      <header className="mt-8 max-w-2xl md:mt-12">
        {say(contact.eyebrow) && <p className="eyebrow animate-rise">{say(contact.eyebrow)}</p>}
        <MaskedHeading className="mt-3 text-[clamp(2.75rem,7vw,5.5rem)] leading-[1.02] ta:text-[clamp(2rem,5vw,3.75rem)]" delay={0.1}>
          {title}
        </MaskedHeading>
        {say(contact.intro) && <p className="mt-5 animate-rise text-base leading-relaxed text-ink/65 [animation-delay:250ms] md:text-lg">{say(contact.intro)}</p>}
      </header>

      <div className="mt-10 grid items-start gap-5 md:mt-14 lg:grid-cols-2">
        {(address.length > 0 || hours.length > 0) && (
          <Reveal>
            <section className="on-dark gold-frame relative overflow-hidden rounded-[2rem] bg-night p-7 text-white md:p-10">
              <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-[90px]" />
              <div className="relative">
                <h2 className="eyebrow flex items-center gap-2.5">
                  <MapPin size={15} className="text-accent" aria-hidden="true" /> {t("Visit the shop")}
                </h2>
                {address.length > 0 && (
                  <address className="mt-5 font-serif text-2xl font-bold not-italic leading-snug text-gold-bright md:text-3xl">
                    {address.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                )}
                {hours.length > 0 && (
                  <div className="mt-8 border-t border-gold/20 pt-6">
                    <h3 className="flex items-center gap-2.5 text-sm font-semibold text-white/85">
                      <Clock size={15} className="text-accent" aria-hidden="true" /> {t("Opening hours")}
                    </h3>
                    <ul className="mt-3 space-y-1.5 text-sm text-white/70">
                      {hours.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {contact.mapUrl && (
                  <a href={contact.mapUrl} target="_blank" rel="noopener noreferrer" className="group mt-8 inline-flex items-center gap-3 text-sm font-semibold text-gold-bright hover:text-white">
                    <span className="ribbon grid h-11 w-11 place-items-center rounded-full text-white transition-transform duration-500 group-hover:rotate-45">
                      <ArrowUpRight size={16} />
                    </span>
                    {t("Get directions")}
                  </a>
                )}
              </div>
            </section>
          </Reveal>
        )}

        {channels.length > 0 && (
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1" gap={0.08}>
            {channels.map(({ icon: Icon, label, value, href, external }) => (
              <StaggerItem key={href}>
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group card flex h-full items-center gap-4 p-5 transition duration-500 hover:-translate-y-1 hover:shadow-neu-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 md:p-6"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-offwhite text-gold-bright transition-colors duration-500 group-hover:border-accent group-hover:text-accent">
                    <Icon size={19} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink/55">{label}</span>
                    <span className="mt-0.5 block break-words font-semibold">{value}</span>
                  </span>
                  <ArrowUpRight size={17} aria-hidden="true" className="shrink-0 text-ink/30 transition duration-500 group-hover:rotate-45 group-hover:text-accent" />
                </a>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}
