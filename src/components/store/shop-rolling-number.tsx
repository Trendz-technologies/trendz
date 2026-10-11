"use client";

import { useState } from "react";
import { AnimatePresence, m, type Variants } from "motion/react";
import { clsx } from "clsx";
import { EASE_OUT } from "./motion";

const roll: Variants = {
  enter: (dir: number) => ({ y: dir < 0 ? "-90%" : "90%", opacity: 0 }),
  center: { y: "0%", opacity: 1 },
  exit: (dir: number) => ({ y: dir < 0 ? "90%" : "-90%", opacity: 0 }),
};

/**
 * A number (or a formatted value such as a price) that rolls up when it grows
 * and down when it shrinks. Screen readers get the plain current value once.
 */
export function RollingNumber({ value, format, className }: { value: number; format?: (n: number) => string; className?: string }) {
  // Remember the previous value to pick the roll direction (state adjusted during render, not in an effect).
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState(1);
  if (shown !== value) {
    setDir(value > shown ? 1 : -1);
    setShown(value);
  }
  const text = format ? format(value) : String(value);
  return (
    <span className={clsx("relative inline-flex overflow-hidden align-bottom", className)}>
      <span className="sr-only">{text}</span>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <m.span
          key={value}
          aria-hidden="true"
          custom={dir}
          variants={roll}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="inline-block whitespace-nowrap"
        >
          {text}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
