import { clsx } from "clsx";
import { BRAND } from "@/lib/brand";

/**
 * The shop's full logo on a dark panel (footer, the home page's closing band,
 * the About banner): the one uploaded in Admin → CMS → Home page, or else the
 * one that ships with the app. `mix-blend-screen` lets a logo drawn on black
 * melt into the panel; a transparent one is unaffected.
 */
export function BrandLogo({ src, className, lazy }: { src: string | null; className?: string; lazy?: boolean }) {
  const alt = `${BRAND.fullName} — ${BRAND.tagline}`;
  const loading = lazy ? "lazy" : undefined;
  // The built-in file's size is known, so the page keeps its place while it loads; an uploaded logo is fitted whole into the same box.
  return src ? (
    <img src={src} alt={alt} loading={loading} className={clsx("object-contain mix-blend-screen", className)} />
  ) : (
    <img src={BRAND.logo} alt={alt} width={1030} height={724} loading={loading} className={clsx("mix-blend-screen", className)} />
  );
}
