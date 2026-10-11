"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { BadgeCheck, Clock, MessageSquareText, PenLine, Star, Trash2 } from "lucide-react";
import { Button, Modal, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, type Paged } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { reviewKeys, type OwnReview, type ProductReviews, type ReviewEligibility } from "@/lib/reviews";

/**
 * Customer reviews on the storefront: the stars, the form a customer fills in
 * after delivery, and the section on the product page.
 *
 * Only a customer whose order for the product was delivered can write one (the
 * API decides), so every review shown is a verified purchase.
 */

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------

const FIVE = [1, 2, 3, 4, 5] as const;

/** Read-only stars. Fractions are drawn (4.5 fills half of the fifth star). */
export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  const { t } = useI18n();
  return (
    <span role="img" aria-label={t("{rating} out of 5 stars", { rating: value })} className={clsx("relative inline-flex shrink-0 text-ink/20", className)}>
      {FIVE.map((n) => (
        <Star key={n} size={size} strokeWidth={0} fill="currentColor" aria-hidden="true" />
      ))}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 flex overflow-hidden text-gold" style={{ width: `${Math.max(0, Math.min(5, value)) * 20}%` }}>
        {FIVE.map((n) => (
          <Star key={n} size={size} strokeWidth={0} fill="currentColor" className="shrink-0" />
        ))}
      </span>
    </span>
  );
}

