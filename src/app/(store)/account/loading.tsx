"use client";

import { useI18n } from "@/lib/i18n/client";

/** Account page placeholder, shown beside the account menu: a heading and a few rows. */
export default function AccountLoading() {
  const { t } = useI18n();
  return (
    <div aria-busy="true" aria-label={t("Loading")}>
      <div className="skeleton h-9 w-56 max-w-full rounded-2xl" />
      <div className="skeleton mt-3 h-3 w-72 max-w-full rounded-full" />
      <div className="mt-8 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-28 rounded-[1.75rem]" />
        ))}
      </div>
    </div>
  );
}
