"use client";

/**
 * Shared types, queries and helpers for the administration screens
 * (dashboard, reports, users, roles, settings, audit and messaging).
 */

import { useQuery } from "@tanstack/react-query";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { StoreConfig } from "@/lib/types";

export const SUPER_ADMIN = "SUPER_ADMIN";
export const CUSTOMER_ROLE = "CUSTOMER";

// ---------------------------------------------------------------------------
// Shapes returned by the API
// ---------------------------------------------------------------------------

export interface RoleView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  /** `["*"]` for SUPER_ADMIN. */
  permissions: string[];
}

export interface PermissionRow {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export type UserStatus = "ACTIVE" | "DISABLED" | "LOCKED";

export interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  isStaff: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  defaultWarehouseId: string | null;
  defaultWarehouse: { id: string; code: string; name: string } | null;
  profile: { firstName: string | null; lastName: string | null } | null;
  roles: { code: string; name: string }[];
}

export const userName = (u: Pick<AdminUser, "email" | "phone" | "profile">) =>
  [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") || u.email || u.phone || "Unnamed user";

export const roleHasPermission = (role: Pick<RoleView, "permissions">, code: string) => role.permissions.includes("*") || role.permissions.includes(code);

// ---------------------------------------------------------------------------
// Shared queries (lookups used by several screens)
// ---------------------------------------------------------------------------

export function useRoles(enabled = true) {
  return useQuery({ queryKey: ["admin", "roles"], queryFn: () => api.get<RoleView[]>("/roles"), enabled, staleTime: 60_000 });
}

export function usePermissionCatalog(enabled = true) {
  return useQuery({ queryKey: ["admin", "permissions"], queryFn: () => api.get<PermissionRow[]>("/permissions"), enabled, staleTime: 5 * 60_000 });
}

/** Warehouses need warehouses.read / inventory.read / pos.use — callers must tolerate an error. */
export function useWarehouseOptions(enabled = true) {
  return useQuery({ queryKey: ["admin", "warehouses", "options"], queryFn: () => api.get<WarehouseOption[]>("/warehouses"), enabled, staleTime: 5 * 60_000, retry: false });
}

export function useStates() {
  return useQuery({ queryKey: ["store-config"], queryFn: () => api.get<StoreConfig>("/store/config"), staleTime: 300_000, select: (c) => c.states });
}

/** Groups permissions by module, keeping the API's (module, code) order. */
export function groupByModule<T extends { module: string }>(rows: T[]): { module: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.module, [...(map.get(r.module) ?? []), r]);
  return [...map.entries()].map(([module, items]) => ({ module, items }));
}

const MODULE_LABELS: Record<string, string> = {
  pos: "Billing / POS",
  codes: "Codes & labels",
  audit: "Audit logs",
};
export const moduleLabel = (m: string) => MODULE_LABELS[m] ?? m.charAt(0).toUpperCase() + m.slice(1);

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

/**
 * Maps API validation errors onto form fields. Errors for paths the form does
 * not render are collected into the form's root error so nothing is lost.
 */
export function applyApiErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, fields: readonly string[]) {
  if (err instanceof ApiError && err.errors.length) {
    const unknown: string[] = [];
    for (const e of err.errors) {
      const match = fields.find((f) => e.path === f || e.path.startsWith(`${f}.`));
      if (match) setError(match as Path<T>, { message: e.message });
      else unknown.push(e.path ? `${e.path}: ${e.message}` : e.message);
    }
    if (unknown.length) setError("root", { message: unknown.join(" · ") });
    return;
  }
  setError("root", { message: errorMessage(err) });
}

// ---------------------------------------------------------------------------
// Dates (the business runs on IST)
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 330 * 60_000;

/** "YYYY-MM-DD" for the IST calendar day of an instant. */
export const istDay = (d: Date | string) => new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
/** IST calendar day `n` days before today. */
export const istDaysAgo = (n: number) => istDay(new Date(Date.now() - n * 86_400_000));
export const istStartOf = (day: string) => `${day}T00:00:00.000+05:30`;
export const istEndOf = (day: string) => `${day}T23:59:59.999+05:30`;

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
