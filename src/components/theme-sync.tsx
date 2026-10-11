"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { readShopperMode, useShopperMode } from "@/lib/shopper-mode";
import { applyAppearance, isStorefrontPath, type Appearance } from "@/lib/theme";
import type { StoreConfig } from "@/lib/types";

/**
 * The one place that applies the theme in the browser.
 *
 * - The saved theme (Admin → Appearance) is already painted by the server;
 *   `initial` is that copy. The shared store-config query replaces it when the
 *   server's HTML was out of date, and when an admin saves a new theme.
 * - On storefront pages a shopper's own light / dark choice (the header
 *   toggle, kept in their browser) wins over the saved mode. The admin console
 *   and the POS always use the saved mode, so the effect re-runs when the
 *   shopper moves between those areas.
 */
export function ThemeSync({ initial }: { initial: Appearance }) {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: ["store-config"],
    queryFn: () => api.get<StoreConfig>("/store/config"),
    staleTime: 300_000,
    select: (c) => c.appearance,
  });
  const { mode: savedMode, brandColor, textColor } = data ?? initial;
  const storefront = isStorefrontPath(pathname);
  // Only the trigger: while the page hydrates this still reads "no choice", so the effect reads the stored value itself.
  const choice = useShopperMode();

  // Before paint, so switching mode or area never shows a frame of the other theme.
  useLayoutEffect(() => {
    applyAppearance({ mode: (storefront && readShopperMode()) || savedMode, brandColor, textColor });
  }, [storefront, choice, savedMode, brandColor, textColor]);

  // The browser-chrome colour: Next puts a fresh theme-color tag (with the saved colour) in <head> on
  // some navigations, after the effect above has run. Keep it on the page colour that is applied.
  useEffect(() => {
    const sync = () => {
      const meta = document.head.querySelector('meta[name="theme-color"]');
      const page = document.documentElement.style.getPropertyValue("--color-offwhite");
      if (meta && page && meta.getAttribute("content") !== page) meta.setAttribute("content", page);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
