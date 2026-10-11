"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { apiTag } from "@/lib/server-api";

const API = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";

/**
 * Drops the server's cached reviews of one product, so its page shows a
 * review the moment it is published (and stops showing one that was rejected
 * or deleted) instead of a minute later.
 *
 * Server actions are public endpoints: the caller's own session is checked
 * against the API, and only staff who may moderate reviews can purge the cache.
 * Returns false when it could not (the page then catches up by itself).
 */
export async function refreshProductReviews(slug: string): Promise<boolean> {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,120}$/.test(slug)) return false;
  try {
    const res = await fetch(`${API}/api/auth/me`, { headers: { cookie: (await cookies()).toString(), Accept: "application/json" }, cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { data?: { user?: { permissions?: string[] } } } | null;
    if (!res.ok || !body?.data?.user?.permissions?.includes("reviews.moderate")) return false;
  } catch {
    return false;
  }
  updateTag(apiTag(`/store/products/${slug}/reviews`));
  return true;
}
