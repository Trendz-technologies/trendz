import { DoodleField } from "@/components/store/doodles";
import { Navbar } from "@/components/store/navbar";
import { Footer } from "@/components/store/footer";
import { StoreProviders } from "@/components/store/store-providers";
import { contactDetails, shopLogo } from "@/lib/cms";
import { money } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { serverGet } from "@/lib/server-api";
import type { CategoryNode, StoreConfig } from "@/lib/types";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, config, { t, locale }] = await Promise.all([
    serverGet<CategoryNode[]>("/store/categories", 120).catch(() => [] as CategoryNode[]),
    serverGet<StoreConfig>("/store/config", 60).catch(() => null),
    // The shopper's language (English or Tamil) comes from a cookie, so the page is already translated when it arrives.
    getI18n(),
  ]);
  // Announcement ticker, built from live store settings (nothing hard-coded about money).
  const announcements = [
    config?.shipping.freeShippingThreshold ? t("Free shipping on orders above {amount}", { amount: money(config.shipping.freeShippingThreshold) }) : t("Tracked delivery across India"),
    t("{days}-day easy returns", { days: config?.returns.windowDays ?? 7 }),
    t("New drops every week"),
    t("Secure UPI, card & netbanking checkout"),
  ];
  // The About us page can be switched off in Admin → CMS; the links to it go with it.
  const about = config?.aboutPublished ?? false;
  // Uploaded in Admin → CMS → Home page; null keeps the logo that ships with the app.
  const logo = shopLogo(config);
  return (
    <StoreProviders locale={locale}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white">
        {t("Skip to content")}
      </a>
      <Navbar categories={categories} announcements={announcements} about={about} logo={logo} />
      <main id="main" className="relative overflow-x-clip">
        {/* Big line-art doodles behind every storefront page. */}
        <DoodleField />
        {children}
      </main>
      <Footer categories={categories} contact={contactDetails(config)} pages={config?.pages ?? []} about={about} logo={logo} />
    </StoreProviders>
  );
}
