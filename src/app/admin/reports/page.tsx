"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Boxes, FileSpreadsheet, FileText, IndianRupee, Landmark, PackageSearch, Receipt, ShoppingCart, Truck, Undo2, Users, Wallet, ClipboardList, Download, type LucideIcon } from "lucide-react";
import { Can, PageHeader, useListState } from "@/components/admin/page";
import { Button, Card, ErrorState, Field, Input, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { buildQuery, download, errorMessage, api } from "@/lib/api";
import { date, pluralize, titleCase } from "@/lib/format";
import { istDaysAgo, istEndOf, istStartOf, useWarehouseOptions } from "@/components/admin/system-data";
import { ReportTable, type Report } from "@/components/admin/system-report-table";

type Filter = "date" | "channel" | "warehouse";

const REPORT_META: Record<string, { label: string; description: string; icon: LucideIcon; filters: Filter[] }> = {
  sales: { label: "Sales", description: "Daily gross, discounts, GST, shipping, refunds and net revenue", icon: IndianRupee, filters: ["date", "channel"] },
  orders: { label: "Orders", description: "Every order placed in the period with totals and status", icon: ShoppingCart, filters: ["date", "channel"] },
  products: { label: "Product sales", description: "Units, revenue, cost and margin per SKU", icon: PackageSearch, filters: ["date", "channel"] },
  inventory: { label: "Inventory valuation", description: "Stock on hand, reserved and value at cost", icon: Boxes, filters: ["warehouse"] },
  "low-stock": { label: "Low stock", description: "Variants at or below their threshold, and out of stock", icon: Boxes, filters: ["warehouse"] },
  customers: { label: "Customers", description: "Customers with paid orders and net spend in the period", icon: Users, filters: ["date"] },
  refunds: { label: "Refunds", description: "Refunds issued with method, status and gateway reference", icon: Undo2, filters: ["date", "channel"] },
  payments: { label: "Payments", description: "Payments by provider and method, with refunds", icon: Wallet, filters: ["date", "channel"] },
  taxes: { label: "GST summary", description: "HSN-wise taxable value, CGST, SGST and IGST", icon: Landmark, filters: ["date", "channel"] },
  suppliers: { label: "Suppliers", description: "Purchase value and quantities per supplier", icon: Truck, filters: ["date"] },
  purchases: { label: "Purchase orders", description: "Purchase orders raised in the period", icon: ClipboardList, filters: ["date"] },
};
const metaFor = (type: string) => REPORT_META[type] ?? { label: titleCase(type), description: "", icon: Receipt, filters: ["date", "channel", "warehouse"] as Filter[] };

const FORMATS = [
  { format: "csv", ext: "csv", label: "CSV", icon: FileText },
  { format: "xlsx", ext: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { format: "pdf", ext: "pdf", label: "PDF", icon: FileText },
] as const;

export default function ReportsPage() {
  const toast = useToast();
  const { filters, set } = useListState({ type: "sales", from: "", to: "", channel: "", warehouseId: "" });
  const [exporting, setExporting] = useState<string | null>(null);

  const types = useQuery({ queryKey: ["admin", "reports", "types"], queryFn: () => api.get<string[]>("/reports"), staleTime: Infinity });
  const type = types.data && !types.data.includes(filters.type) ? types.data[0]! : filters.type;
  const meta = metaFor(type);
  const usesDate = meta.filters.includes("date");
  const usesChannel = meta.filters.includes("channel");
  const usesWarehouse = meta.filters.includes("warehouse");
  const warehouses = useWarehouseOptions(usesWarehouse);

  const from = filters.from || istDaysAgo(29);
  const to = filters.to || istDaysAgo(0);
  const rangeError = usesDate && from > to ? "Start date must be on or before the end date" : null;

  const params = {
    from: usesDate ? istStartOf(from) : undefined,
    to: usesDate ? istEndOf(to) : undefined,
    channel: usesChannel ? filters.channel || undefined : undefined,
    warehouseId: usesWarehouse ? filters.warehouseId || undefined : undefined,
  };

  const report = useQuery({
    queryKey: ["admin", "report", type, params],
    queryFn: () => api.get<Report>(`/reports/${type}`, params),
    enabled: !!types.data && !rangeError,
    placeholderData: keepPreviousData,
  });

  const exportAs = async (format: (typeof FORMATS)[number]) => {
    setExporting(format.format);
    try {
      const suffix = usesDate ? `${from}-to-${to}` : istDaysAgo(0);
      await download(`/reports/${type}${buildQuery({ ...params, format: format.format })}`, `${type}-${suffix}.${format.ext}`);
      toast(`${meta.label} report downloaded`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setExporting(null);
    }
  };

  const setRange = (days: number) => set({ from: istDaysAgo(days - 1), to: istDaysAgo(0) });
  const r = report.data && report.data.type === type ? report.data : undefined;

  return (
    <>
      <PageHeader title="Reports" description="Preview any report, then export it as CSV, Excel or PDF. Amounts are in ₹, dates in IST." />

      {types.error ? (
        <Card>
          <ErrorState error={types.error} retry={() => types.refetch()} />
        </Card>
      ) : !types.data ? (
        <Spinner />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <nav aria-label="Report types" className="lg:sticky lg:top-20 lg:self-start">
            <div className="lg:hidden">
              <Field label="Report" htmlFor="report-type">
                <Select id="report-type" value={type} onChange={(e) => set({ type: e.target.value })}>
                  {types.data.map((t) => (
                    <option key={t} value={t}>
                      {metaFor(t).label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <ul className="hidden space-y-1 lg:block">
              {types.data.map((t) => {
                const m = metaFor(t);
                const Icon = m.icon;
                const active = t === type;
                return (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => set({ type: t })}
                      aria-current={active ? "page" : undefined}
                      className={clsx("flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition", active ? "bg-white shadow-neu" : "hover:bg-black/[0.03]")}
                    >
                      <Icon size={16} className={clsx("mt-0.5 shrink-0", active ? "text-ink" : "text-ink/45")} />
                      <span className="min-w-0">
                        <span className={clsx("block text-sm font-medium", !active && "text-ink/70")}>{m.label}</span>
                        {active && m.description && <span className="mt-0.5 block text-xs text-ink/50">{m.description}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-wrap items-end gap-4">
                {usesDate && (
                  <>
                    <Field label="From" htmlFor="from" error={rangeError ?? undefined}>
                      <Input id="from" type="date" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} className="w-44" invalid={!!rangeError} />
                    </Field>
                    <Field label="To" htmlFor="to">
                      <Input id="to" type="date" value={to} min={from} max={istDaysAgo(0)} onChange={(e) => e.target.value && set({ to: e.target.value })} className="w-44" />
                    </Field>
                    <div className="flex flex-wrap gap-1 pb-1">
                      {[
                        { days: 7, label: "7d" },
                        { days: 30, label: "30d" },
                        { days: 90, label: "90d" },
                        { days: 365, label: "1y" },
                      ].map((p) => (
                        <Button key={p.days} variant="ghost" size="sm" onClick={() => setRange(p.days)}>
                          {p.label}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
                {usesChannel && (
                  <Field label="Channel" htmlFor="channel">
                    <Select id="channel" value={filters.channel} onChange={(e) => set({ channel: e.target.value })} className="w-40">
                      <option value="">All channels</option>
                      <option value="ONLINE">Online store</option>
                      <option value="POS">In store (POS)</option>
                    </Select>
                  </Field>
                )}
                {usesWarehouse && (
                  <Field label="Warehouse" htmlFor="warehouse" error={warehouses.error ? "Warehouses could not be loaded — showing all" : undefined}>
                    <Select id="warehouse" value={filters.warehouseId} onChange={(e) => set({ warehouseId: e.target.value })} className="w-56" disabled={!warehouses.data}>
                      <option value="">All warehouses</option>
                      {warehouses.data?.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Can permission="reports.export">
                  <div className="ml-auto flex flex-wrap items-center gap-2 pb-0.5">
                    <span className="flex items-center gap-1 text-xs font-semibold text-ink/50">
                      <Download size={13} /> Export
                    </span>
                    {FORMATS.map((f) => (
                      <Button
                        key={f.format}
                        variant="outline"
                        size="sm"
                        icon={<f.icon size={14} />}
                        loading={exporting === f.format}
                        disabled={!!rangeError || (exporting !== null && exporting !== f.format)}
                        onClick={() => exportAs(f)}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </Can>
              </div>
            </Card>

            <Card
              title={
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{r?.title ?? meta.label}</h2>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {r
                      ? `${usesDate ? `${date(r.period.from)} – ${date(r.period.to)} · ` : "Current stock · "}${pluralize(r.rows.length, "row")}${r.rows.length >= 20000 ? " (limit reached — narrow the dates)" : ""}`
                      : meta.description}
                  </p>
                </div>
              }
              actions={report.isFetching && r ? <span className="text-xs text-ink/45">Updating…</span> : undefined}
            >
              {rangeError ? (
                <p className="py-10 text-center text-sm text-ink/55">{rangeError}</p>
              ) : report.error ? (
                <ErrorState error={report.error} retry={() => report.refetch()} />
              ) : !r ? (
                <Spinner label="Running report" />
              ) : (
                <div className={clsx("transition-opacity", report.isPlaceholderData && "opacity-60")}>
                  <ReportTable key={JSON.stringify([type, params])} report={r} />
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
