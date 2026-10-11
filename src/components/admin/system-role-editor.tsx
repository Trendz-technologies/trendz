"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clsx } from "clsx";
import { Info, Search, ShieldCheck, Trash2 } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Field, Input } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pluralize } from "@/lib/format";
import { applyApiErrors, CUSTOMER_ROLE, groupByModule, moduleLabel, SUPER_ADMIN, type PermissionRow, type RoleView } from "./system-data";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { withinChars } from "@/lib/rich-text";

const schema = z.object({
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,49}$/, "2–50 characters: UPPER_SNAKE_CASE, starting with a letter"),
  name: z.string().trim().min(2, "At least 2 characters").max(80),
  description: z.string().refine(withinChars(300), "At most 300 characters"),
});
type Values = z.infer<typeof schema>;
const FIELDS = ["code", "name", "description", "permissions"] as const;

/** Checkbox that can show a mixed state (some, not all, children selected). */
function TriCheckbox({ checked, mixed, onChange, disabled, label }: { checked: boolean; mixed: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 accent-accent"
      checked={checked}
      aria-checked={mixed ? "mixed" : checked}
      ref={(el) => {
        if (el) el.indeterminate = mixed;
      }}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export function RoleEditor({ role, catalog, canEdit }: { role: RoleView | null; catalog: PermissionRow[]; canEdit: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me, reload } = useAuth();

  const isSuper = role?.code === SUPER_ADMIN;
  const isCustomer = role?.code === CUSTOMER_ROLE;
  const readOnly = !canEdit || isSuper;
  const checklistLocked = readOnly || isCustomer;

  const initialPerms = useMemo(() => (isSuper ? catalog.map((p) => p.code) : (role?.permissions ?? [])), [isSuper, catalog, role]);
  const [perms, setPerms] = useState<Set<string>>(() => new Set(initialPerms));
  const [filter, setFilter] = useState("");
  const [confirming, setConfirming] = useState<Values | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: role?.code ?? "", name: role?.name ?? "", description: role?.description ?? "" },
  });

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const rows = needle ? catalog.filter((p) => p.code.includes(needle) || (p.description ?? "").toLowerCase().includes(needle) || moduleLabel(p.module).toLowerCase().includes(needle)) : catalog;
    return groupByModule(rows);
  }, [catalog, filter]);

  const added = [...perms].filter((p) => !initialPerms.includes(p));
  const removed = initialPerms.filter((p) => !perms.has(p));
  const permsDirty = added.length > 0 || removed.length > 0;
  const dirty = isDirty || permsDirty;

  const toggle = (code: string) =>
    setPerms((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  const setMany = (codes: string[], on: boolean) =>
    setPerms((s) => {
      const n = new Set(s);
      for (const c of codes) {
        if (on) n.add(c);
        else n.delete(c);
      }
      return n;
    });

  const persist = async (v: Values) => {
    const permissions = [...perms].sort();
    setSaving(true);
    try {
      if (role) {
        const saved = await api.put<RoleView>(`/roles/${role.id}`, { name: v.name, description: v.description || null, permissions });
        qc.setQueryData(["admin", "role", role.id], saved);
        void qc.invalidateQueries({ queryKey: ["admin", "roles"] });
        if (me?.roles.includes(role.code)) void reload();
        toast("Role saved — access updated for everyone with this role");
        router.push("/admin/roles");
      } else {
        const created = await api.post<RoleView>("/roles", { code: v.code, name: v.name, description: v.description || null, permissions });
        void qc.invalidateQueries({ queryKey: ["admin", "roles"] });
        toast(`Role ${created.name} created`);
        router.push("/admin/roles");
      }
    } catch (err) {
      applyApiErrors(err, setError, FIELDS);
    } finally {
      setSaving(false);
      setConfirming(null);
    }
  };

  const submit = handleSubmit(async (v) => {
    // Changing an in-use role affects people immediately: confirm first.
    if (role && role.userCount > 0 && permsDirty) setConfirming(v);
    else await persist(v);
  });

  const remove = async () => {
    if (!role) return;
    setDeletePending(true);
    try {
      await api.delete(`/roles/${role.id}`);
      void qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      toast(`Role ${role.name} deleted`);
      router.push("/admin/roles");
    } catch (e) {
      toast(errorMessage(e), "error");
      setDeleting(false);
    } finally {
      setDeletePending(false);
    }
  };

  const allCodes = catalog.map((p) => p.code);
  const permissionError = (errors as { permissions?: { message?: string } }).permissions?.message;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <Card title="Details">
          <fieldset disabled={readOnly} className="space-y-4">
            <Field label="Code" htmlFor="code" error={errors.code?.message} hint={role ? "Codes cannot be changed" : "Used by the system, e.g. WAREHOUSE_STAFF"} required>
              <Controller
                control={control}
                name="code"
                render={({ field }) => (
                  <Input
                    id="code"
                    className="font-mono uppercase"
                    placeholder="WAREHOUSE_STAFF"
                    disabled={!!role || readOnly}
                    invalid={!!errors.code}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/[\s-]+/g, "_"))}
                  />
                )}
              />
            </Field>
            <Field label="Name" htmlFor="name" error={errors.name?.message} required>
              <Input id="name" placeholder="Warehouse staff" invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field label="Description" htmlFor="description" error={errors.description?.message}>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <RichTextEditor
                    id="description"
                    variant="compact"
                    aria-label="Description"
                    placeholder="What people with this role do"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={!!errors.description}
                    disabled={readOnly}
                  />
                )}
              />
            </Field>
          </fieldset>
          <dl className="mt-5 space-y-2 border-t border-black/5 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/50">Permissions</dt>
              <dd className="font-semibold tabular-nums">{isSuper ? "All" : `${perms.size} of ${catalog.length}`}</dd>
            </div>
            {role && (
              <div className="flex justify-between">
                <dt className="text-ink/50">Users with this role</dt>
                <dd className="font-semibold tabular-nums">{role.userCount}</dd>
              </div>
            )}
            {role && (
              <div className="flex justify-between">
                <dt className="text-ink/50">Type</dt>
                <dd>{role.isSystem ? <Badge>System</Badge> : <Badge tone="info">Custom</Badge>}</dd>
              </div>
            )}
          </dl>
          {errors.root && (
            <p role="alert" className="mt-4 rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
              {errors.root.message}
            </p>
          )}
          {permissionError && (
            <p role="alert" className="mt-4 rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
              {permissionError}
            </p>
          )}
          {!readOnly && (
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => router.push("/admin/roles")}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || saving} disabled={!!role && !dirty}>
                {role ? "Save changes" : "Create role"}
              </Button>
            </div>
          )}
        </Card>
        {role && canEdit && !role.isSystem && (
          <Card title="Delete role">
            <p className="text-sm text-ink/60">{role.userCount > 0 ? `Remove this role from ${pluralize(role.userCount, "user")} before deleting it.` : "Deleting a role cannot be undone."}</p>
            <Button variant="outline" className="mt-3 text-danger" icon={<Trash2 size={14} />} disabled={role.userCount > 0} onClick={() => setDeleting(true)}>
              Delete role
            </Button>
          </Card>
        )}
      </div>

      <Card
        padded={false}
        title={
          <div>
            <h2 className="text-sm font-semibold">Permissions</h2>
            <p className="mt-0.5 text-xs text-ink/50">Grouped by module. The API enforces every permission; the admin menu hides what a role cannot use.</p>
          </div>
        }
      >
        {(isSuper || isCustomer || !canEdit) && (
          <p className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-offwhite px-3 py-2.5 text-sm text-ink/70">
            {isSuper ? <ShieldCheck size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
            {isSuper
              ? "The super admin role always has every permission, including future ones. It cannot be edited."
              : isCustomer
                ? "The customer role is for storefront accounts and cannot hold admin permissions."
                : "You can view this role. Editing roles requires the roles.write permission."}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-b border-black/5 px-5 py-4">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter permissions" aria-label="Filter permissions" className="input pl-9" />
          </div>
          {!checklistLocked && (
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setMany(allCodes, true)}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMany(allCodes, false)}>
                Clear all
              </Button>
            </div>
          )}
        </div>
        {groups.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink/50">No permissions match “{filter}”.</p>
        ) : (
          <div className="divide-y divide-black/[0.05]">
            {groups.map((g) => {
              const codes = g.items.map((p) => p.code);
              const on = codes.filter((c) => perms.has(c)).length;
              const all = on === codes.length;
              return (
                <section key={g.module} className="px-5 py-4" aria-labelledby={`mod-${g.module}`}>
                  <div className="mb-2 flex items-center gap-3">
                    <TriCheckbox label={`Select all ${moduleLabel(g.module)} permissions`} checked={all} mixed={on > 0 && !all} disabled={checklistLocked} onChange={() => setMany(codes, !all)} />
                    <h3 id={`mod-${g.module}`} className="text-sm font-semibold">
                      {moduleLabel(g.module)}
                    </h3>
                    <span className="text-xs text-ink/45">
                      {on}/{codes.length}
                    </span>
                  </div>
                  <ul className="grid gap-1 pl-7 sm:grid-cols-2">
                    {g.items.map((p) => {
                      const checked = perms.has(p.code);
                      const changed = !isSuper && checked !== initialPerms.includes(p.code);
                      return (
                        <li key={p.code}>
                          <label className={clsx("flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm", checklistLocked ? "cursor-default" : "cursor-pointer hover:bg-black/[0.03]", changed && "bg-info/5")}>
                            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-accent" checked={checked} disabled={checklistLocked} onChange={() => toggle(p.code)} />
                            <span className="min-w-0">
                              <span className="block">{p.description ?? p.code}</span>
                              <code className="text-[11px] text-ink/45">{p.code}</code>
                              {changed && <span className="ml-1.5 text-[11px] font-semibold text-info">{checked ? "added" : "removed"}</span>}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirming}
        title={`Update ${role?.name}?`}
        confirmLabel="Save changes"
        loading={saving}
        onConfirm={() => confirming && void persist(confirming)}
        onClose={() => setConfirming(null)}
        body={
          <div className="space-y-2">
            <p>
              {pluralize(role?.userCount ?? 0, "user")} with this role will get the new access immediately, including in open sessions.
            </p>
            {added.length > 0 && (
              <p>
                <span className="font-semibold text-ink">Granting:</span> {added.join(", ")}
              </p>
            )}
            {removed.length > 0 && (
              <p>
                <span className="font-semibold text-ink">Revoking:</span> {removed.join(", ")}
              </p>
            )}
          </div>
        }
      />
      <ConfirmDialog
        open={deleting}
        title={`Delete ${role?.name}?`}
        tone="danger"
        confirmLabel="Delete role"
        loading={deletePending}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(false)}
        body="This cannot be undone."
      />
    </form>
  );
}
