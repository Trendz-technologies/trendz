"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button, EmptyState, StatusBadge } from "@/components/ui";
import { date, money } from "@/lib/format";

export type ReportColumnType = "text" | "money" | "number" | "date" | "percent";

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
}

export interface Report {
  type: string;
  title: string;
  period: { from: string; to: string };
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
}

const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const isNumeric = (t: ReportColumnType) => t === "money" || t === "number" || t === "percent";
const PAGE = 100;

export function formatReportCell(value: unknown, column: ReportColumn) {
  if (value === null || value === undefined || value === "") return <span className="text-ink/30">—</span>;
  switch (column.type) {
    case "money":
      return money(Number(value));
    case "number":
      return num.format(Number(value));
    case "percent":
      return `${num.format(Number(value))}%`;
    case "date":
      return date(String(value));
    default: {
      const s = String(value);
      // Enum-like status columns read better as badges.
      if (/status$/i.test(column.key) && /^[A-Z_]+$/.test(s)) return <StatusBadge status={s} />;
      return s;
    }
  }
}

function compare(a: unknown, b: unknown, type: ReportColumnType) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (isNumeric(type)) return Number(a) - Number(b);
  if (type === "date") return new Date(String(a)).getTime() - new Date(String(b)).getTime();
  return String(a).localeCompare(String(b), "en-IN", { numeric: true, sensitivity: "base" });
}

/**
 * Report preview: formats each cell by column type, sorts on header click,
 * shows rows in pages of 100 and pins a totals row at the bottom.
 */
export function ReportTable({ report }: { report: Report }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [visible, setVisible] = useState(PAGE);

  const rows = useMemo(() => {
    if (!sort) return report.rows;
    const col = report.columns.find((c) => c.key === sort.key);
    if (!col) return report.rows;
    return [...report.rows].sort((a, b) => compare(a[sort.key], b[sort.key], col.type) * sort.dir);
  }, [report, sort]);

  if (!report.rows.length) return <EmptyState title="No data for these filters" body="Try a wider date range or a different channel." />;

  const toggleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));

  const totals = report.totals;
  const hasTotals = !!totals && Object.keys(totals).length > 0;

  return (
    <div>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
              {report.columns.map((c) => {
                const active = sort?.key === c.key;
                const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                    className={clsx("whitespace-nowrap px-5 py-2.5 font-semibold", isNumeric(c.type) && "text-right")}
                  >
                    <button type="button" onClick={() => toggleSort(c.key)} className={clsx("inline-flex items-center gap-1 uppercase hover:text-ink", active && "text-ink")}>
                      {c.label}
                      <Icon size={11} className={active ? "opacity-100" : "opacity-40"} aria-hidden />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, visible).map((row, i) => (
              <tr key={i} className="border-b border-black/[0.04] hover:bg-black/[0.015]">
                {report.columns.map((c) => (
                  <td key={c.key} className={clsx("whitespace-nowrap px-5 py-2.5", isNumeric(c.type) && "text-right tabular-nums")}>
                    {formatReportCell(row[c.key], c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {hasTotals && (
            <tfoot>
              <tr className="border-t-2 border-ink/15 bg-offwhite/70 font-semibold">
                {report.columns.map((c, i) => (
                  <td key={c.key} className={clsx("whitespace-nowrap px-5 py-3", isNumeric(c.type) && "text-right tabular-nums")}>
                    {totals[c.key] !== undefined ? formatReportCell(totals[c.key], c) : i === 0 ? `Total${rows.length > visible ? " (all rows)" : ""}` : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length > visible && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-ink/55">
          <span>
            Showing {visible.toLocaleString("en-IN")} of {rows.length.toLocaleString("en-IN")} rows. Export for the complete report.
          </span>
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE * 5)}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
