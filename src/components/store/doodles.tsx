import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Doodle, type DoodleArt } from "./doodle";

/*
 * The storefront's doodles: big hand-drawn outlines of the things the shop is
 * about (a hanger, a dress, a needle and thread …). <DoodleField> lays them
 * behind every storefront page, like a wallpaper that cards and photographs
 * cover; <Doodle> (doodle.tsx) places a single one inside a panel.
 *
 * They are drawn as lines in the theme's gold and brand colour, so they follow
 * light / dark mode and the Appearance settings, and they are plain markup, so
 * they are there on first paint. The admin and the POS do not use them.
 */

const PETAL = "M100 60c-15-13-13-36 0-42 13 6 15 29 0 42Z";

/* The doodle sheet. Every drawing sits on a 200 x 200 grid. */
const SHEET: Record<DoodleArt, ReactNode> = {
  hanger: (
    <>
      <path d="M100 66c-3-11 15-14 17-27 2-13-13-21-23-14-7 5-8 11-7 17" />
      <path d="M100 66 27 121c-9 7-5 17 6 17h134c11 0 15-10 6-17L100 66Z" />
      <path d="M60 138c0 9 4 14 10 14M140 138c0 9-4 14-10 14" />
    </>
  ),
  dress: (
    <>
      <path d="M79 24c1 11 8 17 21 17s20-6 21-17" />
      <path d="M79 24 64 38l11 27c2 6 2 12 0 18L45 170c19 9 91 9 110 0l-30-87c-2-6-2-12 0-18l11-27-15-14" />
      <path d="M75 84c15 6 35 6 50 0" />
      <path d="M83 108l-10 54M100 110v56M117 108l10 54" />
      <path d="M56 150c28 9 60 9 88 0" />
    </>
  ),
  flower: (
    <>
      <circle cx="100" cy="70" r="9" />
      {[0, 72, 144, 216, 288].map((turn) => (
        <path key={turn} transform={`rotate(${turn} 100 70)`} d={PETAL} />
      ))}
      <path d="M100 82c-5 34 7 66 0 104" />
      <path d="M100 146c16-17 37-15 47 0-14 13-33 13-47 0ZM99 164c-16-15-35-13-43 2 12 11 31 11 43-2Z" />
    </>
  ),
  // A heart with a line of stitches inside.
  heart: (
    <>
      <path d="M100 166C39 121 27 84 43 62c14-19 41-15 57 10 16-25 43-29 57-10 16 22 4 59-57 104Z" />
      <path strokeDasharray="8 10" d="M100 145C58 112 49 88 59 73c9-12 26-10 41 12 15-22 32-24 41-12 10 15 1 39-41 72Z" />
    </>
  ),
  // A needle and its looping thread: "luxury in every stitch".
  needle: (
    <>
      <ellipse cx="152" cy="38" rx="5" ry="13" transform="rotate(37.4 152 38)" />
      <path d="M144 48 58 160" />
      <path d="M152 38c28-6 42 20 22 36-24 19-66-8-94 14-24 19-6 50 20 42 22-7 16-36-8-32-30 5-44 44-36 84" />
    </>
  ),
  bow: (
    <>
      <path d="M92 96C66 60 32 56 28 78c-4 23 28 40 64 20" />
      <path d="M108 96c26-36 60-40 64-18 4 23-28 40-64 20" />
      <path d="M92 84h16c5 0 8 3 8 8v10c0 5-3 8-8 8H92c-5 0-8-3-8-8V92c0-5 3-8 8-8Z" />
      <path d="M90 110 68 168l17-7 8 15 9-62M110 110l22 58-17-7-8 15" />
    </>
  ),
  // A leafy flourish, like the gold ones on the shop's banner.
  vine: (
    <>
      <path d="M18 168c42-9 63-41 58-73-4-27-35-31-43-10-6 17 10 29 23 18" />
      <path d="M76 95c9-38 45-61 84-52" />
      <path d="M104 55c-3-17 10-27 25-25-2 15-11 23-25 25ZM136 44c7-15 21-19 34-12-7 12-19 17-34 12ZM84 76c-15-8-17-23-9-35 12 7 15 20 9 35Z" />
      <path d="M18 168c21 15 53 17 82 4" />
    </>
  ),
  butterfly: (
    <>
      <path d="M100 80v58" />
      <path d="M100 80c-4-15-12-23-23-26M100 80c4-15 12-23 23-26" />
      <path d="M100 94C82 52 38 42 31 70c-6 24 29 38 69 30" />
      <path d="M100 94c18-42 62-52 69-24 6 24-29 38-69 30" />
      <path d="M100 106c-30 2-50 22-42 44 8 20 36 8 42-28" />
      <path d="M100 106c30 2 50 22 42 44-8 20-36 8-42-28" />
    </>
  ),
};

