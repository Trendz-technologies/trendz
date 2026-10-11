"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Landmark } from "lucide-react";
import { PageHeader, useListState } from "@/components/admin/page";
import { Badge, Card, ConfirmDialog, ErrorState, Field, Select, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStates } from "@/components/admin/system-data";
import { SETTING_GROUPS, SettingsGroupForm, type SettingsMap } from "@/components/admin/system-settings-forms";
import { TaxClassesSection } from "@/components/admin/system-tax-classes";

const TAX = "tax-classes";
const SECTIONS = [...SETTING_GROUPS.map((g) => ({ key: g.key as string, label: g.label, icon: g.icon, sensitive: !!g.sensitive })), { key: TAX, label: "Tax classes (GST)", icon: Landmark, sensitive: true }];

export default function SettingsPage() {
  const { can } = useAuth();
  const canEdit = can("settings.write");
  const { filters, set } = useListState({ group: "store" });
  const active = SECTIONS.some((s) => s.key === filters.group) ? filters.group : "store";

  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api.get<SettingsMap>("/settings") });
  const states = useStates();

  // Unsaved-changes guard when switching groups.
  const dirty = useRef(false);
  const onDirtyChange = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);
  const [pendingGroup, setPendingGroup] = useState<string | null>(null);
  const go = (key: string) => {
    if (key === active) return;
    if (dirty.current) setPendingGroup(key);
    else set({ group: key });
  };

  const group = SETTING_GROUPS.find((g) => g.key === active);
  const current = SECTIONS.find((s) => s.key === active)!;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Business rules that affect prices, tax, stock and messaging. Every change is recorded in the audit log."
        actions={!canEdit ? <Badge>Read only</Badge> : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:self-start">
          <div className="lg:hidden">
            <Field label="Section" htmlFor="settings-section">
              <Select id="settings-section" value={active} onChange={(e) => go(e.target.value)}>
                {SECTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <ul className="hidden space-y-0.5 lg:block">
            {SECTIONS.map(({ key, label, icon: Icon, sensitive }) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => go(key)}
                  aria-current={key === active ? "page" : undefined}
                  className={clsx(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                    key === active ? "bg-white text-ink shadow-neu" : "text-ink/60 hover:bg-black/[0.03] hover:text-ink",
                  )}
                >
                  <Icon size={15} strokeWidth={1.75} />
                  <span className="flex-1">{label}</span>
                  {sensitive && <span className="h-1.5 w-1.5 rounded-full bg-warning" title="Affects money or tax" aria-label="Affects money or tax" />}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 hidden items-center gap-2 px-3 text-[11px] text-ink/45 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Affects money or tax
          </p>
        </nav>

        <div className="min-w-0">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{current.label}</h2>
            <p className="text-sm text-ink/55">{group ? group.description : "GST rates per product type, with price slabs and effective dates."}</p>
          </div>
          {active === TAX ? (
            <TaxClassesSection canEdit={canEdit} />
          ) : settings.error ? (
            <Card>
              <ErrorState error={settings.error} retry={() => settings.refetch()} />
            </Card>
          ) : !settings.data || (active === "store" && states.isLoading) ? (
            <Spinner label="Loading settings" />
          ) : group ? (
            <SettingsGroupForm key={group.key} group={group} value={settings.data[group.key]} states={states.data ?? []} canEdit={canEdit} onDirtyChange={onDirtyChange} />
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={!!pendingGroup}
        title="Discard unsaved changes?"
        body="You have changes in this section that have not been saved."
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={() => {
          dirty.current = false;
          if (pendingGroup) set({ group: pendingGroup });
          setPendingGroup(null);
        }}
        onClose={() => setPendingGroup(null)}
      />
    </>
  );
}
