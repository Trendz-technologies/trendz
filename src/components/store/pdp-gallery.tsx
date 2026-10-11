"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AnimatePresence, m, useDragControls, useMotionValue, type PanInfo, type Variants } from "motion/react";
import { clsx } from "clsx";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import type { ImageView } from "@/lib/types";
import { EASE_OUT } from "./motion";
import { ProductImage } from "./product-card";
import { RollingNumber } from "./shop-rolling-number";

const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 450;
const ZOOM = 1.9;

const slide: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: `${dir * 7}%`, scale: 1.03 }),
  center: { opacity: 1, x: "0%", scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: `${dir * -7}%`, scale: 1 }),
};

const pad = (n: number) => String(n).padStart(2, "0");

const ARROW =
  "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-neu backdrop-blur transition duration-300 hover:scale-105 hover:bg-ink hover:text-white sm:grid lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

/**
 * Product gallery: cross-fading main image (arrows, keyboard, swipe on touch),
 * pointer-following hover zoom on desktop, thumbnails with a sliding active ring
 * (sm and up) and dots on phones. The active index is controlled by the parent so
 * picking a colour can jump to its photo.
 */
export function PdpGallery({
  images,
  name,
  index,
  direction,
  onChange,
  badges,
}: {
  images: (ImageView | null)[];
  name: string;
  index: number;
  direction: number;
  onChange: (index: number, direction: number) => void;
  badges?: ReactNode;
}) {
  const { t } = useI18n();
  const count = images.length;
  const many = count > 1;
  const current = images[index] ?? null;
  const dragControls = useDragControls();
  const [zoom, setZoom] = useState(false);
  const originX = useMotionValue(0.5);
  const originY = useMotionValue(0.5);
  const thumbColumn = useRef<HTMLDivElement>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);

  const step = (delta: 1 | -1) => onChange((index + delta + count) % count, delta);
  const goTo = (i: number) => {
    if (i !== index) onChange(i, i > index ? 1 : -1);
  };

  // Keep the active thumbnail visible in its own scroll column (never scrolls the page).
  useEffect(() => {
    const column = thumbColumn.current;
    const thumb = thumbs.current[index];
    if (!column || !thumb) return;
    column.scrollTo({ top: thumb.offsetTop - column.clientHeight / 2 + thumb.clientHeight / 2, behavior: "smooth" });
  }, [index]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  // Desktop hover zoom: the image scales up around the pointer.
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !current) return;
    if ((e.target as HTMLElement).closest("button")) {
      if (zoom) setZoom(false);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    originX.set((e.clientX - r.left) / r.width);
    originY.set((e.clientY - r.top) / r.height);
    if (!zoom) setZoom(true);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) step(1);
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) step(-1);
  };

  return (
    <div className={clsx(many && "sm:grid sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-4 lg:grid-cols-[5rem_minmax(0,1fr)]")}>
      {many && (
        <div className="relative hidden sm:block">
          <div ref={thumbColumn} className="no-scrollbar absolute inset-0 flex flex-col gap-3 overflow-y-auto p-0.5">
            {images.map((img, i) => (
              <button
                key={img?.id ?? i}
                ref={(el) => {
                  thumbs.current[i] = el;
                }}
                type="button"
                onClick={() => goTo(i)}
                aria-label={t("Show image {index} of {count}", { index: i + 1, count })}
                aria-current={i === index ? "true" : undefined}
                className="group/thumb relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-2xl bg-white outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
              >
                <ProductImage image={img} alt="" sizes="80px" className={clsx("h-full w-full object-cover transition duration-500", i === index ? "opacity-100" : "opacity-55 group-hover/thumb:opacity-100")} />
                {i === index && <m.span layoutId="pdp-thumb-active" className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-ink" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        role={many ? "region" : undefined}
        aria-roledescription={many ? t("carousel") : undefined}
        aria-label={many ? t("{name} — images", { name }) : undefined}
        tabIndex={many ? 0 : undefined}
        onKeyDown={many ? onKeyDown : undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setZoom(false)}
        className={clsx(
          "group relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-white shadow-neu outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-offwhite",
          current && "lg:cursor-zoom-in",
        )}
      >
        {/* Swipe surface (touch / pen only): follows the finger, then springs back while the next image fades in. */}
        <m.div
          className="absolute inset-0"
          style={{ touchAction: many ? "pan-y" : "auto" }}
          drag={many ? "x" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.45}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          onPointerDown={(e) => {
            if (many && e.pointerType !== "mouse") dragControls.start(e);
          }}
        >
          <AnimatePresence initial={false} custom={direction}>
            <m.div
              key={current?.id ?? index}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.75, ease: EASE_OUT, opacity: { duration: 0.45 } }}
              className="absolute inset-0"
            >
              <m.div className="h-full w-full" style={{ originX, originY }} animate={{ scale: zoom ? ZOOM : 1 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
                <ProductImage image={current} alt={name} priority sizes="(min-width: 1024px) 50vw, 100vw" className="h-full w-full select-none object-cover" />
              </m.div>
            </m.div>
          </AnimatePresence>
        </m.div>

        {badges && <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col items-start gap-1.5">{badges}</div>}

        {many && (
          <>
            <button type="button" onClick={() => step(-1)} aria-label={t("Previous image")} className={clsx(ARROW, "left-4")}>
              <ArrowLeft size={17} />
            </button>
            <button type="button" onClick={() => step(1)} aria-label={t("Next image")} className={clsx(ARROW, "right-4")}>
              <ArrowRight size={17} />
            </button>

            {/* Counter (sm and up) */}
            <div aria-hidden="true" className="pointer-events-none absolute bottom-4 left-4 z-10 hidden items-center gap-1 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-semibold tabular-nums shadow-neu backdrop-blur sm:flex">
              <RollingNumber value={index + 1} format={pad} />
              <span className="text-ink/35">/ {pad(count)}</span>
            </div>

            {/* Dots (phones) */}
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center sm:hidden">
              <div className="flex items-center rounded-full bg-white/80 px-1.5 backdrop-blur">
                {images.map((img, i) => (
                  <button key={img?.id ?? i} type="button" onClick={() => goTo(i)} aria-label={t("Show image {index} of {count}", { index: i + 1, count })} aria-current={i === index ? "true" : undefined} className="grid h-7 place-items-center px-[3px]">
                    <m.span initial={false} animate={{ width: i === index ? 18 : 6 }} transition={{ duration: 0.4, ease: EASE_OUT }} className={clsx("block h-1.5 rounded-full transition-colors", i === index ? "bg-ink" : "bg-ink/25")} />
                  </button>
                ))}
              </div>
            </div>

            <p className="sr-only" aria-live="polite">
              {t("Image {index} of {count}", { index: index + 1, count })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
