"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Undo2 } from "lucide-react";
// Drops the server's cached store config, which carries the CMS content as well as the theme.
import { refreshThemeCache } from "@/app/admin/appearance/actions";
import { Badge, Button, Card, Checkbox } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";

/*
 * What the editors under Admin → CMS share. Each one edits a single setting
 * (homePage, contact, termsPage, privacyPage): load it, keep the unsaved edits
 * beside it, save the whole thing.
 */

interface ContentRecord<T> {
  value: T;
  updatedAt: string | null;
  updatedBy: string | null;
}

// The API names the field that is wrong ("Write the page before publishing it"); its general message does not.
const failure = (err: unknown) => (err instanceof ApiError && err.errors[0] ? err.errors[0].message : errorMessage(err));

export function useContentEditor<T extends object>(key: string) {
  const { can } = useAuth();
  const canEdit = can("settings.write");
  const qc = useQueryClient();
  const toast = useToast();
  const queryKey = ["admin", "settings", key];

  const record = useQuery({ queryKey, queryFn: () => api.get<ContentRecord<T>>(`/settings/${key}`) });
  const saved = record.data?.value ?? null;
  // Unsaved edits; null means "showing what is saved".
  const [edits, setEdits] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const draft = edits ?? saved;
  const dirty = !!(edits && saved && JSON.stringify(edits) !== JSON.stringify(saved));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** `done` is the sentence for the toast ("Home page saved."); `visible` is false when the store does not show what was saved (a draft). */
  const save = async (done: string, visible = true) => {
    if (!draft) return;
    setSaving(true);
    try {
      const value = await api.put<T>(`/settings/${key}`, draft);
      qc.setQueryData<ContentRecord<T>>(queryKey, (r) => (r ? { ...r, value, updatedAt: new Date().toISOString() } : r));
      setEdits(null);
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ["store-config"] });
      // The storefront reads a copy cached on the server for a minute; drop it so the change shows now.
      const live = await refreshThemeCache().catch(() => false);
      toast(live || !visible ? done : `${done} The store shows it within a few minutes.`);
    } catch (err) {
      toast(failure(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return {
    record,
    draft,
    dirty,
    saving,
    canEdit,
    edit: (patch: Partial<T>) => draft && setEdits({ ...draft, ...patch }),
    discard: () => setEdits(null),
    save,
    savedLabel: record.data?.updatedAt ? `Saved ${dateTime(record.data.updatedAt)}${record.data.updatedBy ? ` by ${record.data.updatedBy}` : ""}` : "Starting content (never saved)",
  };
}

/** The buttons at the top right of every CMS editor. `view` is the storefront page being edited; leave it out while there is nothing to see. */
export function ContentActions({
  editor,
  view,
  saveLabel,
  onSave,
}: {
  editor: Pick<ReturnType<typeof useContentEditor>, "dirty" | "saving" | "canEdit" | "discard">;
  view?: { href: string; label: string };
  saveLabel: string;
  onSave: () => void;
}) {
  return (
    <>
      {!editor.canEdit ? <Badge>Read only</Badge> : editor.dirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
      {view && (
        <Link href={view.href} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink/70 hover:bg-black/[0.04] hover:text-ink">
          {view.label} <ExternalLink size={14} />
        </Link>
      )}
      <Button variant="outline" icon={<Undo2 size={15} />} disabled={!editor.dirty || editor.saving} onClick={editor.discard}>
        Discard
      </Button>
      <Button icon={<Check size={15} />} disabled={!editor.dirty || !editor.canEdit} loading={editor.saving} onClick={onSave}>
        {saveLabel}
      </Button>
    </>
  );
}

/** A block of the page being edited. With `onToggle` it can be taken off the page; its fields dim while it is off. */
export function ContentSection({
  title,
  note,
  enabled = true,
  onToggle,
  disabled,
  children,
}: {
  title: string;
  /** One line on where the block sits or what fills it. */
  note?: ReactNode;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Card title={title} actions={onToggle && <Checkbox label="Show on the home page" checked={enabled} disabled={disabled} onChange={(e) => onToggle(e.target.checked)} />}>
      {note && <p className="mb-4 text-xs leading-relaxed text-ink/55">{note}</p>}
      <div className={enabled ? "space-y-4" : "space-y-4 opacity-55"}>{children}</div>
    </Card>
  );
}
