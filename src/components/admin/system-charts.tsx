"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Table2, XCircle, BarChart3 } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { money } from "@/lib/format";

/**
 * Chart palette, taken from the theme tokens so charts follow Admin →
 * Appearance: text tones carry the data, the brand colour marks the hero
 * series. Status colours are reserved for stock health.
 */
export const CHART = {
  ink: "var(--color-ink)",
  inkSoft: "color-mix(in srgb, var(--color-ink) 65%, transparent)",
  accent: "var(--color-accent)",
  surface: "var(--color-white)",
  grid: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
  axis: "color-mix(in srgb, var(--color-ink) 55%, transparent)",
  cursor: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
  crosshair: "color-mix(in srgb, var(--color-ink) 25%, transparent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
} as const;

const compactInr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const count = new Intl.NumberFormat("en-IN");

/** ₹ axis ticks: exact below ₹1 lakh, compact (₹1.2L, ₹3.4Cr) above. */
export const axisMoney = (paise: number) => (Math.abs(paise) < 10_000_000 ? money(paise) : compactInr.format(paise / 100));
export const formatCount = (n: number) => count.format(n);

// ---------------------------------------------------------------------------
// Plots: sales trend (one measure at a time, never a dual axis) and ranked
// horizontal bars (top products, categories)
// ---------------------------------------------------------------------------

export interface SalesPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface RankedRow {
  name: string;
  revenue: number;
  quantity?: number;
}

// The plots draw with recharts, a large library, so their code (system-chart-plots.tsx)
// is fetched when a plot is first shown rather than with every page that has a chart card.
const plotLoading = () => <div className="skeleton h-72 w-full" aria-hidden="true" />;
export const SalesTrendChart = dynamic(() => import("./system-chart-plots").then((mod) => mod.SalesTrendChart), { ssr: false, loading: plotLoading });
export const RankedBarChart = dynamic(() => import("./system-chart-plots").then((mod) => mod.RankedBarChart), { ssr: false, loading: plotLoading });

// ---------------------------------------------------------------------------
// Frame: a card with a chart / table toggle so every chart has a table view
// ---------------------------------------------------------------------------

export interface ChartTable {
  headers: string[];
  /** Columns at these indexes are right-aligned (numbers). */
  numeric?: number[];
  rows: ReactNode[][];
}

export function ChartCard({ title, subtitle, actions, table, children, className }: { title: string; subtitle?: string; actions?: ReactNode; table?: ChartTable; children: ReactNode; className?: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card
      className={className}
      title={
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink/50">{subtitle}</p>}
        </div>
      }
      actions={
        <>
          {actions}
          {table && table.rows.length > 0 && (
            <button
              type="button"
              onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-ink/50 hover:bg-black/5 hover:text-ink"
              aria-pressed={view === "table"}
              aria-label={view === "chart" ? `Show ${title} as a table` : `Show ${title} as a chart`}
            >
              {view === "chart" ? <Table2 size={13} /> : <BarChart3 size={13} />}
              {view === "chart" ? "Table" : "Chart"}
            </button>
          )}
        </>
      }
    >
      {view === "table" && table ? <MiniTable table={table} /> : children}
    </Card>
  );
}

function MiniTable({ table }: { table: ChartTable }) {
  const num = new Set(table.numeric ?? []);
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
            {table.headers.map((h, i) => (
              <th key={h} className={clsx("px-2 py-2 font-semibold", num.has(i) && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={ri} className="border-b border-black/[0.04] last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className={clsx("px-2 py-2", num.has(ci) && "text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share list: label · value · thin proportional bar (payment methods etc.)
// ---------------------------------------------------------------------------

export function ShareList({ rows, emptyTitle }: { rows: { key: string; label: string; value: number; display: ReactNode; detail?: ReactNode }[]; emptyTitle: string }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!rows.length || total === 0) return <EmptyState title={emptyTitle} />;
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => {
        const share = r.value / total;
        return (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{r.label}</span>
              <span className="shrink-0 tabular-nums">
                {r.display} <span className="text-xs text-ink/45">· {(share * 100).toFixed(share < 0.1 ? 1 : 0)}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]" aria-hidden>
              <div className="h-full rounded-full bg-ink/80" style={{ width: `${Math.max(2, share * 100)}%` }} />
            </div>
            {r.detail && <p className="mt-1 text-xs text-ink/45">{r.detail}</p>}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Stock health meter (status colours, always with icon + label)
// ---------------------------------------------------------------------------

export function StockHealthMeter({ healthy, low, out }: { healthy: number; low: number; out: number }) {
  const total = healthy + low + out;
  if (total === 0) return <EmptyState title="No active variants" />;
  const parts = [
    { key: "healthy", label: "In stock", value: healthy, color: CHART.success, Icon: CheckCircle2 },
    { key: "low", label: "Low stock", value: low, color: CHART.warning, Icon: AlertTriangle },
    { key: "out", label: "Out of stock", value: out, color: CHART.danger, Icon: XCircle },
  ];
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{
                width: `${(p.value / total) * 100}%`,
                minWidth: 4,
                // Amber sits close to both green and red for colour-blind readers: hatch it.
                background: p.key === "low" ? `repeating-linear-gradient(135deg, ${p.color} 0 5px, color-mix(in srgb, var(--color-white) 55%, transparent) 5px 7px), ${p.color}` : p.color,
              }} title={`${p.label}: ${formatCount(p.value)}`} />
          ))}
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-2">
        {parts.map(({ key, label, value, color, Icon }) => (
          <li key={key} className="rounded-xl bg-offwhite px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-ink/55">
              <Icon size={13} style={{ color }} aria-hidden /> {label}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{formatCount(value)}</p>
            <p className="text-[11px] text-ink/45">{((value / total) * 100).toFixed(1)}% of variants</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
