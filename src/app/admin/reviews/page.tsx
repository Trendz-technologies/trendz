"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Star, Trash2, X } from "lucide-react";
import { PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { FilterBar, FilterSelect, RowLink } from "@/components/admin/sales-shared";
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Modal, Pagination, Tabs, Textarea, type Tone } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime } from "@/lib/format";
import type { PublicReview, ReviewProduct, ReviewStatus } from "@/lib/reviews";
import { refreshProductReviews } from "./actions";

/** A review as the moderation API returns it. */
interface ReviewRow extends PublicReview {
  status: ReviewStatus;
  updatedAt: string;
  moderatedAt: string | null;
  moderationNote: string | null;
  product: ReviewProduct;
  customer: { id: string; email: string | null; phone: string | null };
  order: { id: string; orderNumber: string; deliveredAt: string | null } | null;
}

type Counts = Record<ReviewStatus, number>;
type Tab = ReviewStatus | "ALL";

const DEFAULTS = { status: "PENDING", rating: "", q: "" };
const STATUS: Record<ReviewStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Waiting", tone: "warning" },
  PUBLISHED: { label: "Published", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};
const RATINGS = [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "star" : "stars"}` }));

function StarRow({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="inline-flex text-ink/15">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} strokeWidth={0} fill="currentColor" className={n <= rating ? "text-gold" : undefined} aria-hidden="true" />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const { can } = useAuth();
  const canModerate = can("reviews.moderate");
  const toast = useToast();
  const qc = useQueryClient();
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const tab = (["PENDING", "PUBLISHED", "REJECTED", "ALL"] as const).includes(filters.status as Tab) ? (filters.status as Tab) : "PENDING";

  const q = useQuery({
    queryKey: ["admin", "reviews", page, filters],
    queryFn: () => api.page<ReviewRow[]>("/reviews", { page, limit: 20, status: tab === "ALL" ? undefined : tab, rating: filters.rating, q: filters.q }),
    placeholderData: keepPreviousData,
  });
  const counts = q.data?.meta.counts as Counts | undefined;

  const [rejecting, setRejecting] = useState<ReviewRow | null>(null);
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState<ReviewRow | null>(null);
  /** Reloads the list, and drops the product page's cached reviews so the storefront shows the change at once. */
  const refresh = (slug: string) => {
    void refreshProductReviews(slug).catch(() => false);
    return qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
  };

  const moderate = useMutation({
    mutationFn: (v: { id: string; slug: string; action: "publish" | "reject"; note?: string }) => api.post(`/reviews/${v.id}/moderate`, { action: v.action, note: v.note || null }),
    onSuccess: (_, v) => {
      void refresh(v.slug);
      toast(v.action === "publish" ? "Review published. The customer has been told." : "Review rejected. The customer has been told.");
      setRejecting(null);
      setNote("");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const remove = useMutation({
    mutationFn: (v: { id: string; slug: string }) => api.delete(`/reviews/${v.id}`),
    onSuccess: (_, v) => {
      void refresh(v.slug);
      toast("Review deleted");
      setDeleting(null);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const tabLabel = (status: ReviewStatus) => (
    <>
      {STATUS[status].label}
      {counts && counts[status] > 0 && <span className="ml-1.5 tabular-nums text-ink/45">{counts[status]}</span>}
    </>
  );

  return (
    <>
      <PageHeader
        title="Reviews"
        description={
          <>
            What customers say about products they received. Whether a review needs approval before it shows is set in{" "}
            <Link href="/admin/settings?group=reviews" className="link">
              Settings → Reviews
            </Link>
            .
          </>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tabs<Tab>
            value={tab}
            onChange={(status) => set({ status })}
            tabs={[
              { value: "PENDING", label: tabLabel("PENDING") },
              { value: "PUBLISHED", label: tabLabel("PUBLISHED") },
              { value: "REJECTED", label: tabLabel("REJECTED") },
              { value: "ALL", label: "All" },
            ]}
          />
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Search text, customer or product…" className="ml-auto w-full sm:w-72" />
        </div>
        <FilterBar active={!!filters.rating || !!filters.q} onClear={() => set({ rating: "", q: "" })}>
          <FilterSelect label="Rating" allLabel="Any rating" value={filters.rating} onChange={(v) => set({ rating: v })} options={RATINGS} />
        </FilterBar>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                icon={<Star size={22} />}
                title={tab === "PENDING" && !filters.q && !filters.rating ? "No reviews are waiting" : "No reviews match"}
                body={tab === "PENDING" && !filters.q && !filters.rating ? "New reviews from customers appear here." : undefined}
              />
            }
            columns={[
              {
                key: "review",
                header: "Review",
                cell: (r) => (
                  <div className="max-w-xl py-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <StarRow rating={r.rating} />
                      {r.title && <span className="font-semibold">{r.title}</span>}
                    </div>
                    {r.comment ? <p className="mt-1 whitespace-pre-line text-sm text-ink/75">{r.comment}</p> : <p className="mt-1 text-sm text-ink/40">No written review</p>}
                    {r.moderationNote && <p className="mt-1.5 text-xs text-ink/50">Note: {r.moderationNote}</p>}
                  </div>
                ),
              },
              {
                key: "product",
                header: "Product",
                cell: (r) => (
                  <div className="min-w-36">
                    <RowLink href={`/admin/products/${r.product.id}`}>{r.product.name}</RowLink>
                    {r.variantTitle && r.variantTitle !== "Default" && <p className="text-xs text-ink/50">{r.variantTitle}</p>}
                  </div>
                ),
              },
              {
                key: "customer",
                header: "Customer",
                cell: (r) => (
                  <div className="min-w-36 text-sm">
                    <p>{r.authorName}</p>
                    <p className="text-xs text-ink/50">{r.customer.email ?? r.customer.phone ?? "—"}</p>
                    {r.order && (
                      <p className="text-xs text-ink/50">
                        <RowLink href={`/admin/orders/${r.order.id}`}>{r.order.orderNumber}</RowLink>
                        {r.order.deliveredAt && <> · delivered {date(r.order.deliveredAt)}</>}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (
                  <div className="whitespace-nowrap">
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    <p className="mt-1 text-xs text-ink/50">{dateTime(r.updatedAt)}</p>
                  </div>
                ),
              },
              ...(canModerate
                ? [
                    {
                      key: "actions",
                      header: "",
                      cell: (r: ReviewRow) => (
                        <div className="flex justify-end gap-1.5">
                          {r.status !== "PUBLISHED" && (
                            <Button size="sm" icon={<Check size={14} />} loading={moderate.isPending && moderate.variables?.id === r.id && moderate.variables.action === "publish"} onClick={() => moderate.mutate({ id: r.id, slug: r.product.slug, action: "publish" })}>
                              Publish
                            </Button>
                          )}
                          {r.status !== "REJECTED" && (
                            <Button size="sm" variant="outline" icon={<X size={14} />} onClick={() => setRejecting(r)}>
                              Reject
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" aria-label="Delete review" title="Delete review" icon={<Trash2 size={14} />} onClick={() => setDeleting(r)} />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this review?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={moderate.isPending} onClick={() => rejecting && moderate.mutate({ id: rejecting.id, slug: rejecting.product.slug, action: "reject", note })}>
              Reject review
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink/70">It will not be shown on the product page. The customer is told it was not published and can edit it and send it again.</p>
        <label htmlFor="reject-note" className="label mt-4">
          Note for staff (optional)
        </label>
        <Textarea id="reject-note" rows={3} className="min-h-0" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Mentions another shop. The customer does not see this." />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Delete this review?"
        body="It is removed for good, and the customer can write a new one. To hide a review but keep it on record, reject it instead."
        confirmLabel="Delete review"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id, slug: deleting.product.slug })}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
