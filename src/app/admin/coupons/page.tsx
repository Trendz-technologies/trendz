"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { Can, PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { CouponFormModal } from "@/components/admin/sales-coupon-form";
import { ChannelBadge, FilterBar, FilterSelect, promoState, promoValue } from "@/components/admin/sales-shared";
import type { CouponRow } from "@/components/admin/sales-types";
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Pagination } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date, money } from "@/lib/format";

const DEFAULTS = { q: "", active: "" };
const SCOPE_LABEL = { ALL: "Whole order", PRODUCTS: "Selected products", CATEGORIES: "Selected categories" } as const;

export default function CouponsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [deleting, setDeleting] = useState<CouponRow | null>(null);
  const q = useQuery({
    queryKey: ["admin", "coupons", page, filters],
    queryFn: () => api.page<CouponRow[]>("/coupons", { page, limit: 25, q: filters.q, active: filters.active }),
    placeholderData: keepPreviousData,
  });
  const filtered = Object.values(filters).some(Boolean);

  const remove = useMutation({
    mutationFn: (c: CouponRow) => api.delete<{ deleted: boolean; deactivated: boolean }>(`/coupons/${c.id}`),
    onSuccess: (r, c) => {
      void qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
      setDeleting(null);
      toast(r.deactivated ? `${c.code} has been used, so it was deactivated instead of deleted` : `${c.code} deleted`, r.deactivated ? "info" : "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Codes customers enter at checkout or the cashier applies at the POS."
        actions={
          <Can permission="coupons.write">
            <Button icon={<Plus size={15} />} onClick={() => setEditing("new")}>
              New coupon
            </Button>
          </Can>
        }
      />
      <Card>
        <FilterBar active={filtered} onClear={() => set(DEFAULTS)}>
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Search by code" />
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
            rowKey={(c) => c.id}
            empty={
              <EmptyState
                icon={<Tag size={22} />}
                title={filtered ? "No coupons match these filters" : "No coupons yet"}
                action={
                  !filtered && (
                    <Can permission="coupons.write">
                      <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing("new")}>
                        Create a coupon
                      </Button>
                    </Can>
                  )
                }
              />
            }
            columns={[
              {
                key: "code",
                header: "Code",
                cell: (c) => (
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold">{c.code}</p>
                    {c.description && <p className="max-w-56 truncate text-xs text-ink/50">{c.description}</p>}
                  </div>
                ),
              },
              {
                key: "value",
                header: "Discount",
                cell: (c) => (
                  <div>
                    <p className="font-medium">{promoValue(c)}</p>
                    {c.minOrderAmount ? <p className="text-xs text-ink/50">on {money(c.minOrderAmount)}+</p> : null}
                  </div>
                ),
              },
              {
                key: "applies",
                header: "Applies to",
                cell: (c) => (
                  <div className="space-y-1">
                    <p className="text-xs text-ink/70">{SCOPE_LABEL[c.scope]}</p>
                    <ChannelBadge channel={c.channel} />
                  </div>
                ),
              },
              {
                key: "window",
                header: "Valid",
                cell: (c) => (
                  <span className="whitespace-nowrap text-xs text-ink/70">
                    {c.startsAt ? date(c.startsAt) : "Now"} → {c.expiresAt ? date(c.expiresAt) : "no expiry"}
                  </span>
                ),
              },
              {
                key: "usage",
                header: "Redemptions",
                align: "right",
                cell: (c) => (
                  <div>
                    <p className="font-medium">
                      {c.redemptions}
                      {c.usageLimit != null && <span className="text-ink/45"> / {c.usageLimit}</span>}
                    </p>
                    {c.perUserLimit != null && <p className="text-[11px] text-ink/45">{c.perUserLimit} per customer</p>}
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (c) => {
                  const s = promoState({ isActive: c.isActive, startsAt: c.startsAt, endsAt: c.expiresAt });
                  const exhausted = c.isActive && c.usageLimit != null && c.redemptions >= c.usageLimit;
                  return (
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={exhausted ? "neutral" : s.tone}>{exhausted ? "Used up" : s.label}</Badge>
                      {c.isPublic && <Badge tone="info">Public</Badge>}
                    </div>
                  );
                },
              },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (c) => (
                  <Can permission="coupons.write">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${c.code}`} icon={<Pencil size={14} />} onClick={() => setEditing(c.id)} />
                      <Button variant="ghost" size="sm" aria-label={`Delete ${c.code}`} icon={<Trash2 size={14} />} onClick={() => setDeleting(c)} />
                    </div>
                  </Can>
                ),
              },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>

      {editing && <CouponFormModal couponId={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.code ?? "coupon"}?`}
        body={
          deleting && deleting.redemptions > 0
            ? `This coupon has been used ${deleting.redemptions} time(s). To keep order history intact it will be deactivated instead of deleted.`
            : "The coupon is removed permanently. Customers can no longer use the code."
        }
        confirmLabel={deleting && deleting.redemptions > 0 ? "Deactivate" : "Delete"}
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
