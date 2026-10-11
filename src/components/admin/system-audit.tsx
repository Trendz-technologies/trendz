"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { clsx } from "clsx";
import { ChevronRight, Filter } from "lucide-react";
import { Badge } from "@/components/ui";
import { dateTime } from "@/lib/format";

export interface AuditLogRow {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; email: string | null; profile: { firstName: string | null; lastName: string | null } | null } | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Top-level keys whose values differ between the two snapshots. */
export function changedKeys(oldValue: unknown, newValue: unknown): string[] {
  if (!isRecord(oldValue) || !isRecord(newValue)) return [];
  const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
  return [...keys].filter((k) => k in newValue && JSON.stringify(oldValue[k]) !== JSON.stringify(newValue[k]));
}

const actorName = (r: AuditLogRow) => [r.user?.profile?.firstName, r.user?.profile?.lastName].filter(Boolean).join(" ") || r.user?.email || null;

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  user: (id) => `/admin/users/${id}`,
  role: (id) => `/admin/roles/${id}`,
};

function JsonPane({ title, value, tone }: { title: string; value: unknown; tone: "old" | "new" }) {
  const empty = value === null || value === undefined;
  return (
    <div className="min-w-0">
      <p className={clsx("mb-1.5 text-[11px] font-semibold uppercase tracking-wide", tone === "old" ? "text-ink/45" : "text-ink/70")}>{title}</p>
      {empty ? (
        <p className="rounded-xl border border-dashed border-black/10 px-3 py-6 text-center text-xs text-ink/40">No value recorded</p>
      ) : (
        <pre className={clsx("max-h-96 overflow-auto rounded-xl px-3 py-2.5 font-mono text-[12px] leading-relaxed", tone === "old" ? "bg-black/[0.035] text-ink/75" : "bg-info/[0.05] text-ink")}>
          {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AuditTable({ rows, onFilter }: { rows: AuditLogRow[]; onFilter: (f: { userId?: string; entityType?: string; entityId?: string; action?: string }) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
            <th className="w-10 px-3 py-2.5" aria-label="Expand" />
            <th className="px-3 py-2.5 font-semibold">Time</th>
            <th className="px-3 py-2.5 font-semibold">Action</th>
            <th className="px-3 py-2.5 font-semibold">Entity</th>
            <th className="px-3 py-2.5 font-semibold">User</th>
            <th className="px-5 py-2.5 font-semibold">IP address</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const expanded = open.has(r.id);
            const changed = changedKeys(r.oldValue, r.newValue);
            const name = actorName(r);
            const detailsId = `audit-${r.id}`;
            return (
              <Fragment key={r.id}>
                <tr className={clsx("border-b border-black/[0.04] align-top hover:bg-black/[0.015]", expanded && "bg-black/[0.015]")}>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      aria-expanded={expanded}
                      aria-controls={detailsId}
                      aria-label={expanded ? "Hide details" : "Show details"}
                      className="rounded-full p-1 text-ink/45 hover:bg-black/5 hover:text-ink"
                    >
                      <ChevronRight size={15} className={clsx("transition-transform", expanded && "rotate-90")} />
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink/70">{dateTime(r.createdAt)}</td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => onFilter({ action: r.action })} title="Show only this action" className="rounded-md font-mono text-[12px] font-semibold hover:underline">
                      {r.action}
                    </button>
                    {changed.length > 0 && <p className="mt-0.5 text-xs text-ink/45">{changed.length > 4 ? `${changed.length} fields changed` : changed.join(", ")}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge>{r.entityType}</Badge>
                      {r.entityId &&
                        (ENTITY_LINKS[r.entityType] && /^[0-9a-f-]{36}$/i.test(r.entityId) ? (
                          <Link href={ENTITY_LINKS[r.entityType]!(r.entityId)} className="link font-mono text-[11px]">
                            {r.entityId.length > 14 ? `${r.entityId.slice(0, 8)}…` : r.entityId}
                          </Link>
                        ) : (
                          <span className="font-mono text-[11px] text-ink/55" title={r.entityId}>
                            {r.entityId.length > 14 ? `${r.entityId.slice(0, 8)}…` : r.entityId}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {r.user ? (
                      <button type="button" onClick={() => onFilter({ userId: r.user!.id })} title="Show only this user's actions" className="text-left hover:underline">
                        <span className="block font-medium">{name}</span>
                        {name !== r.user.email && r.user.email && <span className="block text-xs text-ink/45">{r.user.email}</span>}
                      </button>
                    ) : (
                      <span className="text-ink/45">{r.userId ? "Deleted user" : "System"}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-[12px] text-ink/60">{r.ipAddress ?? "—"}</td>
                </tr>
                {expanded && (
                  <tr id={detailsId} className="border-b border-black/[0.06] bg-black/[0.015]">
                    <td />
                    <td colSpan={5} className="px-3 pb-5 pt-1">
                      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/55">
                        <span>
                          Entity ID: <code className="text-ink/75">{r.entityId ?? "—"}</code>
                        </span>
                        {r.entityId && (
                          <button type="button" onClick={() => onFilter({ entityType: r.entityType, entityId: r.entityId! })} className="inline-flex items-center gap-1 font-semibold text-ink/70 hover:text-ink">
                            <Filter size={11} /> History of this {r.entityType.replace(/_/g, " ")}
                          </button>
                        )}
                        {r.userAgent && (
                          <span className="min-w-0 truncate" title={r.userAgent}>
                            Agent: {r.userAgent}
                          </span>
                        )}
                      </div>
                      {changed.length > 0 && (
                        <div className="mb-3 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-ink/50">Changed:</span>
                          {changed.map((k) => (
                            <code key={k} className="rounded-md bg-info/10 px-1.5 py-0.5 text-[11px] text-info">
                              {k}
                            </code>
                          ))}
                        </div>
                      )}
                      <div className="grid gap-3 md:grid-cols-2">
                        <JsonPane title="Before" value={r.oldValue} tone="old" />
                        <JsonPane title="After" value={r.newValue} tone="new" />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
