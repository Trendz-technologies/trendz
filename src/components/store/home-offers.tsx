import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import { ArrowUpRight, CalendarDays, Gift } from "lucide-react";
import { money } from "@/lib/format";
import { i18n, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import type { HomeOffers as Offers, LocalizedText } from "@/lib/types";

/*
 * The offers block on the home page: offer cards, a gift banner and a sale
 * banner, all written in Admin → Home page offers. It is laid out with
 * container queries, so the admin's narrow preview and the full-width home
 * page are the same component. No hooks and nothing server-only: it renders
 * on the server for the store and in the browser for the preview.
 */

/** Today's date in India, the shop's time zone, as YYYY-MM-DD. */
const todayInIndia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/** Why the block is not on the home page, or null when it is. */
export function offersHiddenReason(offers: Offers, today = todayInIndia()): "off" | "ended" | "empty" | null {
  if (!offers.enabled) return "off";
  if (offers.endsOn && offers.endsOn < today) return "ended";
  if (!offers.cards.length && !offers.gift.enabled && !offers.sale.enabled) return "empty";
  return null;
}

/** "Oct 12 – 19" and "Monday to Monday", in the shopper's language. */
function offerPeriod({ startsOn: from, endsOn: to }: Offers, locale: Locale): { dates: string; days: string } | null {
  const { t } = i18n(locale);
  // Calendar dates, not moments: formatted in UTC so they never slip a day.
  const part = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE_TAGS[locale], { ...options, timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  const date = (day: string) => part(day, { day: "numeric", month: "short" });
  const weekday = (day: string) => part(day, { weekday: "long" });

  if (from && to && from !== to) {
    const dates =
      from.slice(0, 7) === to.slice(0, 7)
        ? t("{month} {from} – {to}", { month: part(from, { month: "short" }), from: part(from, { day: "numeric" }), to: part(to, { day: "numeric" }) })
        : t("{from} – {to}", { from: date(from), to: date(to) });
    return { dates, days: t("{from} to {to}", { from: weekday(from), to: weekday(to) }) };
  }
  if (from) return { dates: to ? date(from) : t("From {date}", { date: date(from) }), days: weekday(from) };
  if (to) return { dates: t("Until {date}", { date: date(to) }), days: weekday(to) };
  return null;
}

/** A card or banner that is a link when it has somewhere to go. */
function Surface({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={clsx(className, "group transition-transform duration-500 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40")}>
      {children}
    </Link>
  );
}

export function HomeOffers({ offers, locale }: { offers: Offers; locale: Locale }) {
  const say = (text: LocalizedText) => (locale === "ta" ? text.ta || text.en : text.en || text.ta);
  const { cards, gift, sale } = offers;
  const [eyebrow, title, subtitle] = [say(offers.eyebrow), say(offers.title), say(offers.subtitle)];
  const [giftTag, saleLabel, saleWord] = [say(gift.tag), say(sale.label), say(sale.valueLabel)];
  const period = offerPeriod(offers, locale);

  return (
    <div className="@container">
      {(eyebrow || title || subtitle) && (
        <header className="mb-8 flex flex-col gap-3 @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:gap-10">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 className="mt-2 text-4xl @3xl:text-5xl">{title}</h2>}
          </div>
          {subtitle && <p className="max-w-md text-sm leading-relaxed text-ink/60 @3xl:pb-1 @3xl:text-right">{subtitle}</p>}
        </header>
      )}

      {cards.length > 0 && (
        <ul className={clsx("grid gap-4 @3xl:gap-5", cards.length > 1 && "@2xl:grid-cols-2", cards.length === 3 && "@5xl:grid-cols-3", cards.length === 4 && "@6xl:grid-cols-4")}>
          {cards.map((card, i) => {
            const [tag, name, caption] = [say(card.tag), say(card.title), say(card.caption)];
            return (
              // Each card is its own container, so its layout follows its own width (one, two or four across).
              <li key={i} className="@container/card min-w-0">
                <Surface href={card.href} className={clsx("gold-frame relative flex h-full overflow-hidden rounded-[2rem] bg-accent-soft", card.imageUrl && "min-h-56")}>
                  <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
                  <div className={clsx("relative flex min-w-0 flex-1 flex-col gap-4 p-6 @md/card:p-8", !card.imageUrl && "@md/card:flex-row @md/card:justify-between @md/card:gap-8")}>
                    <div className="min-w-0">
                      {tag && <p className="ribbon w-fit rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">{tag}</p>}
                      {name && <p className="mt-5 text-2xl font-extrabold uppercase leading-tight tracking-tight @md/card:text-3xl">{name}</p>}
                      {caption && <p className="mt-1.5 text-sm font-medium text-ink/65">{caption}</p>}
                    </div>
                    {/* Text stays at the top so ribbons line up across a row; the price sits on the bottom edge beside it. */}
                    {card.price != null && (
                      <p className={clsx("text-gold-shine w-fit shrink-0 font-serif text-5xl font-bold lining-nums leading-none @md/card:text-6xl", !card.imageUrl && "@md/card:self-end")}>{money(card.price)}</p>
                    )}
                  </div>
                  {card.imageUrl && (
                    <div className="relative w-2/5 shrink-0">
                      <img src={card.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-accent-soft to-transparent" />
                    </div>
                  )}
                  {card.href && (
                    <span aria-hidden="true" className="ribbon absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-45">
                      <ArrowUpRight size={16} />
                    </span>
                  )}
                </Surface>
              </li>
            );
          })}
        </ul>
      )}

      {(gift.enabled || sale.enabled) && (
        <div className={clsx("grid gap-4 @3xl:gap-5", cards.length > 0 && "mt-4 @3xl:mt-5", gift.enabled && sale.enabled && "@4xl:grid-cols-[1.35fr_1fr]")}>
          {gift.enabled && (
            <div className="gold-frame relative flex items-center gap-4 overflow-hidden rounded-[2rem] bg-gradient-to-r from-accent-soft via-sand to-accent-soft p-5 @3xl:gap-6 @3xl:p-7">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-accent ring-1 ring-gold/40">
                <Gift size={26} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                {giftTag && <p className="ribbon mb-1.5 w-fit rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide @lg:hidden">{giftTag}</p>}
                <p className="text-pretty text-base font-bold leading-snug @3xl:text-lg">{say(gift.text)}</p>
              </div>
              {giftTag && <p className="ribbon hidden w-28 shrink-0 -rotate-6 rounded-2xl px-3 py-2.5 text-center text-xs font-extrabold uppercase leading-tight @lg:block">{giftTag}</p>}
            </div>
          )}

          {sale.enabled && (
            <Surface href={sale.href} className="gold-frame relative flex items-center justify-between gap-5 overflow-hidden rounded-[2rem] bg-white p-5 @3xl:p-7">
              <div className="min-w-0">
                {saleLabel && <p className="eyebrow">{saleLabel}</p>}
                {period && (
                  <>
                    <p className="mt-2 flex items-center gap-2.5 text-xl font-bold @3xl:text-2xl ta:text-lg ta:@3xl:text-xl">
                      <CalendarDays size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-accent" />
                      {period.dates}
                    </p>
                    <p className="mt-1 text-sm text-ink/60">{period.days}</p>
                  </>
                )}
              </div>
              {(sale.value || saleWord) && (
                <div className="grid h-28 w-28 shrink-0 place-content-center justify-items-center gap-1.5 rounded-full border border-gold/50 bg-accent-soft text-center @3xl:h-32 @3xl:w-32">
                  {sale.value && <p className="text-gold-shine font-serif text-4xl font-bold lining-nums leading-none">{sale.value}</p>}
                  {saleWord && <p className="ribbon rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">{saleWord}</p>}
                </div>
              )}
            </Surface>
          )}
        </div>
      )}
    </div>
  );
}
