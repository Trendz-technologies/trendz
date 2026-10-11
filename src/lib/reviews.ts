/** Shapes of the review API (see src/modules/reviews in trendz-api). */

import type { ImageView } from "./types";

export type ReviewStatus = "PENDING" | "PUBLISHED" | "REJECTED";

/** A review as anyone may see it. Nothing here identifies the customer beyond the display name. */
export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  /** e.g. "Asha R." */
  authorName: string;
  /** What they bought, e.g. "Red / M". */
  variantTitle: string | null;
  createdAt: string;
}

export interface RatingSummary {
  /** One decimal, or null when there are no published reviews. */
  average: number | null;
  count: number;
  /** How many reviews gave each number of stars. */
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

/** GET /store/products/:slug/reviews */
export interface ProductReviews {
  /** False when the shop has switched reviews off: show nothing. */
  enabled: boolean;
  productId: string;
  summary: RatingSummary;
  items: PublicReview[];
}

/** The signed-in customer's own review, with where it stands in moderation. */
export interface OwnReview extends PublicReview {
  productId: string;
  status: ReviewStatus;
  updatedAt: string;
}

/** GET /account/reviews/product/:productId */
export interface ReviewEligibility {
  enabled: boolean;
  /** True once an order with this product has been delivered to the customer. */
  canReview: boolean;
  review: OwnReview | null;
}

export interface ReviewProduct {
  id: string;
  name: string;
  slug: string;
  available: boolean;
  image: ImageView | null;
}

/** GET /account/reviews */
export interface AccountReviews {
  enabled: boolean;
  reviews: (OwnReview & { product: ReviewProduct })[];
  /** Delivered products the customer has not reviewed yet. */
  toReview: { product: ReviewProduct; variantTitle: string; orderNumber: string; deliveredAt: string | null }[];
}

/** Query keys shared by every screen that shows or changes reviews. */
export const reviewKeys = {
  account: ["account-reviews"] as const,
  eligibility: (productId: string) => ["review-eligibility", productId] as const,
  product: (slug: string) => ["product-reviews", slug] as const,
};
