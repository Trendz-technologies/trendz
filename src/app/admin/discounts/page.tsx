"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Pencil, Plus, Trash2 } from "lucide-react";
import { Can, PageHeader, useListState } from "@/components/admin/page";
import { DiscountFormModal } from "@/components/admin/sales-discount-form";
import { ChannelBadge, FilterBar, FilterSelect, Notice, promoState } from "@/components/admin/sales-shared";
import type { DiscountRow } from "@/components/admin/sales-types";
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Pagination } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date, money, percent, pluralize } from "@/lib/format";
import { plainText } from "@/lib/rich-text";

const DEFAULTS = { active: "" };
const SCOPE_NOUN = { PRODUCTS: "product", CATEGORIES: "category", BRANDS: "brand" } as const;

export default function DiscountsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [deleting, setDeleting] = useState<DiscountRow | null>(null);
  const q = useQuery({
    queryKey: ["admin", "discounts", page, filters],
    queryFn: () => api.page<DiscountRow[]>("/discounts", { page, limit: 25, active: filters.active }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (d: DiscountRow) => api.delete<{ deleted: boolean }>(`/discounts/${d.id}`),
    onSuccess: (_r, d) => {
      void qc.invalidateQueries({ queryKey: ["admin", "discounts"] });
      setDeleting(null);
      toast(`${d.name} deleted`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <>
      <PageHeader
        title="Automatic discounts"
        description="Price reductions applied without a code — sales, category offers and brand promotions."
        actions={
          <Can permission="discounts.write">
            <Button icon={<Plus size={15} />} onClick={() => setEditing("new")}>
              New discount
            </Button>
          </Can>
        }
      />
      <Notice className="mb-6">
        For each item, only the <strong>single best</strong> live automatic discount applies — discounts never stack with each other (priority breaks ties). A coupon can then apply on top, unless coupons are set not to combine with automatic discounts in Settings.
      </Notice>
      <Card>
        <FilterBar active={!!filters.active} onClear={() => set(DEFAULTS)}>
          <FilterSelect
            label="Active"
            allLabel="Active and inactive"
            value={filters.active}
            onChange={(v) => set({ active: v })}
            options={[
              { value: "true", label: "Active only" },
              { value: "false", label: "Inactive only" },
            ]}
          />
        </FilterBar>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(d) => d.id}
            empty={
              <EmptyState
                icon={<BadgePercent size={22} />}
                title={filters.active ? "No discounts match this filter" : "No automatic discounts yet"}
                action={
                  !filters.active && (
                    <Can permission="discounts.write">
                      <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing("new")}>
                        Create a discount
                      </Button>
                    </Can>
                  )
                }
              />
            }
            columns={[
              {
                key: "name",
                header: "Discount",
                cell: (d) => (
                  <div className="min-w-0">
                    <p className="font-medium">{d.name}</p>
                    {d.description && <p className="max-w-64 truncate text-xs text-ink/50">{plainText(d.description)}</p>}
                  </div>
                ),
              },
              { key: "value", header: "Value", cell: (d) => <span className="font-medium">{d.discountType === "PERCENTAGE" ? `${percent(d.value)} off` : `${money(d.value)} off each unit`}</span> },
              {
                key: "applies",
                header: "Applies to",
                cell: (d) => (
                  <div className="space-y-1">
                    <p className="text-xs text-ink/70">{d.scope === "ALL" ? "All products" : pluralize(d._count.targets, SCOPE_NOUN[d.scope], d.scope === "CATEGORIES" ? "categories" : undefined)}</p>
                    <ChannelBadge channel={d.channel} />
                  </div>
                ),
              },
              {
                key: "window",
                header: "Runs",
                cell: (d) => (
                  <span className="whitespace-nowrap text-xs text-ink/70">
                    {d.startsAt ? date(d.startsAt) : "Now"} → {d.endsAt ? date(d.endsAt) : "no end"}
                  </span>
                ),
              },
              { key: "priority", header: "Priority", align: "right", cell: (d) => d.priority },
              {
                key: "status",
                header: "Status",
                cell: (d) => {
                  const s = promoState(d);
                  return <Badge tone={s.tone}>{s.label}</Badge>;
                },
              },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (d) => (
                  <Can permission="discounts.write">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${d.name}`} icon={<Pencil size={14} />} onClick={() => setEditing(d.id)} />
                      <Button variant="ghost" size="sm" aria-label={`Delete ${d.name}`} icon={<Trash2 size={14} />} onClick={() => setDeleting(d)} />
                    </div>
                  </Can>
                ),
              },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>

      {editing && <DiscountFormModal discountId={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? "discount"}?`}
        body="Prices go back to normal immediately. Orders already placed keep their discount. To pause it instead, edit it and untick Active."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
