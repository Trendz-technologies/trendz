"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { AccountHeader, EmptyPanel, Panel, RowsSkeleton, StaggerList, StaggerRow, Thumb } from "@/components/store/account-ui";
import { ReviewButton, ReviewStatusNote, Stars } from "@/components/store/reviews";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { reviewKeys, type AccountReviews } from "@/lib/reviews";

/** The customer's reviews: delivered products still waiting for one, and what they have written. */
export default function AccountReviewsPage() {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: reviewKeys.account, queryFn: () => api.get<AccountReviews>("/account/reviews") });
  const data = q.data;

  return (
    <>
      <AccountHeader eyebrow={t("Reviews")} title={t("Rate your purchases")} description={t("Rate what you have received. Your reviews help other shoppers choose.")} />
      {q.isLoading || !data ? (
        <RowsSkeleton label={t("Loading")} />
      ) : !data.enabled ? (
        <EmptyPanel icon={<Star size={26} strokeWidth={1.5} />} title={t("Reviews are closed at the moment")} />
      ) : data.toReview.length === 0 && data.reviews.length === 0 ? (
        <EmptyPanel
          icon={<Star size={26} strokeWidth={1.5} />}
          title={t("Nothing to review yet")}
          body={t("Once an order is delivered, its products appear here for you to rate.")}
          action={
            <Link href="/products" className="link text-sm">
              {t("Continue shopping")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {data.toReview.length > 0 && (
            <Panel eyebrow={t("Delivered items")} title={t("Waiting for your review")} padded={false}>
              <StaggerList className="divide-y divide-black/5">
                {data.toReview.map((item) => (
                  <StaggerRow key={item.product.id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-7">
                    <Thumb src={item.product.image?.thumb ?? item.product.image?.url} />
                    <div className="min-w-0 flex-1 text-sm">
                      <Link href={`/products/${item.product.slug}`} className="font-semibold hover:underline">
                        {item.product.name}
                      </Link>
                      <p className="text-ink/55">
                        {item.variantTitle !== "Default" && <>{item.variantTitle} · </>}
                        {t("Delivered {date}", { date: date(item.deliveredAt, locale) })}
                      </p>
                    </div>
                    <ReviewButton target={{ productId: item.product.id, productName: item.product.name, slug: item.product.slug }} review={null} />
                  </StaggerRow>
                ))}
              </StaggerList>
            </Panel>
          )}

          {data.reviews.length > 0 && (
            <Panel title={t("Your reviews")} padded={false} delay={0.05}>
              <StaggerList className="divide-y divide-black/5">
                {data.reviews.map((r) => (
                  <StaggerRow key={r.id} className="flex flex-wrap items-start gap-4 px-5 py-5 sm:px-7">
                    <Thumb src={r.product.image?.thumb ?? r.product.image?.url} />
                    <div className="min-w-0 flex-1 text-sm">
                      {r.product.available ? (
                        <Link href={`/products/${r.product.slug}`} className="font-semibold hover:underline">
                          {r.product.name}
                        </Link>
                      ) : (
                        <p className="font-semibold">{r.product.name}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Stars value={r.rating} size={15} />
                        <span className="text-xs text-ink/50">{date(r.updatedAt, locale)}</span>
                      </div>
                      {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                      {r.comment && <p className="mt-1 whitespace-pre-line text-ink/70">{r.comment}</p>}
                      <ReviewStatusNote review={r} className="mt-2" />
                    </div>
                    <ReviewButton target={{ productId: r.productId, productName: r.product.name, slug: r.product.slug }} review={r} />
                  </StaggerRow>
                ))}
              </StaggerList>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
