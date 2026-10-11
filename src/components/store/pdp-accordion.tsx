"use client";

import { useId, useState, type ReactNode } from "react";
import { m } from "motion/react";
import { clsx } from "clsx";
import { EASE_OUT } from "./motion";

export interface AccordionSection {
  id: string;
  title: string;
  content: ReactNode;
}

/**
 * Numbered accordion with animated height. Closed panels stay in the DOM
 * (inert, height 0) so their content is still indexable.
 */
export function PdpAccordion({ sections, defaultOpen = [] }: { sections: AccordionSection[]; defaultOpen?: string[] }) {
  const [open, setOpen] = useState<string[]>(defaultOpen);
  const baseId = useId();
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <div className="border-t border-black/[0.08]">
      {sections.map((s, i) => {
        const isOpen = open.includes(s.id);
        const buttonId = `${baseId}-${s.id}-button`;
        const panelId = `${baseId}-${s.id}-panel`;
        return (
          <section key={s.id} className="border-b border-black/[0.08]">
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(s.id)}
                className="group flex w-full items-center justify-between gap-6 rounded-xl py-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-offwhite md:py-7"
              >
                <span className="flex items-baseline gap-4 md:gap-6">
                  <span className="text-xs font-semibold tabular-nums text-ink/30">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-xl font-bold tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 md:text-2xl">{s.title}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={clsx(
                    "relative grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                    isOpen ? "border-ink bg-ink text-white" : "border-black/10 bg-white text-ink group-hover:border-ink",
                  )}
                >
                  <span className="absolute h-[1.5px] w-3.5 rounded-full bg-current" />
                  <m.span className="absolute h-3.5 w-[1.5px] rounded-full bg-current" initial={false} animate={{ rotate: isOpen ? 90 : 0, opacity: isOpen ? 0 : 1 }} transition={{ duration: 0.4, ease: EASE_OUT }} />
                </span>
              </button>
            </h3>
            <m.div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!isOpen}
              initial={false}
              animate={isOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="pb-8 md:pl-10">{s.content}</div>
            </m.div>
          </section>
        );
      })}
    </div>
  );
}
