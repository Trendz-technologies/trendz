import { useSyncExternalStore } from "react";
import { SHOPPER_MODE_KEY, type ThemeMode } from "./theme";

/**
 * A shopper's own light / dark choice for the storefront.
 *
 * It lives in this browser's localStorage only: nothing is sent to the server
 * and nobody else is affected. Until a shopper uses the header toggle there is
 * no choice, and the mode saved in Admin → Appearance applies.
 */

const CHANGED = "trendz:theme";

// Stand-in for browsers where storage is blocked (some private modes): the choice then lasts for the visit.
let memory: ThemeMode | null = null;

const parse = (value: string | null): ThemeMode | null => (value === "light" || value === "dark" ? value : null);

/** The stored choice, or null when the shopper has not made one. Browser only. */
export function readShopperMode(): ThemeMode | null {
  try {
    return parse(localStorage.getItem(SHOPPER_MODE_KEY)) ?? memory;
  } catch {
    return memory;
  }
}

export function setShopperMode(mode: ThemeMode) {
  memory = mode;
  try {
    localStorage.setItem(SHOPPER_MODE_KEY, mode);
  } catch {
    // Storage is unavailable; `memory` keeps the choice until the page is closed.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Switches from the mode the page shows right now to the other one, and remembers it. */
export function toggleShopperMode() {
  setShopperMode(document.documentElement.dataset.mode === "dark" ? "light" : "dark");
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  // Fired when another tab of the same browser changes the choice.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Re-renders the caller whenever the choice changes (in this tab or another). Null on the server. */
export const useShopperMode = () => useSyncExternalStore(subscribe, readShopperMode, () => null);