/** Star picker: click a star, or use the arrow keys. */
function StarInput({ value, onChange, invalid }: { value: number; onChange: (rating: number) => void; invalid?: boolean }) {
  const { t, tn } = useI18n();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    onChange(Math.max(1, Math.min(5, (value || 0) + step)));
  };
  return (
    <div role="radiogroup" aria-label={t("Your rating")} aria-invalid={invalid || undefined} onKeyDown={onKey} onMouseLeave={() => setHover(0)} className="flex items-center gap-1">
      {FIVE.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={tn(n, "{n} star", "{n} stars")}
          // One tab stop for the group, as for native radio buttons.
          tabIndex={value === n || (!value && n === 1) ? 0 : -1}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className={clsx("rounded-full p-1 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30", n <= shown ? "text-gold" : "text-ink/20 hover:text-ink/40")}
        >
          <Star size={30} strokeWidth={0} fill="currentColor" aria-hidden="true" className={clsx("transition-transform", n <= shown && "scale-110")} />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

const TITLE_MAX = 120;
const COMMENT_MAX = 2000;

interface ReviewTarget {
  productId: string;
  productName: string;
  /** Lets the product page refresh its list after a save. */
  slug?: string;
}

/** Write, edit or remove the signed-in customer's review of one product. */
export function ReviewDialog({ target, review, onClose }: { target: ReviewTarget; review: OwnReview | null; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [title, setTitle] = useState(review?.title ?? "");
  const [comment, setComment] = useState(review?.comment ?? "");
  const [missingRating, setMissingRating] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: reviewKeys.account });
    void qc.invalidateQueries({ queryKey: reviewKeys.eligibility(target.productId) });
    if (target.slug) void qc.invalidateQueries({ queryKey: reviewKeys.product(target.slug) });
  };

  const save = useMutation({
    mutationFn: () => api.put<OwnReview>(`/account/reviews/product/${target.productId}`, { rating, title, comment }),
    onSuccess: (saved) => {
      refresh();
      toast(saved.status === "PUBLISHED" ? t("Thank you! Your review is now on the product page.") : t("Thank you! Your review will appear once it has been approved."));
      onClose();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/account/reviews/product/${target.productId}`),
    onSuccess: () => {
      refresh();
      toast(t("Your review was removed"));
      onClose();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const busy = save.isPending || remove.isPending;

  const submit = () => {
    if (!rating) return setMissingRating(true);
    save.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={review ? t("Edit your review") : t("Write a review")}
      footer={
        <>
          {review && (
            <Button variant="ghost" className="mr-auto text-danger hover:text-danger" icon={<Trash2 size={15} />} disabled={busy} loading={remove.isPending} onClick={() => remove.mutate()}>
              {t("Remove review")}
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button loading={save.isPending} disabled={busy} onClick={submit}>
            {review ? t("Save review") : t("Submit review")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-ink/60">{target.productName}</p>
        <div>
          <p className="label">
            {t("Your rating")} <span className="text-danger">*</span>
          </p>
          <StarInput
            value={rating}
            invalid={missingRating}
            onChange={(n) => {
              setRating(n);
              setMissingRating(false);
            }}
          />
          {missingRating && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {t("Choose a star rating")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="review-title" className="label">
            {t("Headline (optional)")}
          </label>
          <input id="review-title" className="input" maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Sum it up in a few words")} />
        </div>
        <div>
          <label htmlFor="review-comment" className="label">
            {t("Your review (optional)")}
          </label>
          <Textarea id="review-comment" rows={5} maxLength={COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("How is the fit, the fabric, the colour?")} />
          <p className="mt-1 text-right text-[11px] tabular-nums text-ink/40">
            {comment.length}/{COMMENT_MAX}
          </p>
        </div>
        <p className="text-xs text-ink/50">{t("Your first name and the initial of your last name are shown with the review.")}</p>
      </div>
    </Modal>
  );
}

/** Where a customer's own review stands, in words. */
export function ReviewStatusNote({ review, className }: { review: OwnReview; className?: string }) {
  const { t } = useI18n();
  if (review.status === "PUBLISHED") return null;
  return (
    <p className={clsx("inline-flex items-center gap-1.5 text-xs", review.status === "PENDING" ? "text-warning" : "text-danger", className)}>
      <Clock size={13} aria-hidden="true" />
      {review.status === "PENDING" ? t("Waiting for approval") : t("Not published. You can edit it and send it again.")}
    </p>
  );
}

/** "Write a review" / "Edit review" button that opens the form. */
export function ReviewButton({ target, review, size = "sm", className }: { target: ReviewTarget; review: OwnReview | null; size?: "sm" | "md"; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={review ? "outline" : "secondary"} size={size} className={className} icon={review ? <PenLine size={14} /> : <Star size={14} />} onClick={() => setOpen(true)}>
        {review ? t("Edit review") : t("Write a review")}
      </Button>
      {open && <ReviewDialog target={target} review={review} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// The product page section
// ---------------------------------------------------------------------------

const PAGE_SIZE = 5;
/** The most the API returns in one request. */
const MAX_SHOWN = 50;
type Sort = "newest" | "highest" | "lowest";

/**
 * Reviews on a product page. `initial` is the first page, rendered on the
 * server so the reviews are in the HTML; sorting and "show more" load from the
 * browser.
 */
export function ProductReviewsSection({ slug, productName, initial }: { slug: string; productName: string; initial: ProductReviews }) {
  const { t, tn, locale } = useI18n();
  const { status } = useAuth();
  const [sort, setSort] = useState<Sort>("newest");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const list = useQuery({
    queryKey: [...reviewKeys.product(slug), sort, limit],
    queryFn: () => api.page<ProductReviews>(`/store/products/${slug}/reviews`, { sort, limit }),
    initialData: sort === "newest" && limit === PAGE_SIZE ? ({ data: initial, meta: { page: 1, limit: PAGE_SIZE, total: initial.summary.count, totalPages: 1 } } satisfies Paged<ProductReviews>) : undefined,
    // The server copy can be a minute old; check again once the page is open.
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  const mine = useQuery({
    queryKey: reviewKeys.eligibility(initial.productId),
    queryFn: () => api.get<ReviewEligibility>(`/account/reviews/product/${initial.productId}`),
    enabled: status === "authenticated",
  });

  const data = list.data?.data ?? initial;
  if (!data.enabled) return null;
  const { summary, items } = data;
  const target = { productId: initial.productId, productName, slug };

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-24 scroll-mt-28 md:mt-32">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="eyebrow">{t("Customer reviews")}</p>
          <h2 id="reviews-title" className="mt-2 text-4xl font-bold tracking-tighter md:text-5xl">
            {t("What customers say")}
          </h2>

          {summary.count > 0 && summary.average !== null ? (
            <div className="mt-6">
              <div className="flex items-end gap-3">
                <span className="text-5xl font-bold leading-none tracking-tight tabular-nums">{summary.average.toFixed(1)}</span>
                <div className="pb-1">
                  <Stars value={summary.average} size={18} />
                  <p className="mt-1 text-xs text-ink/55">{tn(summary.count, "Based on {n} review", "Based on {n} reviews")}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-1.5">
                {([5, 4, 3, 2, 1] as const).map((n) => {
                  const count = summary.distribution[String(n) as "1"] ?? 0;
                  return (
                    <li key={n} className="flex items-center gap-2.5 text-xs text-ink/60">
                      <span className="w-3 tabular-nums">{n}</span>
                      <Star size={11} strokeWidth={0} fill="currentColor" className="text-gold" aria-hidden="true" />
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.07]">
                        <span className="block h-full rounded-full bg-gold" style={{ width: `${(count / summary.count) * 100}%` }} />
                      </span>
                      <span className="w-6 text-right tabular-nums">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink/60">{t("No reviews yet. Reviews come from customers who have received this product.")}</p>
          )}

          <div className="mt-7 space-y-2.5">
            {status !== "authenticated" ? (
              <p className="text-sm text-ink/60">
                {t("Bought this?")}{" "}
                <Link href={`/login?next=${encodeURIComponent(`/products/${slug}#reviews`)}`} className="link">
                  {t("Sign in to write a review")}
                </Link>
              </p>
            ) : mine.data?.canReview ? (
              <>
                <ReviewButton target={target} review={mine.data.review} size="md" />
                {mine.data.review && <ReviewStatusNote review={mine.data.review} className="block" />}
              </>
            ) : mine.data ? (
              <p className="text-sm text-ink/60">{t("You can review this product once your order for it has been delivered.")}</p>
            ) : null}
          </div>
        </div>

        <div>
          {summary.count > 1 && (
            <div className="mb-4 flex items-center justify-end gap-2 text-sm">
              <label htmlFor="review-sort" className="text-ink/55">
                {t("Sort")}
              </label>
              <select
                id="review-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as Sort);
                  setLimit(PAGE_SIZE);
                }}
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink outline-none focus:border-accent/60 focus:ring-4 focus:ring-accent/15"
              >
                <option value="newest">{t("Newest")}</option>
                <option value="highest">{t("Highest rated")}</option>
                <option value="lowest">{t("Lowest rated")}</option>
              </select>
            </div>
          )}

          {items.length > 0 ? (
            <ul className={clsx("divide-y divide-black/[0.07] border-y border-black/[0.07] transition-opacity", list.isPlaceholderData && "opacity-60")}>
              {items.map((r) => (
                <li key={r.id} className="py-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} />
                    {r.title && <p className="font-semibold">{r.title}</p>}
                  </div>
                  {r.comment && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/75">{r.comment}</p>}
                  <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/50">
                    <span className="font-semibold text-ink/70">{r.authorName}</span>
                    <span className="inline-flex items-center gap-1 text-success">
                      <BadgeCheck size={13} aria-hidden="true" /> {t("Verified purchase")}
                    </span>
                    {r.variantTitle && r.variantTitle !== "Default" && <span>· {r.variantTitle}</span>}
                    <span>· {date(r.createdAt, locale)}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid place-items-center rounded-3xl border border-dashed border-black/10 px-6 py-14 text-center">
              <MessageSquareText size={26} strokeWidth={1.5} className="text-ink/30" aria-hidden="true" />
              <p className="mt-3 text-sm text-ink/55">{t("Be the first to tell others how it fits and feels.")}</p>
            </div>
          )}

          {items.length < summary.count && limit < MAX_SHOWN && (
            <div className="mt-6 text-center">
              <Button variant="outline" loading={list.isFetching} onClick={() => setLimit((n) => Math.min(MAX_SHOWN, n + PAGE_SIZE * 2))}>
                {t("Show more reviews")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
