import type { CSSProperties } from "react";
import { clsx } from "clsx";

/** The drawings on the doodle sheet (drawn in doodles.tsx). */
export type DoodleArt = "hanger" | "dress" | "flower" | "heart" | "needle" | "bow" | "vine" | "butterfly";

/**
 * One line-art doodle, taken from the sheet that <DoodleField> puts on every
 * storefront page. Decoration only: screen readers and the pointer ignore it.
 * The caller gives it a width, a place and a colour (`absolute w-64 text-gold/30`);
 * theme colours keep it right in light and dark mode and with any brand colour.
 */
export function Doodle({ art, className, style }: { art: DoodleArt; className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" className={clsx("pointer-events-none aspect-square fill-none stroke-current stroke-[1.5px] [stroke-linecap:round] [stroke-linejoin:round] md:stroke-2", className)} style={style}>
      <use href={`#doodle-${art}`} />
    </svg>
  );
}
