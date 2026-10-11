"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  Clock,
  IndianRupee,
  Package,
  PackageCheck,
  PackageX,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Truck,
  Undo2,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page";
import { ADMIN_NAV } from "@/components/admin/nav";
import { Badge, Button, Card, ErrorState, Spinner, Stat, StatusBadge, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, money, pluralize, titleCase } from "@/lib/format";
import { CHART, ChartCard, formatCount, RankedBarChart, SalesTrendChart, ShareList, StockHealthMeter, type SalesPoint } from "./system-charts";

interface DashboardSummary {
  totalSales: number;
  todaySales: number;
  monthSales: number;
  totalOrders: number;
  pendingOrders: number;
  awaitingPayment: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnRequests: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  inventoryValue: number;
  refunds: { count: number; amount: number };
  paymentStatus: Record<string, number>;
}

type Range = "7d" | "30d" | "90d" | "12m";

interface DashboardCharts {
  range: Range;
  sales: SalesPoint[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  categorySales: { name: string; revenue: number }[];
  paymentMethods: { method: string; count: number; amount: number }[];
  inventoryStatus: { low: number; out: number; healthy: number };
}

const RANGES: { value: Range; label: string; long: string }[] = [
  { value: "7d", label: "7 days", long: "the last 7 days" },
  { value: "30d", label: "30 days", long: "the last 30 days" },
  { value: "90d", label: "90 days", long: "the last 90 days" },
  { value: "12m", label: "12 months", long: "the last 12 months" },
];

const METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet",
  emi: "EMI",
  CASH: "Cash",
  UPI_MANUAL: "UPI (in store)",
  CARD_MANUAL: "Card (in store)",
  RAZORPAY: "Razorpay",
  MOCK: "Test payments",
};
const methodLabel = (m: string) => METHOD_LABELS[m] ?? titleCase(m);

/** Stat tile that links to the relevant module when the user can open it. */
function LinkedStat({ href, permission, ...stat }: { href?: string; permission?: string; label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  const { can } = useAuth();
  if (!href || (permission && !can(permission))) return <Stat {...stat} />;
  return (
    <Link href={href} className="block rounded-2xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30">
      <Stat {...stat} />
    </Link>
  );
}

function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3 first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-ink/45">{children}</h2>
      {actions}
    </div>
  );
}

