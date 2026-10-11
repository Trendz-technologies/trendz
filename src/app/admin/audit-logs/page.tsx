"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ScrollText, X } from "lucide-react";
import { PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { Button, Card, EmptyState, ErrorState, Field, Input, Pagination, Select, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { isUuid, istEndOf, istStartOf } from "@/components/admin/system-data";
import { AuditTable, type AuditLogRow } from "@/components/admin/system-audit";

const ENTITY_TYPES = [
  "brand",
  "category",
  "coupon",
  "discount",
  "invoice",
  "notification",
  "order",
  "payment",
  "pos_cart",
  "product",
  "product_code",
  "product_variant",
  "purchase_order",
  "refund",
  "report",
  "return_request",
  "role",
  "setting",
  "shipment",
  "stock_adjustment",
  "stock_transfer",
  "supplier",
  "tax_class",
  "user",
  "warehouse",
];

const DEFAULTS = { action: "", entityType: "", entityId: "", userId: "", from: "", to: "" };

export default function AuditLogsPage() {
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const userIdError = filters.userId && !isUuid(filters.userId) ? "Enter a full user ID (UUID)" : null;
  const rangeError = filters.from && filters.to && filters.from > filters.to ? "Start date must be on or before the end date" : null;
  const active = Object.entries(filters).filter(([, v]) => v !== "").length;

  const q = useQuery({
    queryKey: ["admin", "audit-logs", page, filters],
    queryFn: () =>
      api.page<AuditLogRow[]>("/audit-logs", {
        page,
        limit: 25,
        action: filters.action.trim(),
        entityType: filters.entityType,
        entityId: filters.entityId.trim(),
        userId: filters.userId.trim(),
        from: filters.from ? istStartOf(filters.from) : undefined,
        to: filters.to ? istEndOf(filters.to) : undefined,
      }),
    enabled: !userIdError && !rangeError,
    placeholderData: keepPreviousData,
  });

  const entityTypes = filters.entityType && !ENTITY_TYPES.includes(filters.entityType) ? [filters.entityType, ...ENTITY_TYPES] : ENTITY_TYPES;

  return (
    <>
      <PageHeader title="Audit logs" description="Every change to money, stock, settings and access — who made it, when, from where, and what changed." />
      <Card>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Field label="Action starts with">
            <SearchInput value={filters.action} onChange={(v) => set({ action: v })} placeholder="e.g. order. or settings.update" className="w-full" />
          </Field>
          <Field label="Entity type" htmlFor="entityType">
            <Select id="entityType" value={filters.entityType} onChange={(e) => set({ entityType: e.target.value })}>
              <option value="">Any entity</option>
              {entityTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Entity ID">
            <SearchInput value={filters.entityId} onChange={(v) => set({ entityId: v })} placeholder="ID or key" className="w-full" />
          </Field>
          <Field label="User ID" error={userIdError ?? undefined}>
            <SearchInput value={filters.userId} onChange={(v) => set({ userId: v })} placeholder="User UUID" className="w-full" />
          </Field>
          <Field label="From" htmlFor="from" error={rangeError ?? undefined}>
            <Input id="from" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} invalid={!!rangeError} />
          </Field>
          <Field label="To" htmlFor="to">
            <Input id="to" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
          </Field>
        </div>
        {active > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 text-sm text-ink/55">
            <span>
              {q.data ? `${q.data.meta.total.toLocaleString("en-IN")} matching entries` : "Filtering…"} · {active} filter{active > 1 ? "s" : ""}
            </span>
            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => set(DEFAULTS)}>
              Clear filters
            </Button>
          </div>
        )}
        {userIdError || rangeError ? (
          <p className="py-10 text-center text-sm text-ink/55">{userIdError ?? rangeError}</p>
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !q.data ? (
          <Spinner />
        ) : q.data.data.length === 0 ? (
          <EmptyState icon={<ScrollText size={22} />} title="No audit entries" body={active ? "Nothing matches these filters." : "Changes will be recorded here."} />
        ) : (
          <div className={q.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <AuditTable rows={q.data.data} onFilter={(f) => set(f)} />
          </div>
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
