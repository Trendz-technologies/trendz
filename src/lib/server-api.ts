import "server-only";
import { cache } from "react";
import { DEFAULT_APPEARANCE, normaliseAppearance, type Appearance } from "./theme";
import type { StoreConfig } from "./types";

/**
 * Server-side fetch for public storefront data (server components, metadata,
 * sitemap). Talks to the API directly; responses are cached briefly by Next.
 */
const API = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";

export class NotFoundError extends Error {}

/**
 * Asks the API to answer "not found" with a 200 whose body still says so.
 * Next only replaces a cached response with a 200 and serves the old copy
 * until then, so a plain 404 would leave a deleted product or category on the
 * site indefinitely. This way the "not found" answer itself is cached.
 */
const HEADERS = { Accept: "application/json", "X-Not-Found-Status": "200" };

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function read<B extends Envelope<unknown>>(res: Response, path: string): Promise<B> {
  const body = (await res.json().catch(() => null)) as B | null;
  // A 2xx that reports failure is the "not found as 200" answer requested above.
  if (res.status === 404 || (res.ok && body?.success === false)) throw new NotFoundError(path);
  if (!res.ok || !body?.success) throw new Error(body?.message ?? `API ${path} failed with ${res.status}`);
  return body;
}

/** Cache tag of a GET path, so its cached copy can be dropped on demand (see updateTag). */
export const apiTag = (path: string) => `api:${path.split("?")[0]}`;
export const STORE_CONFIG_TAG = apiTag("/store/config");

/** `tags` are extra cache tags: content saved alongside the store config carries STORE_CONFIG_TAG, so one purge refreshes both. */
export async function serverGet<T>(path: string, revalidate = 60, tags: string[] = []): Promise<T> {
  const res = await fetch(`${API}/api${path}`, { next: { revalidate, tags: [apiTag(path), ...tags] }, headers: HEADERS });
  return (await read<Envelope<T>>(res, path)).data;
}

type PageMeta = { page: number; limit: number; total: number; totalPages: number };

export async function serverPage<T>(path: string, revalidate = 30): Promise<{ data: T; meta: PageMeta }> {
  const res = await fetch(`${API}/api${path}`, { next: { revalidate }, headers: HEADERS });
  const body = await read<Envelope<T> & { meta: PageMeta }>(res, path);
  return { data: body.data, meta: body.meta };
}

/**
 * The theme saved in Admin → Appearance. Falls back to the default look when
 * the API cannot be reached, so pages always render.
 */
export const getAppearance = cache(async (): Promise<Appearance> => {
  try {
    return normaliseAppearance((await serverGet<StoreConfig>("/store/config", 60)).appearance);
  } catch {
    return DEFAULT_APPEARANCE;
  }
});

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
