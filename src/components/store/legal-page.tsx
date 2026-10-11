import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { RichText } from "@/components/ui/rich-text";
import { localize } from "@/lib/cms";
import { date } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { NotFoundError, serverGet, STORE_CONFIG_TAG } from "@/lib/server-api";
import type { PageSlug, PublishedPage } from "@/lib/types";
import { Breadcrumbs } from "./shop-breadcrumbs";
import { MaskedHeading } from "./shop-heading";

/*
 * The legal pages (/terms, /privacy), written in Admin → CMS. A page that is
 * not published does not exist as far as the storefront is concerned.
 */

// Cached with the store config's tag, so saving in the admin refreshes it at once.
const load = cache(async (slug: PageSlug) => {
  try {
    return await serverGet<PublishedPage>(`/store/pages/${slug}`, 300, [STORE_CONFIG_TAG]);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
});

export async function legalPageMetadata(slug: PageSlug): Promise<Metadata> {
  const [page, { locale }] = await Promise.all([load(slug), getI18n()]);
  return { title: localize(locale)(page.title), alternates: { canonical: `/${slug}` } };
}

export async function LegalPage({ slug }: { slug: PageSlug }) {
  const [page, { t, locale }] = await Promise.all([load(slug), getI18n()]);
  const say = localize(locale);
  const title = say(page.title);

  return (
    <article className="container-x pt-6 md:pt-8">
      <Breadcrumbs items={[{ name: t("Home"), href: "/" }, { name: title }]} />
      <div className="mx-auto mt-8 max-w-3xl md:mt-12">
        <header>
          <MaskedHeading className="text-[clamp(2.25rem,6vw,4.25rem)] leading-[1.05] ta:text-[clamp(1.75rem,4.5vw,3rem)]">{title}</MaskedHeading>
          {page.updatedAt && <p className="mt-4 animate-rise text-sm text-ink/50 [animation-delay:200ms]">{t("Last updated {date}", { date: date(page.updatedAt, locale) })}</p>}
        </header>
        <div className="card mt-8 p-6 md:mt-10 md:p-10">
          <RichText html={say(page.body)} className="text-[15px] leading-relaxed text-ink/75" />
        </div>
      </div>
    </article>
  );
}
