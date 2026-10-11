"use client";

import { useSyncExternalStore } from "react";
import { isStorefrontPath } from "@/lib/theme";
import { DoodleField } from "./doodles";

const never = () => () => {};
/* A storefront address, and not already inside the storefront layout (which has its own doodles). */
const wanted = () => isStorefrontPath(window.location.pathname) && !document.getElementById("main");

/**
 * The doodle wallpaper for the not-found and error pages. Those pages sit
 * outside the storefront layout and are also shown for admin and POS
 * addresses, where there must be no doodles. The not-found page is built once
 * for every address, so the server cannot tell which one it is for: the
 * doodles are added in the browser, once the address is known.
 */
export function StandaloneDoodles() {
  const show = useSyncExternalStore(never, wanted, () => false);
  return show ? <DoodleField /> : null;
}
