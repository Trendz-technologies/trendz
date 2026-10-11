"use client";

import { useI18n } from "@/lib/i18n/client";

/**
 * Shown the moment a storefront page is opened, until its content arrives: a
 * banner-sized block, a heading and a row of cards, the shape most pages here
 * start with. Pages with a shape of their own (the listings, a product, the
 * account) have their own placeholder.
 */
export default function StoreLoading() {
  const { t } = useI18n();
  return (
    <div className="container-x pt-4 sm:pt-6" aria-busy="true" aria-label={t("Loading")}>
      <div className="skeleton h-[26rem] rounded-[2rem] md:h-[30rem] lg:h-[36rem] lg:rounded-[2.5rem]" />
      <div className="skeleton mt-12 h-2.5 w-28 rounded-full md:mt-16" />
      <div className="skeleton mt-4 h-10 w-64 max-w-full rounded-2xl" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-56 rounded-[2rem]" />
        ))}
      </div>
    </div>
  );
}
