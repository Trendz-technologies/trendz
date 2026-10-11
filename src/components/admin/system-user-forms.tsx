"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clsx } from "clsx";
import { Lock, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, ErrorState, Field, Input, Modal, PasswordInput, Select, Spinner, StatusBadge } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pluralize } from "@/lib/format";
import { isMobileNumber } from "@/lib/phone";
import { applyApiErrors, CUSTOMER_ROLE, SUPER_ADMIN, useRoles, useWarehouseOptions, userName, type AdminUser, type RoleView } from "./system-data";
import { plainText } from "@/lib/rich-text";

// ---------------------------------------------------------------------------
// Role picker
// ---------------------------------------------------------------------------

export function RolePicker({
  roles,
  value,
  onChange,
  disabled,
  includeCustomer = false,
  invalid,
}: {
  roles: RoleView[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
  includeCustomer?: boolean;
  invalid?: boolean;
}) {
  const { user } = useAuth();
  const isSuper = !!user?.roles.includes(SUPER_ADMIN);
  const list = roles.filter((r) => includeCustomer || r.code !== CUSTOMER_ROLE);
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  return (
    <fieldset className={clsx("grid gap-2 sm:grid-cols-2", invalid && "rounded-2xl ring-2 ring-danger/30")} disabled={disabled}>
      <legend className="sr-only">Roles</legend>
      {list.map((r) => {
        const checked = value.includes(r.code);
        const locked = r.code === SUPER_ADMIN && !isSuper;
        const perms = r.permissions.includes("*") ? "Every permission" : pluralize(r.permissions.length, "permission");
        return (
          <label
            key={r.code}
            className={clsx(
              "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
              checked ? "border-ink/40 bg-offwhite" : "border-black/10 hover:border-black/20",
              (locked || disabled) && "cursor-not-allowed opacity-60",
            )}
          >
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={checked} disabled={locked || disabled} onChange={() => toggle(r.code)} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5 font-medium">
                {r.name}
                {r.code === SUPER_ADMIN && <Badge tone="dark">Full access</Badge>}
              </span>
              <span className="block text-xs text-ink/50">
                {r.description ? `${plainText(r.description)} · ` : ""}
                {perms}
              </span>
              {locked && (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                  <Lock size={11} /> Only a super admin can grant this role
                </span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// New staff user
// ---------------------------------------------------------------------------

const createSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  phone: z.string().trim().refine((v) => !v || isMobileNumber(v), "Enter a valid mobile number"),
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().max(60),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128, "At most 128 characters")
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and numbers"),
  roleCodes: z.array(z.string()).min(1, "Choose at least one role"),
  defaultWarehouseId: z.string(),
});
type CreateValues = z.infer<typeof createSchema>;
const CREATE_FIELDS = ["email", "phone", "firstName", "lastName", "password", "roleCodes", "defaultWarehouseId"] as const;

export function CreateStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (u: AdminUser) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const roles = useRoles();
  const warehouses = useWarehouseOptions();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", phone: "", firstName: "", lastName: "", password: "", roleCodes: [], defaultWarehouseId: "" },
  });

  const submit = handleSubmit(async (v) => {
    try {
      const created = await api.post<AdminUser>("/users", {
        email: v.email,
        phone: v.phone || undefined,
        firstName: v.firstName,
        lastName: v.lastName,
        password: v.password,
        roleCodes: v.roleCodes,
        defaultWarehouseId: v.defaultWarehouseId || null,
      });
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      toast(`${userName(created)} can now sign in`);
      onCreated?.(created);
      onClose();
    } catch (err) {
      applyApiErrors(err, setError, CREATE_FIELDS);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="New staff user"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit}>
            Create user
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" error={errors.firstName?.message} required>
            <Input id="firstName" autoComplete="off" invalid={!!errors.firstName} {...register("firstName")} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
            <Input id="lastName" autoComplete="off" invalid={!!errors.lastName} {...register("lastName")} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message} hint="Used to sign in" required>
            <Input id="email" type="email" autoComplete="off" invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field label="Mobile number" htmlFor="phone" error={errors.phone?.message} hint="Optional · they can sign in with it instead of the email">
            <Controller control={control} name="phone" render={({ field }) => <PhoneInput id="phone" invalid={!!errors.phone} {...field} />} />
          </Field>
          <Field label="Temporary password" htmlFor="password" error={errors.password?.message} hint="8+ characters with letters and numbers. Share it securely." required>
            <PasswordInput id="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
          </Field>
          <Field label="Default warehouse" htmlFor="defaultWarehouseId" error={errors.defaultWarehouseId?.message} hint={warehouses.error ? "Warehouses could not be loaded" : "Used for POS billing and stock actions"}>
            <Select id="defaultWarehouseId" disabled={!warehouses.data} {...register("defaultWarehouseId")}>
              <option value="">None</option>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Roles" error={errors.roleCodes?.message} required>
          {roles.error ? (
            <ErrorState error={roles.error} retry={() => roles.refetch()} />
          ) : !roles.data ? (
            <Spinner label="Loading roles" />
          ) : (
            <Controller control={control} name="roleCodes" render={({ field }) => <RolePicker roles={roles.data} value={field.value} onChange={field.onChange} invalid={!!errors.roleCodes} />} />
          )}
        </Field>
        {errors.root && (
          <p role="alert" className="rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Profile (users.write)
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().max(60),
  phone: z.string().trim().refine((v) => !v || isMobileNumber(v), "Enter a valid mobile number"),
  defaultWarehouseId: z.string(),
});
type ProfileValues = z.infer<typeof profileSchema>;
const PROFILE_FIELDS = ["firstName", "lastName", "phone", "defaultWarehouseId"] as const;

export function UserProfileCard({ user, canEdit }: { user: AdminUser; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me, reload } = useAuth();
  const warehouses = useWarehouseOptions();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: user.profile?.firstName ?? "", lastName: user.profile?.lastName ?? "", phone: user.phone ?? "", defaultWarehouseId: user.defaultWarehouseId ?? "" },
  });

  const submit = handleSubmit(async (v) => {
    try {
      const saved = await api.put<AdminUser>(`/users/${user.id}`, {
        firstName: v.firstName,
        lastName: v.lastName || null,
        phone: v.phone || null,
        defaultWarehouseId: v.defaultWarehouseId || null,
      });
      qc.setQueryData(["admin", "user", user.id], saved);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      reset({ firstName: saved.profile?.firstName ?? "", lastName: saved.profile?.lastName ?? "", phone: saved.phone ?? "", defaultWarehouseId: saved.defaultWarehouseId ?? "" });
      if (me?.id === user.id) void reload();
      toast("Profile saved");
    } catch (err) {
      applyApiErrors(err, setError, PROFILE_FIELDS);
    }
  });

  // Keep a warehouse that is set but not in the (possibly unavailable) list selectable.
  const currentMissing = user.defaultWarehouse && !warehouses.data?.some((w) => w.id === user.defaultWarehouse!.id);

  return (
    <Card title="Profile">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="p-first" error={errors.firstName?.message} required>
            <Input id="p-first" invalid={!!errors.firstName} {...register("firstName")} />
          </Field>
          <Field label="Last name" htmlFor="p-last" error={errors.lastName?.message}>
            <Input id="p-last" invalid={!!errors.lastName} {...register("lastName")} />
          </Field>
          <Field label="Email" htmlFor="p-email" hint="Email is the sign-in identity and cannot be changed here">
            <Input id="p-email" value={user.email ?? ""} disabled readOnly />
          </Field>
          <Field label="Mobile number" htmlFor="p-phone" error={errors.phone?.message}>
            <Controller control={control} name="phone" render={({ field }) => <PhoneInput id="p-phone" invalid={!!errors.phone} {...field} />} />
          </Field>
          <Field label="Default warehouse" htmlFor="p-wh" error={errors.defaultWarehouseId?.message} hint={warehouses.error ? "Warehouses could not be loaded" : undefined} className="sm:col-span-2">
            <Select id="p-wh" {...register("defaultWarehouseId")}>
              <option value="">None</option>
              {currentMissing && (
                <option value={user.defaultWarehouse!.id}>
                  {user.defaultWarehouse!.name} ({user.defaultWarehouse!.code})
                </option>
              )}
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code}){w.status !== "ACTIVE" ? " — inactive" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>
        {errors.root && (
          <p role="alert" className="rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
        {canEdit && (
          <div className="flex justify-end gap-2">
            {isDirty && (
              <Button variant="ghost" onClick={() => reset()}>
                Discard
              </Button>
            )}
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save profile
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Roles (users.roles) — confirmed before saving
// ---------------------------------------------------------------------------

export function UserRolesCard({ user, canEdit }: { user: AdminUser; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me, reload } = useAuth();
  const roles = useRoles();
  const initial = user.roles.map((r) => r.code);
  const [selected, setSelected] = useState<string[]>(initial);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = selected.length !== initial.length || selected.some((c) => !initial.includes(c));
  const isSelf = me?.id === user.id;
  const targetIsSuper = initial.includes(SUPER_ADMIN);
  const blockedBySuper = targetIsSuper && !me?.roles.includes(SUPER_ADMIN);

  const save = useMutation({
    mutationFn: () => api.put<AdminUser>(`/users/${user.id}/roles`, { roleCodes: selected }),
    onSuccess: (saved) => {
      qc.setQueryData(["admin", "user", user.id], saved);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      setSelected(saved.roles.map((r) => r.code));
      setConfirming(false);
      setError(null);
      if (isSelf) void reload();
      toast("Roles updated — access changes immediately");
    },
    onError: (e) => {
      setConfirming(false);
      setError(errorMessage(e));
    },
  });

  const added = selected.filter((c) => !initial.includes(c));
  const removed = initial.filter((c) => !selected.includes(c));
  const nameOf = (code: string) => roles.data?.find((r) => r.code === code)?.name ?? code;

  return (
    <Card
      title="Roles"
      actions={
        canEdit && dirty ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setSelected(initial)}>
              Reset
            </Button>
            <Button size="sm" onClick={() => setConfirming(true)}>
              Save roles
            </Button>
          </>
        ) : undefined
      }
    >
      {roles.error ? (
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {user.roles.map((r) => (
              <Badge key={r.code}>{r.name}</Badge>
            ))}
          </div>
          <p className="text-xs text-ink/50">Role details need the roles.read permission ({errorMessage(roles.error)}).</p>
        </div>
      ) : !roles.data ? (
        <Spinner label="Loading roles" />
      ) : (
        <>
          {blockedBySuper && (
            <p className="mb-3 flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
              <ShieldAlert size={14} /> This user is a super admin. Only another super admin can change their roles.
            </p>
          )}
          <RolePicker roles={roles.data} value={selected} onChange={setSelected} disabled={!canEdit || blockedBySuper} includeCustomer={initial.includes(CUSTOMER_ROLE) || !user.isStaff} />
          {selected.length === 0 && canEdit && <p className="mt-3 text-xs text-warning">With no roles this user will lose all access, including the storefront account.</p>}
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </>
      )}
      <ConfirmDialog
        open={confirming}
        title="Change roles?"
        confirmLabel="Save roles"
        loading={save.isPending}
        onConfirm={() => save.mutate()}
        onClose={() => setConfirming(false)}
        body={
          <div className="space-y-2">
            <p>
              {userName(user)}&apos;s access will change immediately, including any open sessions.
              {isSelf && " You are editing your own roles — you may lose access to this page."}
            </p>
            {added.length > 0 && (
              <p>
                <span className="font-semibold text-ink">Adding:</span> {added.map(nameOf).join(", ")}
              </p>
            )}
            {removed.length > 0 && (
              <p>
                <span className="font-semibold text-ink">Removing:</span> {removed.map(nameOf).join(", ")}
              </p>
            )}
            {added.includes(SUPER_ADMIN) && <p className="text-warning">Super admin grants unrestricted access to everything, including role definitions.</p>}
          </div>
        }
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Account status (users.write)
// ---------------------------------------------------------------------------

export function UserStatusCard({ user, canEdit }: { user: AdminUser; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const isSelf = me?.id === user.id;
  const next = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";

  const save = useMutation({
    mutationFn: () => api.post<AdminUser>(`/users/${user.id}/status`, { status: next }),
    onSuccess: (saved) => {
      qc.setQueryData(["admin", "user", user.id], saved);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setConfirming(false);
      toast(saved.status === "ACTIVE" ? "Account enabled" : "Account disabled and signed out everywhere");
    },
    onError: (e) => {
      setConfirming(false);
      toast(errorMessage(e), "error");
    },
  });

  const action = user.status === "ACTIVE" ? "Disable account" : user.status === "LOCKED" ? "Unlock account" : "Enable account";

  return (
    <Card title="Account status" actions={<StatusBadge status={user.status} />}>
      <p className="text-sm text-ink/60">
        {user.status === "ACTIVE"
          ? "This user can sign in."
          : user.status === "LOCKED"
            ? "Locked after too many failed sign-in attempts."
            : "Disabled users cannot sign in and all their sessions are revoked."}
      </p>
      {canEdit && (
        <div className="mt-4">
          <Button variant={next === "DISABLED" ? "outline" : "primary"} className={next === "DISABLED" ? "text-danger" : undefined} disabled={isSelf} onClick={() => setConfirming(true)}>
            {action}
          </Button>
          {isSelf && <p className="mt-2 text-xs text-ink/50">You cannot change the status of your own account.</p>}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title={`${action}?`}
        tone={next === "DISABLED" ? "danger" : "primary"}
        confirmLabel={action}
        loading={save.isPending}
        onConfirm={() => save.mutate()}
        onClose={() => setConfirming(false)}
        body={
          next === "DISABLED"
            ? `${userName(user)} will be signed out of every device immediately and will not be able to sign in until re-enabled.`
            : `${userName(user)} will be able to sign in again${user.status === "LOCKED" ? " and the failed sign-in counter is reset" : ""}.`
        }
      />
    </Card>
  );
}
