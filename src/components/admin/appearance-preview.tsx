"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Check, LayoutDashboard, Package, ShoppingCart } from "lucide-react";
import { NAV_LINK } from "@/components/admin/nav";
import { Badge, Button } from "@/components/ui";
import { themeStyle, type Appearance, type ThemeMode } from "@/lib/theme";

/**
 * A sample of the real interface, drawn with a theme that has not been saved
 * yet. Nothing here has its own colours: the wrapper sets the theme's CSS
 * variables and the same classes used across the app pick them up.
 */
function ThemeScope({ appearance, className, children }: { appearance: Appearance; className?: string; children: ReactNode }) {
  return (
    <div style={themeStyle(appearance)} className={clsx("border border-black/10 bg-offwhite text-ink", className)}>
      {children}
    </div>
  );
}

const CHART_BARS = [
  { tone: "bg-accent", height: "100%" },
  { tone: "bg-gold", height: "62%" },
  { tone: "bg-info", height: "84%" },
  { tone: "bg-warning", height: "46%" },
  { tone: "bg-success", height: "72%" },
  { tone: "bg-danger", height: "30%" },
];

export function ThemePreview({ appearance }: { appearance: Appearance }) {
  const other: ThemeMode = appearance.mode === "dark" ? "light" : "dark";
  const navItem = clsx(NAV_LINK.base, "!gap-2 !px-2.5 !py-1.5 !text-xs");

  return (
    <div>
      <p className="sr-only">A sample of the sidebar, header, cards, badges, a table, form controls, chart colours and buttons, drawn with the theme chosen on this page.</p>
      {/* Purely visual: hidden from assistive tech and not focusable. */}
      <div aria-hidden="true" inert>
        <ThemeScope appearance={appearance} className="rounded-2xl p-3">
          <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <div className="rounded-xl border border-black/[0.06] p-1.5">
              <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink/40">Sidebar</p>
              <span className={clsx(navItem, NAV_LINK.idle)}>
                <LayoutDashboard size={13} strokeWidth={1.75} /> Item
              </span>
              <span className={clsx(navItem, NAV_LINK.hover)}>
                <Package size={13} strokeWidth={1.75} /> Hover
              </span>
              <span className={clsx(navItem, NAV_LINK.active)}>
                <ShoppingCart size={13} strokeWidth={1.75} /> Active
              </span>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-white/60 px-3 py-2 text-xs font-semibold">
                Header / navbar
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">Admin</span>
              </div>

              <div className="card space-y-3.5 p-4">
                <div>
                  <p className="text-sm font-semibold">Card heading</p>
                  <p className="mt-1 text-xs text-ink/80">Body copy on a surface.</p>
                  <p className="text-xs text-ink/50">Muted secondary line</p>
                  <p className="mt-1.5 text-xs">
                    <span className="link">A link</span>
                    <span className="ml-3 font-semibold text-accent">Brand text</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">Brand</span>
                  <span className="inline-flex items-center rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold-bright">Gold</span>
                  <Badge tone="success">Success</Badge>
                  <Badge tone="warning">Warning</Badge>
                  <Badge tone="danger">Error</Badge>
                </div>

                <div className="overflow-hidden rounded-xl border border-black/[0.07] text-xs">
                  <div className="flex justify-between bg-black/[0.03] px-3 py-2 font-semibold text-ink/60">
                    <span>Order</span>
                    <span>Status</span>
                  </div>
                  <div className="flex justify-between border-t border-black/5 px-3 py-2">
                    <span>Row one</span>
                    <span className="text-success">Confirmed</span>
                  </div>
                  <div className="flex justify-between border-t border-black/5 bg-accent/10 px-3 py-2 font-medium">
                    <span>Selected row</span>
                    <span className="text-warning">Pending</span>
                  </div>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
                  <div className="h-full w-[58%] rounded-full bg-accent" />
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="flex h-5 w-9 shrink-0 items-center justify-end rounded-full bg-accent p-0.5">
                    <span className="h-4 w-4 rounded-full bg-white shadow" />
                  </span>
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-accent text-white">
                    <Check size={12} strokeWidth={3.5} />
                  </span>
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 border-accent">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="min-w-0 flex-1 truncate rounded-lg border border-accent/60 bg-white px-3 py-1.5 text-xs ring-4 ring-accent/15">Focused input</span>
                </div>

                <div className="flex h-12 items-end gap-1.5">
                  {CHART_BARS.map((bar) => (
                    <span key={bar.tone} className={clsx("flex-1 rounded-t-md", bar.tone)} style={{ height: bar.height }} />
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm">Primary</Button>
                  <Button size="sm" data-state="hover">
                    Hover
                  </Button>
                  <span className="inline-flex h-8 items-center rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent">Soft</span>
                  <Button size="sm" disabled>
                    Disabled
                  </Button>
                </div>
              </div>

              {/* The storefront adds gold serif titles on top of the same tokens. */}
              <div className="store-theme card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">Storefront</p>
                  <h2 className="mt-1 text-lg leading-tight">
                    Luxury in <span className="text-accent">Every Stitch.</span>
                  </h2>
                  <p className="mt-1 text-xs text-ink/60">Sample product card</p>
                </div>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white">Sale</span>
                <Button size="sm">Add to bag</Button>
              </div>
            </div>
          </div>
        </ThemeScope>

        <p className="mb-2 mt-4 text-xs text-ink/50">The same colour in {other} mode</p>
        <ThemeScope appearance={{ mode: other, brandColor: appearance.brandColor, textColor: null }} className="flex items-center gap-3 rounded-2xl p-3">
          <span className="h-9 w-9 shrink-0 rounded-xl bg-accent" />
          <span className="card min-w-0 flex-1 truncate px-3.5 py-2.5 text-xs font-semibold">
            Card &amp; text <span className="ml-2 font-normal text-ink/55">Muted line</span>
          </span>
          <Button size="sm">Button</Button>
        </ThemeScope>
      </div>
    </div>
  );
}
