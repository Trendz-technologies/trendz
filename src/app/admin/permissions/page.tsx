"use client";

import Link from "next/link";
import { useMemo } from "react";
import { KeyRound } from "lucide-react";
import { PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { Badge, Card, EmptyState, ErrorState, Select, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { pluralize } from "@/lib/format";
import { groupByModule, moduleLabel, roleHasPermission, SUPER_ADMIN, usePermissionCatalog, useRoles } from "@/components/admin/system-data";

export default function PermissionsPage() {
  const { can } = useAuth();
  const { filters, set } = useListState({ q: "", role: "" });
  const catalog = usePermissionCatalog();
  const roles = useRoles();

  const groups = useMemo(() => {
    if (!catalog.data || !roles.data) return [];
    const needle = filters.q.trim().toLowerCase();
    const role = roles.data.find((r) => r.code === filters.role);
    const rows = catalog.data.filter(
      (p) =>
        (!needle || p.code.toLowerCase().includes(needle) || (p.description ?? "").toLowerCase().includes(needle) || moduleLabel(p.module).toLowerCase().includes(needle)) &&
        (!role || roleHasPermission(role, p.code)),
    );
    return groupByModule(rows);
  }, [catalog.data, roles.data, filters.q, filters.role]);

  const error = catalog.error ?? roles.error;
  const moduleCount = catalog.data ? new Set(catalog.data.map((p) => p.module)).size : 0;
  // Super admin implicitly holds everything; listing it on every row adds noise.
  const namedRoles = roles.data?.filter((r) => r.code !== SUPER_ADMIN) ?? [];

  return (
    <>
      <PageHeader
        title="Permissions"
        description={
          catalog.data
            ? `${pluralize(catalog.data.length, "permission")} across ${pluralize(moduleCount, "module")}. Permissions are defined by the application; assign them to people through roles.`
            : "Permissions are defined by the application; assign them to people through roles."
        }
        actions={
          can("roles.write") ? (
            <Link href="/admin/roles" className="link text-sm">
              Manage roles
            </Link>
          ) : undefined
        }
      />
      {error ? (
        <Card>
          <ErrorState
            error={error}
            retry={() => {
              void catalog.refetch();
              void roles.refetch();
            }}
          />
        </Card>
      ) : !catalog.data || !roles.data ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Search permissions" />
            <Select aria-label="Only permissions held by role" value={filters.role} onChange={(e) => set({ role: e.target.value })} className="w-56">
              <option value="">All roles</option>
              {roles.data.map((r) => (
                <option key={r.code} value={r.code}>
                  Held by {r.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-ink/50">
              <Badge tone="dark">Super admin</Badge> holds every permission implicitly.
            </p>
          </div>
          {groups.length === 0 ? (
            <Card>
              <EmptyState icon={<KeyRound size={22} />} title="No permissions match" body="Try a different search or role." />
            </Card>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <Card
                  key={g.module}
                  padded={false}
                  title={
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold">{moduleLabel(g.module)}</h2>
                      <span className="text-xs text-ink/45">{g.items.length}</span>
                    </div>
                  }
                >
                  <ul className="divide-y divide-black/[0.05]">
                    {g.items.map((p) => {
                      const holders = namedRoles.filter((r) => roleHasPermission(r, p.code));
                      return (
                        <li key={p.code} className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:gap-6">
                          <div className="min-w-0">
                            <p className="text-sm">{p.description ?? "—"}</p>
                            <code className="text-[11px] text-ink/50">{p.code}</code>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {holders.length ? (
                              holders.map((r) => (
                                <Link key={r.id} href={`/admin/roles/${r.id}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35">
                                  <Badge tone={r.isSystem ? "neutral" : "info"}>{r.name}</Badge>
                                </Link>
                              ))
                            ) : (
                              <span className="text-xs text-ink/40">Only super admin</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
