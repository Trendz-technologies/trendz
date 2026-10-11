/**
 * Theme engine: one mode + one brand colour (+ an optional text colour) → every
 * design token used by the storefront, admin and POS.
 *
 * The result is a set of CSS custom properties. They override the defaults in
 * globals.css when placed on <html> (whole app) or on any element (the admin's
 * live preview), because Tailwind utilities read the variables at run time.
 *
 * Pure functions (only applyAppearance touches the DOM): safe on the server,
 * in the browser and in tests.
 */

import type { CSSProperties } from "react";

export type ThemeMode = "light" | "dark";

export interface Appearance {
  mode: ThemeMode;
  /** #RRGGBB */
  brandColor: string;
  /** #RRGGBB, or null to derive text from the mode and brand. */
  textColor: string | null;
}

/** The Trendz look: black with brand pink. */
export const DEFAULT_APPEARANCE: Appearance = { mode: "dark", brandColor: "#ff3d9a", textColor: null };

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// Colour maths (sRGB)
// ---------------------------------------------------------------------------

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = HEX_COLOR.test(hex) ? hex.slice(1) : "000000";
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const clamp = (n: number, lo = 0, hi = 255) => Math.min(hi, Math.max(lo, n));

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => clamp(Math.round(v)).toString(16).padStart(2, "0")).join("")}`;
}

/** Hue 0–360, saturation and value 0–1. */
export function rgbToHsv([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Blends `a` towards `b` by `t` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
};

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** Guideline for buttons, controls and large text (WCAG 1.4.11 / 1.4.3 large). */
export const CONTROL_CONTRAST = 3;
/** Guideline for body text (WCAG 1.4.3 AA). A text-colour override below this is not applied. */
export const TEXT_CONTRAST = 4.5;

/** The page and card colours a mode produces for a brand colour. */
export function surfaces(mode: ThemeMode, brand: string) {
  return mode === "dark"
    ? { page: mix("#080506", brand, 0.02), card: mix("#151015", brand, 0.02) }
    : { page: mix("#faf8f9", brand, 0.03), card: "#ffffff" };
}

/** Text that stays readable on top of a colour (used for labels on the brand colour). */
export function onColor(bg: string): string {
  // White keeps the brand feel; switch to near-black only when white would be hard to read.
  return contrast(bg, "#ffffff") >= CONTROL_CONTRAST ? "#ffffff" : "#15101a";
}

export function normaliseAppearance(input: Partial<Appearance> | null | undefined): Appearance {
  const mode: ThemeMode = input?.mode === "light" || input?.mode === "dark" ? input.mode : DEFAULT_APPEARANCE.mode;
  const brandColor = input?.brandColor && HEX_COLOR.test(input.brandColor) ? input.brandColor.toLowerCase() : DEFAULT_APPEARANCE.brandColor;
  const textColor = input?.textColor && HEX_COLOR.test(input.textColor) ? input.textColor.toLowerCase() : null;
  return { mode, brandColor, textColor };
}

/**
 * The text colour an appearance ends up with. An override that would be hard
 * to read on cards in the chosen mode is ignored (so a saved theme can never
 * make the admin unusable); `ignored` tells the Appearance screen to say so.
 */
export function resolveText(input: Partial<Appearance> | null | undefined) {
  const { mode, brandColor, textColor } = normaliseAppearance(input);
  const { card } = surfaces(mode, brandColor);
  // By default text is near-black / near-white with a trace of the brand.
  const derived = mode === "dark" ? mix("#fbf5f2", brandColor, 0.04) : mix("#121013", brandColor, 0.06);
  const ratio = textColor ? contrast(textColor, card) : null;
  const ignored = ratio !== null && ratio < TEXT_CONTRAST;
  return { color: textColor && !ignored ? textColor : derived, derived, ratio, ignored };
}

/** Every CSS custom property for an appearance (the names are documented in globals.css). */
export function themeVars(input: Partial<Appearance> | null | undefined): Record<string, string> {
  const { mode, brandColor: brand } = normaliseAppearance(input);
  const dark = mode === "dark";
  const { page, card } = surfaces(mode, brand);
  const ink = resolveText(input).color;
  const deep = mix(brand, "#000000", 0.26);

  return {
    "color-scheme": mode,

    // Core surfaces and text.
    "--color-ink": ink,
    "--color-offwhite": page,
    "--color-white": card,
    "--color-black": dark ? "#ffffff" : "#000000",
    "--theme-page": page,
    "--theme-card": card,
    "--theme-text": ink,

    // Tinted surfaces.
    "--color-sand": dark ? mix(page, brand, 0.22) : mix("#ffffff", brand, 0.2),
    "--color-mist": dark ? mix(card, brand, 0.03) : mix("#ffffff", brand, 0.07),

    // Brand colour and the shades generated from it.
    "--color-accent": brand,
    "--color-accent-bright": mix(brand, "#ffffff", 0.28),
    "--color-accent-deep": deep,
    "--color-accent-soft": dark ? mix(page, brand, 0.2) : mix("#ffffff", brand, 0.12),
    "--color-on-accent": onColor(brand),

    // Gold (boutique lettering and hairlines): bright on dark, deep on light.
    "--color-gold": dark ? "#e2b65f" : "#8a5d0c",
    "--color-gold-bright": dark ? "#f7dc93" : "#7a4f00",
    "--color-gold-deep": dark ? "#b98a2f" : "#5a3b00",
    "--color-gold-hi": dark ? "#fff6d6" : "#c08a1e",

    "--color-success": dark ? "#3fcf8e" : "#1f7a4d",
    "--color-warning": dark ? "#f3b84b" : "#a15c00",
    "--color-danger": dark ? "#ff6b6b" : "#b42318",
    "--color-info": dark ? "#5db8ff" : "#0b6bb5",

    // Shadow colours (the shapes live in globals.css).
    "--neu-ring": dark ? "rgb(255 255 255 / 0.05)" : "rgb(17 17 17 / 0.05)",
    "--neu-drop": dark ? "rgb(0 0 0 / 0.75)" : "rgb(17 17 17 / 0.16)",
    "--neu-ring-lg": dark ? "rgb(255 255 255 / 0.07)" : "rgb(17 17 17 / 0.06)",
    "--neu-drop-lg": dark ? "rgb(0 0 0 / 0.85)" : "rgb(17 17 17 / 0.22)",
    "--neu-glow": rgba(brand, dark ? 0.28 : 0.2),
    "--neu-inset": dark ? "rgb(0 0 0 / 0.5)" : "rgb(17 17 17 / 0.07)",
    "--frame-ring": dark ? "rgb(0 0 0 / 0.6)" : "rgb(255 255 255 / 0.7)",
    "--frame-drop": dark ? "rgb(0 0 0 / 0.9)" : "rgb(17 17 17 / 0.28)",

    // Page glows (stage lighting in dark mode, a faint blush in light mode).
    "--glow-accent": rgba(brand, dark ? 0.13 : 0.07),
    "--glow-deep": rgba(deep, dark ? 0.12 : 0.05),
    "--glow-gold": dark ? "rgb(226 182 95 / 0.08)" : "rgb(185 138 47 / 0.06)",
  };
}

/** `themeVars` as a React inline style (for <html> and for scoped previews). */
export function themeStyle(input: Partial<Appearance> | null | undefined): CSSProperties {
  const { "color-scheme": colorScheme, ...vars } = themeVars(input);
  return { ...(vars as CSSProperties), colorScheme: colorScheme as CSSProperties["colorScheme"] };
}

/** Applies an appearance to the live document (after saving, and to refresh stale server HTML). */
export function applyAppearance(input: Partial<Appearance> | null | undefined) {
  const vars = themeVars(input);
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  // The mode as an attribute too, for CSS that depends on it (the storefront's light / dark toggle icon).
  root.dataset.mode = vars["color-scheme"];
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", vars["--color-offwhite"]!);
}

// ---------------------------------------------------------------------------
// The shopper's own light / dark choice (storefront only)
// ---------------------------------------------------------------------------

/** localStorage key that holds "light" or "dark" once a shopper has used the header toggle. */
export const SHOPPER_MODE_KEY = "trendz_theme";

const STAFF_PATH = /^\/(admin|pos)(\/|$)/;

/** The admin console and the billing counter always use the saved mode; every other page is the storefront. */
export const isStorefrontPath = (pathname: string) => !STAFF_PATH.test(pathname);

/**
 * Script for the very top of <body>. On a storefront page it applies the
 * shopper's stored choice before the first paint, so someone who prefers the
 * other mode never sees a flash of the saved one. Only the other mode's
 * variables are sent: the saved mode is already on <html>.
 */
export function shopperModeScript(input: Partial<Appearance> | null | undefined): string {
  const saved = normaliseAppearance(input);
  const other: ThemeMode = saved.mode === "dark" ? "light" : "dark";
  // "<" is escaped so the JSON can never close the <script> element.
  const vars = JSON.stringify(themeVars({ ...saved, mode: other })).replace(/</g, "\\u003c");
  return (
    `(function(){try{if(${STAFF_PATH}.test(location.pathname))return;` +
    `if(localStorage.getItem(${JSON.stringify(SHOPPER_MODE_KEY)})!==${JSON.stringify(other)})return;` +
    `var v=${vars},r=document.documentElement;for(var k in v)r.style.setProperty(k,v[k]);r.dataset.mode=${JSON.stringify(other)};` +
    `var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=v["--color-offwhite"]}catch(e){}})()`
  );
}

