import type { ReactNode } from "react";

/**
 * Big editorial heading whose text rises out of a mask on first paint.
 * Pure CSS (animate-word-rise), so it plays without waiting for JavaScript, and
 * the text is rendered once (unlike word-split headings) so search engines and
 * screen readers read the real title. Usable from server and client components.
 */
export function MaskedHeading({ children, className, delay = 0, as: Tag = "h1" }: { children: ReactNode; className?: string; delay?: number; as?: "h1" | "h2" | "p" }) {
  return (
    <Tag className={className}>
      <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
        <span className="block animate-word-rise" style={delay ? { animationDelay: `${Math.round(delay * 1000)}ms` } : undefined}>
          {children}
        </span>
      </span>
    </Tag>
  );
}