/* The sheet as SVG symbols, for <use>. Lines keep one thickness whatever size a doodle is shown at. */
function DoodleSheet() {
  return (
    <svg width="0" height="0" className="absolute **:[vector-effect:non-scaling-stroke]">
      {(Object.keys(SHEET) as DoodleArt[]).map((art) => (
        <symbol key={art} id={`doodle-${art}`} viewBox="0 0 200 200" overflow="visible">
          {SHEET[art]}
        </symbol>
      ))}
    </svg>
  );
}

/* Where a doodle sits in a strip of wallpaper: against an edge, or its centre this many percent across the page. */
type Spot = { art: DoodleArt; at: "left" | "right" | number; top: number; big?: boolean; tilt: number; tone: "gold" | "accent" };

/* One strip, repeated down the page (`top` in rem): each drawing once, about one every 280px, edge, middle, other edge. */
const STRIP: Spot[] = [
  { art: "hanger", at: "left", top: 3, big: true, tilt: -12, tone: "gold" },
  { art: "butterfly", at: "right", top: 20, tilt: 14, tone: "gold" },
  { art: "flower", at: 56, top: 37, tilt: 10, tone: "gold" },
  { art: "dress", at: "right", top: 53, big: true, tilt: 8, tone: "gold" },
  { art: "vine", at: "left", top: 70, big: true, tilt: 0, tone: "gold" },
  { art: "needle", at: 60, top: 88, big: true, tilt: 0, tone: "accent" },
  { art: "bow", at: "right", top: 105, big: true, tilt: -10, tone: "accent" },
  { art: "heart", at: 30, top: 122, tilt: 12, tone: "gold" },
];
/* Taller than its last doodle: a strip clips what hangs below it. */
const STRIP_REM = 142;
/* Enough for about 18,000px of page; a longer page simply has no doodles below that. */
const STRIPS = 8;

/* Big on every screen: about half a phone's width, a quarter of a desktop's. */
const WIDTH = { big: "w-[clamp(12rem,26vw,25rem)]", small: "w-[clamp(9.5rem,19vw,18rem)]" };
/* Edge doodles hang a little off the page. */
const EDGE = { left: "left-[clamp(-4rem,-3vw,-1.5rem)]", right: "right-[clamp(-4rem,-3vw,-1.5rem)]" };
const TONE = { gold: "text-gold/30", accent: "text-accent/30" };

/**
 * The doodle wallpaper, plus the sheet the doodles are drawn from. Goes first
 * inside a `relative` box and fills it, behind everything else in the box:
 * the box and its ancestors must not have a background or a z-index of their
 * own. On desktop the doodles drift slowly (not at all for visitors who ask
 * for less motion).
 */
export function DoodleField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <DoodleSheet />
      {Array.from({ length: STRIPS }, (_, strip) => (
        // A strip far from the screen is not drawn or animated at all.
        <div key={strip} className="relative [content-visibility:auto]" style={{ height: `${STRIP_REM}rem` }}>
          {STRIP.map((spot, i) => (
            <Doodle
              key={spot.art}
              art={spot.art}
              className={clsx("absolute md:animate-float", spot.big ? WIDTH.big : WIDTH.small, typeof spot.at === "number" ? "-translate-x-1/2" : EDGE[spot.at], TONE[spot.tone])}
              style={{
                top: `${spot.top}rem`,
                left: typeof spot.at === "number" ? `${spot.at}%` : undefined,
                rotate: `${spot.tilt}deg`,
                // Out of step with each other, so the page never moves as one block.
                animationDuration: `${9 + (i % 4) * 2}s`,
                animationDelay: `-${((i * 1.7) % 9).toFixed(1)}s`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