export function DashboardOverview() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("30d");
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");

  const summary = useQuery({ queryKey: ["admin", "dashboard", "summary"], queryFn: () => api.get<DashboardSummary>("/dashboard/summary"), refetchInterval: 60_000 });
  const charts = useQuery({
    queryKey: ["admin", "dashboard", "charts", range],
    queryFn: () => api.get<DashboardCharts>("/dashboard/charts", { range }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    void summary.refetch();
    void charts.refetch();
  };

  const s = summary.data;
  const c = charts.data;
  const rangeLong = RANGES.find((r) => r.value === range)!.long;
  const firstName = user?.name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${firstName ? `Welcome back, ${firstName}. ` : ""}Sales are net of refunds and counted on paid orders (IST).`}
        actions={
          <>
            {summary.dataUpdatedAt > 0 && <span className="text-xs text-ink/45">Updated {dateTime(new Date(summary.dataUpdatedAt))}</span>}
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} className={summary.isFetching || charts.isFetching ? "animate-spin" : undefined} />} onClick={refresh}>
              Refresh
            </Button>
          </>
        }
      />

      {summary.error ? (
        <Card>
          <ErrorState error={summary.error} retry={() => summary.refetch()} />
        </Card>
      ) : !s ? (
        <Spinner label="Loading dashboard" />
      ) : (
        <>
          <SectionTitle>Sales</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Today's sales" value={money(s.todaySales)} hint="Since midnight IST" icon={<IndianRupee size={18} />} />
            <Stat label="This month" value={money(s.monthSales)} hint="Month to date" icon={<CalendarDays size={18} />} />
            <Stat label="All-time net sales" value={money(s.totalSales)} hint="After refunds" icon={<CircleDollarSign size={18} />} />
            <LinkedStat href="/admin/orders?paymentStatus=PAID" permission="orders.read" label="Paid orders" value={formatCount(s.totalOrders)} hint="All time" icon={<ShoppingBag size={18} />} />
          </div>

          <SectionTitle>Orders</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <LinkedStat href="/admin/orders" permission="orders.read" label="To fulfil" value={formatCount(s.pendingOrders)} hint="Confirmed, processing or packed" icon={<Truck size={18} />} />
            <LinkedStat href="/admin/orders?status=PENDING" permission="orders.read" label="Awaiting payment" value={formatCount(s.awaitingPayment)} hint="Placed, not yet paid" icon={<Clock size={18} />} />
            <LinkedStat href="/admin/orders?status=DELIVERED" permission="orders.read" label="Delivered" value={formatCount(s.deliveredOrders)} icon={<PackageCheck size={18} />} />
            <LinkedStat href="/admin/orders?status=CANCELLED" permission="orders.read" label="Cancelled" value={formatCount(s.cancelledOrders)} icon={<XCircle size={18} />} />
            <LinkedStat href="/admin/returns?status=REQUESTED" permission="returns.read" label="Return requests" value={formatCount(s.returnRequests)} hint="Waiting for review" icon={<RotateCcw size={18} />} />
          </div>

          <SectionTitle>Customers, catalogue and stock</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <LinkedStat href="/admin/customers" permission="customers.read" label="Customers" value={formatCount(s.totalCustomers)} hint="Registered accounts" icon={<Users size={18} />} />
            <LinkedStat href="/admin/products?status=ACTIVE" permission="products.read" label="Active products" value={formatCount(s.totalProducts)} icon={<Package size={18} />} />
            <LinkedStat href="/admin/inventory" permission="inventory.read" label="Inventory value" value={money(s.inventoryValue)} hint="On hand × cost price" icon={<Boxes size={18} />} />
            <LinkedStat
              href="/admin/inventory?status=low"
              permission="inventory.read"
              label="Low-stock variants"
              value={formatCount(s.lowStockProducts)}
              hint={s.lowStockProducts > 0 ? "At or below the reorder threshold" : "All above threshold"}
              icon={<AlertTriangle size={18} className={s.lowStockProducts > 0 ? "text-warning" : undefined} />}
            />
            <LinkedStat
              href="/admin/inventory?status=out"
              permission="inventory.read"
              label="Out-of-stock variants"
              value={formatCount(s.outOfStockProducts)}
              hint={s.outOfStockProducts > 0 ? "Not sellable online" : "Everything is in stock"}
              icon={<PackageX size={18} className={s.outOfStockProducts > 0 ? "text-danger" : undefined} />}
            />
            <LinkedStat
              href="/admin/refunds"
              permission="refunds.read"
              label="Refunds"
              value={money(s.refunds.amount)}
              hint={`${pluralize(s.refunds.count, "refund")} processed or in progress`}
              icon={<Undo2 size={18} />}
            />
          </div>
        </>
      )}

      <SectionTitle actions={<Tabs value={range} onChange={setRange} tabs={RANGES.map((r) => ({ value: r.value, label: r.label }))} />}>Performance</SectionTitle>
      {charts.error ? (
        <Card>
          <ErrorState error={charts.error} retry={() => charts.refetch()} />
        </Card>
      ) : !c ? (
        <Spinner label="Loading charts" />
      ) : (
        <div className={charts.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={charts.isPlaceholderData}>
          <ChartCard
            title={metric === "revenue" ? "Revenue" : "Paid orders"}
            subtitle={`${range === "12m" ? "Monthly" : "Daily"} totals for ${rangeLong} · ${money(c.sales.reduce((a, p) => a + p.revenue, 0))} from ${pluralize(
              c.sales.reduce((a, p) => a + p.orders, 0),
              "order",
            )}`}
            actions={
              <Tabs
                value={metric}
                onChange={setMetric}
                tabs={[
                  { value: "revenue", label: "Revenue" },
                  { value: "orders", label: "Orders" },
                ]}
              />
            }
            table={{
              headers: [range === "12m" ? "Month" : "Date", "Revenue", "Orders"],
              numeric: [1, 2],
              rows: [...c.sales].reverse().map((p) => [p.date.slice(0, range === "12m" ? 7 : 10), money(p.revenue), formatCount(p.orders)]),
            }}
          >
            <SalesTrendChart data={c.sales} monthly={range === "12m"} metric={metric} />
          </ChartCard>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Top products"
              subtitle={`By revenue, ${rangeLong}`}
              table={{ headers: ["Product", "Units", "Revenue"], numeric: [1, 2], rows: c.topProducts.map((p) => [p.name, formatCount(p.quantity), money(p.revenue)]) }}
            >
              <RankedBarChart data={c.topProducts} emptyTitle="No product sales in this period" label="Top products by revenue" />
            </ChartCard>
            <ChartCard
              title="Sales by category"
              subtitle={`Top-level categories, ${rangeLong}`}
              table={{ headers: ["Category", "Revenue"], numeric: [1], rows: c.categorySales.map((r) => [r.name, money(r.revenue)]) }}
            >
              <RankedBarChart data={c.categorySales.slice(0, 10)} color={CHART.inkSoft} emptyTitle="No category sales in this period" label="Revenue by category" />
            </ChartCard>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <ChartCard title="Payment methods" subtitle={`Captured payments, ${rangeLong}`}>
              <ShareList
                emptyTitle="No payments in this period"
                rows={c.paymentMethods.map((m) => ({ key: m.method, label: methodLabel(m.method), value: m.amount, display: money(m.amount), detail: pluralize(m.count, "payment") }))}
              />
            </ChartCard>
            <Card
              title={
                <div>
                  <h2 className="text-sm font-semibold">Payment status</h2>
                  <p className="mt-0.5 text-xs text-ink/50">All orders, current status</p>
                </div>
              }
            >
              {s && Object.keys(s.paymentStatus).length ? (
                <ul className="divide-y divide-black/[0.05]">
                  {Object.entries(s.paymentStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, n]) => (
                      <li key={status} className="flex items-center justify-between py-2 text-sm">
                        <StatusBadge status={status} />
                        <span className="font-semibold tabular-nums">{formatCount(n)}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-ink/50">No orders yet</p>
              )}
            </Card>
            <ChartCard title="Stock health" subtitle="Active variants, all warehouses">
              <StockHealthMeter healthy={c.inventoryStatus.healthy} low={c.inventoryStatus.low} out={c.inventoryStatus.out} />
            </ChartCard>
          </div>
        </div>
      )}
    </>
  );
}

/** Shown to staff without dashboard.read: links to the modules they can use. */
export function WelcomePanel() {
  const { user, can } = useAuth();
  const groups = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== "/admin" && i.any.some((p) => can(p))) })).filter((g) => g.items.length);
  const firstName = user?.name?.split(" ")[0];
  return (
    <>
      <PageHeader title={firstName ? `Hi ${firstName}` : "Welcome"} description="Here is everything your role gives you access to." />
      {groups.length === 0 ? (
        <Card>
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold">You don&apos;t have access to any admin modules yet</p>
            <p className="mt-1 text-sm text-ink/55">Ask an administrator to assign a role to your account.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {can("pos.use") && (
            <Link href="/pos" className="card flex items-center justify-between gap-4 bg-ink p-5 text-white transition hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <Wallet size={20} />
                <div>
                  <p className="font-semibold">Billing / POS</p>
                  <p className="text-sm text-white/65">Scan products and bill walk-in customers</p>
                </div>
              </div>
              <ArrowRight size={18} />
            </Link>
          )}
          {groups.map((g) => (
            <section key={g.group}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink/45">{g.group}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {g.items.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-neu-lg">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-offwhite text-ink/70">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 text-sm font-semibold">{label}</span>
                    <ArrowRight size={15} className="text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {user?.roles.length ? (
            <p className="text-xs text-ink/45">
              Your roles:{" "}
              {user.roles.map((r) => (
                <Badge key={r} className="mr-1">
                  {titleCase(r)}
                </Badge>
              ))}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
