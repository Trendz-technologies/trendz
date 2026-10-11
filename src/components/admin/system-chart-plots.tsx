"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { EmptyState } from "@/components/ui";
import { money } from "@/lib/format";
import { axisMoney, CHART, formatCount, type RankedRow, type SalesPoint } from "./system-charts";

/*
 * The plots of the admin charts. They are the only users of recharts, a large
 * library, so they live apart from system-charts.tsx, which loads this file
 * when a plot is first shown.
 */

const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
const longDayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const longMonthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** Dates from the chart API are IST calendar days ("YYYY-MM-DD"); format them as-is. */
const parseDay = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`);

const axisTick = { fontSize: 11, fill: CHART.axis };

function TooltipBox({ title, lines }: { title: ReactNode; lines: { label: string; value: ReactNode; swatch?: string }[] }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-neu-lg ring-1 ring-black/5">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {lines.map((l) => (
        <p key={l.label} className="flex items-center justify-between gap-4 text-ink/60">
          <span className="flex items-center gap-1.5">
            {l.swatch && <span className="h-2 w-2 rounded-full" style={{ background: l.swatch }} />}
            {l.label}
          </span>
          <span className="font-semibold tabular-nums text-ink">{l.value}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sales trend (one measure at a time — never a dual axis)
// ---------------------------------------------------------------------------

export function SalesTrendChart({ data, monthly, metric }: { data: SalesPoint[]; monthly: boolean; metric: "revenue" | "orders" }) {
  const empty = data.every((d) => d.revenue === 0 && d.orders === 0);
  if (!data.length || empty) return <EmptyState title="No paid orders in this period" body="Sales will appear here once orders are paid." />;
  const tickFmt = (d: string) => (monthly ? monthFmt : dayFmt).format(parseDay(d));
  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]!.payload as SalesPoint;
    return (
      <TooltipBox
        title={(monthly ? longMonthFmt : longDayFmt).format(parseDay(p.date))}
        lines={[
          { label: "Revenue", value: money(p.revenue), swatch: metric === "revenue" ? CHART.accent : undefined },
          { label: "Paid orders", value: formatCount(p.orders), swatch: metric === "orders" ? CHART.accent : undefined },
        ]}
      />
    );
  };
  return (
    <div className="h-72 w-full" role="figure" aria-label={`${metric === "revenue" ? "Revenue" : "Paid orders"} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="salesWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.16} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="date" tickFormatter={tickFmt} tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={24} />
          <YAxis
            tickFormatter={(v: number) => (metric === "revenue" ? axisMoney(v) : formatCount(v))}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={metric === "revenue" ? 76 : 40}
            allowDecimals={false}
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: CHART.crosshair, strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey={metric}
            name={metric === "revenue" ? "Revenue" : "Paid orders"}
            stroke={CHART.accent}
            strokeWidth={2}
            fill="url(#salesWash)"
            dot={false}
            activeDot={{ r: 4, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranked horizontal bars (top products, categories)
// ---------------------------------------------------------------------------

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function RankedBarChart({ data, color = CHART.ink, emptyTitle, label }: { data: RankedRow[]; color?: string; emptyTitle: string; label: string }) {
  if (!data.length) return <EmptyState title={emptyTitle} />;
  const height = Math.max(160, data.length * 34 + 32);
  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const r = payload[0]!.payload as RankedRow;
    return (
      <TooltipBox
        title={r.name}
        lines={[{ label: "Revenue", value: money(r.revenue), swatch: color }, ...(r.quantity != null ? [{ label: "Units sold", value: formatCount(r.quantity) }] : [])]}
      />
    );
  };
  return (
    <div className="w-full" style={{ height }} role="figure" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" tickFormatter={axisMoney} tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} />
          <YAxis type="category" dataKey="name" width={132} tick={{ ...axisTick, fill: CHART.inkSoft }} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncate(v, 20)} interval={0} />
          <Tooltip content={renderTooltip} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="revenue" name="Revenue" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
