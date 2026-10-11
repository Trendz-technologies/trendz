"use client";

import { clsx } from "clsx";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { toggleShopperMode } from "@/lib/shopper-mode";

/**
 * Light / dark switch for shoppers. The choice is kept in their own browser
 * (see lib/shopper-mode.ts) and only changes the storefront.
 *
 * The icon shows the mode a click switches to, and is picked in CSS from the
 * mode on <html> (`data-mode`), so it is already right before React loads and
 * the button needs no state of its own.
 *
 * Two placements share the header: the round button in the main row from
 * `sm` up, and the `bar` version on the top strip for phones, where the main
 * row has no room.
 */
export function ThemeToggle({ bar = false, className }: { bar?: boolean; className?: string }) {
  const { t } = useI18n();
  const label = t("Switch between light and dark theme");
  const size = bar ? 15 : 19;

  return (
    <button
      type="button"
      onClick={toggleShopperMode}
      aria-label={label}
      title={label}
      className={clsx(
        "place-items-center transition",
        bar ? "grid w-9 bg-night pr-1 text-white/65 hover:text-white sm:hidden" : "hidden h-10 w-10 rounded-full hover:bg-black/5 sm:grid",
        className,
      )}
    >
      <Sun size={size} strokeWidth={1.75} aria-hidden="true" className="hidden [[data-mode=dark]_&]:block" />
      <Moon size={size} strokeWidth={1.75} aria-hidden="true" className="[[data-mode=dark]_&]:hidden" />
    </button>
  );
}
