/**
 * Browser API client. Every call goes to the same origin (/api/*), so the
 * httpOnly auth cookies are sent automatically. State-changing requests
 * carry the CSRF token (double-submit), and an expired session is refreshed
 * once — transparently — before the request is retried.
 */

export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errors: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  [key: string]: unknown;
}

export interface Paged<T> {
  data: T;
  meta: PageMeta;
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** A file sent as the request body as it is (instead of JSON). */
  file?: Blob;
  idempotencyKey?: string;
  /** Skip the automatic refresh-and-retry on 401. */
  noRefresh?: boolean;
  signal?: AbortSignal;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function csrfToken(): Promise<string> {
  const existing = readCookie("csrf_token");
  if (existing) return existing;
  const res = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const body = (await res.json()) as { data: { csrfToken: string } };
  return body.data.csrfToken;
}

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

// One refresh at a time, shared by every request that hit a 401.
let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": await csrfToken(), "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) return true;
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      // Another tab refreshed first: our cookies are already updated.
      if (body?.code === "TOKEN_ROTATED") return true;
      return false;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: PageMeta; headers: Headers }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.file) headers["Content-Type"] = opts.file.type || "application/octet-stream";
  else if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = await csrfToken();
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const res = await fetch(`/api${path}${buildQuery(opts.query)}`, {
    method,
    headers,
    credentials: "same-origin",
    body: opts.file ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    signal: opts.signal,
  });

  if (res.status === 401 && !opts.noRefresh && !path.startsWith("/auth/")) {
    if (await refreshSession()) return request<T>(method, path, { ...opts, noRefresh: true });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("trendz:session-expired"));
  }

  const json = (await res.json().catch(() => null)) as
    | { success: true; data: T; meta?: PageMeta }
    | { success: false; message: string; code: string; errors?: FieldError[] }
    | null;
  if (!res.ok || !json || json.success === false) {
    const err = json && json.success === false ? json : null;
    throw new ApiError(res.status, err?.code ?? "NETWORK_ERROR", err?.message ?? "Something went wrong. Please try again.", err?.errors ?? []);
  }
  return { data: json.data, meta: json.meta, headers: res.headers };
}

export const api = {
  get: async <T>(path: string, query?: Query, signal?: AbortSignal) => (await request<T>("GET", path, { query, signal })).data,
  page: async <T>(path: string, query?: Query): Promise<Paged<T>> => {
    const r = await request<T>("GET", path, { query });
    return { data: r.data, meta: r.meta ?? { page: 1, limit: 0, total: 0, totalPages: 1 } };
  },
  post: async <T>(path: string, body?: unknown, opts: { idempotencyKey?: string } = {}) => (await request<T>("POST", path, { body: body ?? {}, ...opts })).data,
  put: async <T>(path: string, body?: unknown) => (await request<T>("PUT", path, { body: body ?? {} })).data,
  patch: async <T>(path: string, body?: unknown) => (await request<T>("PATCH", path, { body: body ?? {} })).data,
  delete: async <T>(path: string) => (await request<T>("DELETE", path)).data,
  /** POSTs a file as the request body (e.g. an Excel workbook). */
  upload: async <T>(path: string, file: Blob) => (await request<T>("POST", path, { file })).data,
};

/** Fetches a binary response (PDF, CSV, XLSX) and opens / downloads it. */
export async function download(path: string, filename?: string, method: "GET" | "POST" = "GET", body?: unknown) {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    headers["X-CSRF-Token"] = await csrfToken();
    headers["Content-Type"] = "application/json";
  }
  let res = await fetch(`/api${path}`, { method, headers, credentials: "same-origin", body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && (await refreshSession())) {
    res = await fetch(`/api${path}`, { method, headers, credentials: "same-origin", body: body ? JSON.stringify(body) : undefined });
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
    throw new ApiError(res.status, err?.code ?? "DOWNLOAD_FAILED", err?.message ?? "Download failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  if (filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } else {
    window.open(url, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A fresh idempotency key for one user action (e.g. one click on "Pay"). */
export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong");
