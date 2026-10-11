"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { PageHeader } from "@/components/admin/page";
import { Badge, Card, ErrorState, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime } from "@/lib/format";
import { userName, type AdminUser } from "@/components/admin/system-data";
import { UserProfileCard, UserRolesCard, UserStatusCard } from "@/components/admin/system-user-forms";

function Verified({ at }: { at: string | null }) {
  return at ? (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <CheckCircle2 size={12} /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-ink/45">
      <CircleDashed size={12} /> Unverified
    </span>
  );
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user: me, can } = useAuth();
  const q = useQuery({ queryKey: ["admin", "user", id], queryFn: () => api.get<AdminUser>(`/users/${id}`) });

  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner />;
  const u = q.data;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {userName(u)}
            {me?.id === u.id && <Badge tone="info">You</Badge>}
          </span>
        }
        description={`${u.isStaff ? "Staff" : "Customer"} account · created ${date(u.createdAt)}`}
        back={{ href: "/admin/users", label: "Users" }}
        actions={<StatusBadge status={u.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <UserProfileCard key={`profile-${u.id}`} user={u} canEdit={can("users.write")} />
          <UserRolesCard key={`roles-${u.roles.map((r) => r.code).join(",")}`} user={u} canEdit={can("users.roles")} />
        </div>
        <div className="space-y-6">
          <UserStatusCard user={u} canEdit={can("users.write")} />
          <Card title="Sign-in">
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Email</dt>
                <dd className="min-w-0 text-right">
                  <p className="truncate">{u.email ?? "—"}</p>
                  {u.email && <Verified at={u.emailVerifiedAt} />}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Mobile</dt>
                <dd className="text-right">
                  <p>{u.phone ?? "—"}</p>
                  {u.phone && <Verified at={u.phoneVerifiedAt} />}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/50">Last sign-in</dt>
                <dd>{u.lastLoginAt ? dateTime(u.lastLoginAt) : "Never"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/50">Default warehouse</dt>
                <dd>{u.defaultWarehouse ? `${u.defaultWarehouse.name}` : "None"}</dd>
              </div>
            </dl>
          </Card>
          {can("audit.read") && (
            <Link href={`/admin/audit-logs?entityType=user&entityId=${u.id}`} className="link block px-1 text-sm">
              View audit history for this user →
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
