"use client";

import { useI18n } from "@/lib/i18n/client";

/** Product page placeholder: gallery with thumbnails, buy box and option pills. */
export default function ProductLoading() {
  const { t } = useI18n();
  return (
    <div className="container-x pt-6 md:pt-8" aria-busy="true" aria-label={t("Loading product")}>
      <div className="skeleton mb-6 h-3 w-56 rounded-full md:mb-8" />
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
        <div className="min-w-0 sm:grid sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-4 lg:col-span-7 lg:grid-cols-[5rem_minmax(0,1fr)]">
          <div className="hidden flex-col gap-3 sm:flex">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton aspect-[4/5] w-full rounded-2xl" />
            ))}
          </div>
          <div className="skeleton aspect-[4/5] w-full rounded-[2rem]" />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <div className="skeleton h-2.5 w-20 rounded-full" />
          <div className="skeleton mt-4 h-10 w-11/12 rounded-2xl md:h-12" />
          <div className="skeleton mt-2 h-10 w-2/3 rounded-2xl md:h-12" />
          <div className="skeleton mt-6 h-8 w-40 rounded-xl" />
          <div className="skeleton mt-2 h-2.5 w-28 rounded-full" />
          <div className="mt-6 space-y-2">
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton h-3 w-5/6 rounded-full" />
          </div>
          <div className="skeleton mt-8 h-3 w-20 rounded-full" />
          <div className="mt-3 flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-11 w-11 rounded-full" />
            ))}
          </div>
          <div className="skeleton mt-7 h-3 w-16 rounded-full" />
          <div className="mt-3 flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-11 w-14 rounded-full" />
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <div className="skeleton h-14 w-28 rounded-full" />
            <div className="skeleton h-14 flex-1 rounded-full" />
            <div className="skeleton h-14 w-14 rounded-full" />
          </div>
          <div className="skeleton mt-8 h-20 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
