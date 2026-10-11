"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { STORE_CONFIG_TAG } from "@/lib/server-api";

const API = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";

/**
 * Drops the server's cached store config, so every page is rendered with the
 * theme that was just saved instead of waiting for the cache to expire.
 *
 * Server actions are public endpoints: the caller's own session is checked
 * against the API, and only staff who may change settings can purge the cache.
 * Returns false when it could not (the theme then arrives within a minute).
 */
export async function refreshThemeCache(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/auth/me`, { headers: { cookie: (await cookies()).toString(), Accept: "application/json" }, cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { data?: { user?: { permissions?: string[] } } } | null;
    if (!res.ok || !body?.data?.user?.permissions?.includes("settings.write")) return false;
  } catch {
    return false;
  }
  updateTag(STORE_CONFIG_TAG);
  return true;
}
