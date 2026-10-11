"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

export interface Crumb {
  name: string;
  href?: string;
}

/** Breadcrumb trail; the last item is the current page (not a link). */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("Breadcrumb")} className={clsx("text-xs text-ink/45", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.name}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="link-draw rounded-sm transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none">
                  {c.name}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={clsx("truncate", last && "max-w-[14rem] font-medium text-ink/75 sm:max-w-md")}>
                  {c.name}
                </span>
              )}
              {!last && <ChevronRight size={12} aria-hidden="true" className="shrink-0 text-ink/25" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
