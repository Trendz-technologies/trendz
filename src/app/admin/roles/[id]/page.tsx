"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/page";
import { ErrorState, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePermissionCatalog, type RoleView } from "@/components/admin/system-data";
import { RoleEditor } from "@/components/admin/system-role-editor";
import { plainText } from "@/lib/rich-text";

/** `/admin/roles/new` creates a role; `/admin/roles/:id` views or edits one. */
export default function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const { can } = useAuth();
  const catalog = usePermissionCatalog();
  const role = useQuery({ queryKey: ["admin", "role", id], queryFn: () => api.get<RoleView>(`/roles/${id}`), enabled: !isNew });

  const error = catalog.error ?? role.error;
  const ready = catalog.data && (isNew || role.data);

  return (
    <>
      <PageHeader
        title={isNew ? "New role" : (role.data?.name ?? "Role")}
        description={isNew ? "Pick a code and name, then choose what people with this role can do." : plainText(role.data?.description) || undefined}
        back={{ href: "/admin/roles", label: "Roles" }}
      />
      {error ? (
        <ErrorState
          error={error}
          retry={() => {
            void catalog.refetch();
            if (!isNew) void role.refetch();
          }}
        />
      ) : !ready ? (
        <Spinner />
      ) : isNew && !can("roles.write") ? (
        <ErrorState error={new Error("Creating roles requires the roles.write permission.")} />
      ) : (
        <RoleEditor key={role.data?.id ?? "new"} role={isNew ? null : role.data!} catalog={catalog.data!} canEdit={can("roles.write")} />
      )}
    </>
  );
}
