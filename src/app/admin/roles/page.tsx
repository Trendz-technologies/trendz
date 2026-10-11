"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pluralize } from "@/lib/format";
import { SUPER_ADMIN, usePermissionCatalog, useRoles, type RoleView } from "@/components/admin/system-data";
import { plainText } from "@/lib/rich-text";

export default function RolesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const roles = useRoles();
  const catalog = usePermissionCatalog();
  const [deleting, setDeleting] = useState<RoleView | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      toast("Role deleted");
      setDeleting(null);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const total = catalog.data?.length;
  const canWrite = can("roles.write");

  return (
    <>
      <PageHeader
        title="Roles"
        description="A role is a named set of permissions. Users can hold several roles; their access is the union."
        actions={
          <>
            <Link href="/admin/permissions" className="link text-sm">
              Permission catalogue
            </Link>
            <Can permission="roles.write">
              <Button icon={<Plus size={15} />} onClick={() => router.push("/admin/roles/new")}>
                New role
              </Button>
            </Can>
          </>
        }
      />
      <Card>
        {roles.error ? (
          <ErrorState error={roles.error} retry={() => roles.refetch()} />
        ) : (
          <DataTable
            loading={roles.isLoading}
            rows={roles.data}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/admin/roles/${r.id}`)}
            empty={<EmptyState title="No roles" />}
            columns={[
              {
                key: "name",
                header: "Role",
                cell: (r) => (
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <code className="text-[11px] text-ink/45">{r.code}</code>
                  </div>
                ),
              },
              { key: "desc", header: "Description", cell: (r) => <span className="line-clamp-2 max-w-sm text-ink/65">{plainText(r.description) || "—"}</span> },
              {
                key: "perms",
                header: "Permissions",
                cell: (r) =>
                  r.permissions.includes("*") ? (
                    <Badge tone="dark">All</Badge>
                  ) : (
                    <span className="tabular-nums">
                      {r.permissions.length}
                      {total ? <span className="text-ink/40"> / {total}</span> : null}
                    </span>
                  ),
              },
              { key: "users", header: "Users", align: "right", cell: (r) => (r.userCount ? pluralize(r.userCount, "user") : <span className="text-ink/40">None</span>) },
              { key: "type", header: "Type", cell: (r) => (r.isSystem ? <Badge>System</Badge> : <Badge tone="info">Custom</Badge>) },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (r) =>
                  canWrite && r.code !== SUPER_ADMIN ? (
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" aria-label={`Edit ${r.name}`} icon={<Pencil size={14} />} onClick={() => router.push(`/admin/roles/${r.id}`)} />
                      {!r.isSystem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${r.name}`}
                          title={r.userCount ? "Remove this role from all users first" : undefined}
                          disabled={r.userCount > 0}
                          icon={<Trash2 size={14} />}
                          onClick={() => setDeleting(r)}
                        />
                      )}
                    </div>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        body="Nobody holds this role. Deleting it cannot be undone."
        confirmLabel="Delete role"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
