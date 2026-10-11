"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Pagination, Select, StatusBadge, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { SUPER_ADMIN, useRoles, userName, type AdminUser } from "@/components/admin/system-data";
import { CreateStaffModal } from "@/components/admin/system-user-forms";

type UserType = "staff" | "customer" | "all";

export default function UsersPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const { page, filters, set, setPage } = useListState({ type: "staff", role: "", status: "", q: "" });
  const type = (["staff", "customer", "all"].includes(filters.type) ? filters.type : "staff") as UserType;

  const roles = useRoles(can("roles.read"));
  const q = useQuery({
    queryKey: ["admin", "users", page, filters],
    queryFn: () => api.page<AdminUser[]>("/users", { page, limit: 25, type, role: filters.role, status: filters.status, q: filters.q }),
    placeholderData: keepPreviousData,
  });

  const canCreate = can("users.write") && can("users.roles");

  return (
    <>
      <PageHeader
        title="Users"
        description="Staff accounts, their roles and sign-in status."
        actions={
          canCreate && (
            <Button icon={<UserPlus size={15} />} onClick={() => setCreating(true)}>
              New staff user
            </Button>
          )
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tabs
            value={type}
            onChange={(v) => set({ type: v === "staff" ? "" : v })}
            tabs={[
              { value: "staff", label: "Staff" },
              { value: "customer", label: "Customers" },
              { value: "all", label: "Everyone" },
            ]}
          />
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Name, email or phone" />
          {roles.data && (
            <Select aria-label="Filter by role" value={filters.role} onChange={(e) => set({ role: e.target.value })} className="w-44">
              <option value="">All roles</option>
              {roles.data.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
          <Select aria-label="Filter by status" value={filters.status} onChange={(e) => set({ status: e.target.value })} className="w-36">
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
            <option value="LOCKED">Locked</option>
          </Select>
        </div>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(u) => u.id}
            onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
            empty={
              <EmptyState
                title={filters.q || filters.role || filters.status ? "No users match these filters" : "No users yet"}
                action={
                  canCreate && type === "staff" && !filters.q ? (
                    <Button size="sm" onClick={() => setCreating(true)}>
                      Add the first staff user
                    </Button>
                  ) : undefined
                }
              />
            }
            columns={[
              {
                key: "name",
                header: "User",
                cell: (u) => (
                  <div className="min-w-0">
                    <p className="font-medium">{userName(u)}</p>
                    <p className="truncate text-xs text-ink/50">{u.email ?? "No email"}</p>
                  </div>
                ),
              },
              { key: "phone", header: "Phone", cell: (u) => u.phone ?? <span className="text-ink/30">—</span> },
              {
                key: "roles",
                header: "Roles",
                cell: (u) =>
                  u.roles.length ? (
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {u.roles.slice(0, 3).map((r) => (
                        <Badge key={r.code} tone={r.code === SUPER_ADMIN ? "dark" : "neutral"}>
                          {r.name}
                        </Badge>
                      ))}
                      {u.roles.length > 3 && <Badge>+{u.roles.length - 3}</Badge>}
                    </div>
                  ) : (
                    <span className="text-xs text-ink/40">No roles</span>
                  ),
              },
              { key: "wh", header: "Warehouse", cell: (u) => u.defaultWarehouse?.code ?? <span className="text-ink/30">—</span> },
              { key: "login", header: "Last sign-in", cell: (u) => (u.lastLoginAt ? dateTime(u.lastLoginAt) : <span className="text-ink/40">Never</span>) },
              { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
      {creating && <CreateStaffModal onClose={() => setCreating(false)} onCreated={(u) => router.push(`/admin/users/${u.id}`)} />}
    </>
  );
}
