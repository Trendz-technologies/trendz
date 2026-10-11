"use client";

/**
 * Storefront motion primitives (Motion / framer-motion).
 *
 * - Content is never hidden while JavaScript loads: first-paint entrances are CSS
 *   keyframes (SplitWords, animate-rise), and Reveal / Stagger only hide what is
 *   still below the fold after hydration.
 * - Interactive motion (drawers, layoutId indicators, AnimatePresence swaps) uses
 *   `m.*` inside <LazyMotion strict>, so the engine is code-split and loaded lazily.
 * - <MotionConfig reducedMotion="user"> and the CSS in globals.css honour
 *   prefers-reduced-motion.
 * - Server components can use these as wrappers (they accept children).
 */
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { LazyMotion, MotionConfig, m, useInView, useMotionValue, useScroll, useSpring, useTransform, type HTMLMotionProps } from "motion/react";
import { clsx } from "clsx";

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.6, ease: EASE_OUT }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

const REVEAL_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/*
 * Scroll reveals are progressive enhancement: the server always sends visible
 * content. After hydration, only elements still below the fold are hidden and
 * then revealed as they scroll in; anything already on screen is left alone,
 * so nothing ever disappears while JavaScript loads.
 */
function prepareReveal(el: HTMLElement, from: { x: number; y: number }) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return false;
  el.style.opacity = "0";
  el.style.transform = `translate3d(${from.x}px, ${from.y}px, 0)`;
  return true;
}

function playReveal(el: HTMLElement, delay: number, duration = 0.8) {
  el.style.transition = `opacity ${duration}s ${REVEAL_EASE} ${delay}s, transform ${duration}s ${REVEAL_EASE} ${delay}s`;
  el.style.opacity = "1";
  el.style.transform = "none";
  // Hand control back to the element's own classes (hover transitions etc.) afterwards.
  window.setTimeout(() => {
    el.style.transition = "";
    el.style.transform = "";
    el.style.opacity = "";
  }, (delay + duration) * 1000 + 50);
}

const rootMarginFor = (amount: number) => `0px 0px -${Math.round(Math.min(0.5, amount) * 40)}% 0px`;

/** Fades and lifts content in the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  x = 0,
  className,
  as = "div",
  amount = 0.2,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  x?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span" | "header";
  amount?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !prepareReveal(el, { x, y })) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        playReveal(el, delay);
        io.disconnect();
      },
      { rootMargin: rootMarginFor(amount) },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay, x, y, amount]);
  const Tag = as;
  return (
    <Tag ref={ref as React.Ref<never>} className={className}>
      {children}
    </Tag>
  );
}

/** Container whose <StaggerItem> children animate in one after another as they scroll into view. */
export function Stagger({ children, className, gap = 0.07, amount = 0.15 }: { children: ReactNode; className?: string; gap?: number; amount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-stagger-item]")).filter((el) => el.parentElement?.closest("[data-stagger]") === root);
    const hidden = items.filter((el) => prepareReveal(el, { x: 0, y: 28 }));
    if (!hidden.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((p, q) => hidden.indexOf(p) - hidden.indexOf(q));
        entering.forEach((el, i) => {
          playReveal(el, i * gap, 0.75);
          io.unobserve(el);
        });
      },
      { rootMargin: rootMarginFor(amount) },
    );
    hidden.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [gap, amount]);
  return (
    <div ref={ref} data-stagger="" className={className}>
      {children}
    </div>
  );
}

export function StaggerItem({ children, className, ...rest }: { children: ReactNode; className?: string } & Omit<HTMLMotionProps<"div">, "variants" | "children">) {
  return (
    <m.div data-stagger-item="" className={className} {...rest}>
      {children}
    </m.div>
  );
}

/**
 * Headline whose words rise out of a mask one by one. Pure CSS, so it plays on
 * first paint without waiting for JavaScript (safe for above-the-fold heroes).
 */
export function SplitWords({ text, className, delay = 0, wordClassName }: { text: string; className?: string; delay?: number; wordClassName?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span aria-hidden="true" className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <span className={clsx("inline-block animate-word-rise", wordClassName)} style={{ animationDelay: `${Math.round((delay + i * 0.08) * 1000)}ms` }}>
              {word}
            </span>
          </span>
          {/* The space sits between the word boxes: trailing spaces inside an inline-block collapse. */}
          {i < words.length - 1 && <span aria-hidden="true"> </span>}
        </Fragment>
      ))}
    </span>
  );
}

/** Moves its content slower than the page scrolls (subtle depth on hero / editorial images). */
export function Parallax({ children, className, offset = 60 }: { children: ReactNode; className?: string; offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  // The moving layer overhangs the frame by `offset` on both ends, so no edge is ever exposed.
  return (
    <div ref={ref} className={clsx("relative overflow-hidden", className)}>
      <m.div style={{ y, top: -offset, bottom: -offset }} className="absolute inset-x-0 will-change-transform">
        {children}
      </m.div>
    </div>
  );
}

/** Pulls its child gently towards the pointer (desktop pointers only). */
export function Magnetic({ children, strength = 0.25, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });
  return (
    <m.div
      ref={ref}
      className={clsx("inline-block", className)}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </m.div>
  );
}

/** Endless horizontal ticker (CSS animation; pauses on hover). Content is rendered twice for a seamless loop. */
export function Marquee({ children, className, fast = false, reverse = false }: { children: ReactNode; className?: string; fast?: boolean; reverse?: boolean }) {
  return (
    <div className={clsx("group flex overflow-hidden", className)}>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className={clsx(
            "flex shrink-0 items-center group-hover:[animation-play-state:paused]",
            fast ? "animate-marquee-fast" : "animate-marquee",
            reverse && "[animation-direction:reverse]",
          )}
        >
          {children}
          {children}
        </div>
      ))}
    </div>
  );
}

/** Number that counts up when it scrolls into view. */
export function CountUp({ to, suffix = "", className }: { to: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const value = useMotionValue(0);
  const spring = useSpring(value, { stiffness: 60, damping: 20 });
  const text = useTransform(spring, (v) => `${Math.round(v).toLocaleString("en-IN")}${suffix}`);
  useEffect(() => {
    if (inView) value.set(to);
  }, [inView, to, value]);
  return (
    <m.span ref={ref} className={className}>
      {text}
    </m.span>
  );
}
