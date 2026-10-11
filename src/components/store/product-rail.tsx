"use client";

import { useRef } from "react";
import { m, useScroll } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import type { ProductCard as Card } from "@/lib/types";
import { Reveal } from "./motion";
import { ProductCard } from "./product-card";

/** Horizontal, swipeable product carousel with arrow buttons and a scroll progress bar. */
export function ProductRail({ products, label }: { products: Card[]; label: string }) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const { scrollXProgress } = useScroll({ container: track });
  const page = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div>
      <div
        ref={track}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-2 outline-none sm:-mx-6 sm:scroll-px-6 sm:gap-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8"
      >
        {products.map((p, i) => (
          <Reveal key={p.id} className="w-[70%] shrink-0 snap-start sm:w-[42%] md:w-[31%] lg:w-[23.5%]" x={40} y={0} delay={Math.min(i, 5) * 0.06}>
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-4">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/[0.07]">
          <m.div className="h-full origin-left rounded-full bg-accent" style={{ scaleX: scrollXProgress }} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => page(-1)} aria-label={t("Previous products")} className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white transition hover:border-ink hover:bg-ink hover:text-white">
            <ArrowLeft size={16} />
          </button>
          <button onClick={() => page(1)} aria-label={t("More products")} className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white transition hover:border-ink hover:bg-ink hover:text-white">
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
