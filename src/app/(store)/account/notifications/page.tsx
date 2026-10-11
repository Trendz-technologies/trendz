"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Bell, BellRing } from "lucide-react";
import { AccountHeader, EmptyPanel, Panel, RowArrow, RowsSkeleton, StaggerList, StaggerRow } from "@/components/store/account-ui";
import { Pagination } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

interface Note {
  id: string;
  title: string | null;
  body: string | null;
  payload: { link?: string | null } | null;
  readAt: string | null;
  createdAt: string;
}

const rowClass = "group flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-offwhite/70 focus-visible:bg-offwhite focus-visible:outline-none sm:px-7";

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ["notifications", page], queryFn: () => api.page<Note[]>("/account/notifications", { page, limit: 20 }) });
  const read = useMutation({ mutationFn: (id: string) => api.post(`/account/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });

  return (
    <div className="space-y-8">
      <AccountHeader eyebrow={t("Inbox")} title={t("Notifications")} description={t("Order updates, refunds and account news — newest first.")} />
      {!q.isLoading && !q.data?.data.length ? (
        <EmptyPanel icon={<Bell size={28} strokeWidth={1.5} />} title={t("You're all caught up")} body={t("New updates about your orders will show up here.")} />
      ) : (
        <Panel padded={false}>
          {q.isLoading ? (
            <RowsSkeleton thumb={false} rows={4} label={t("Loading notifications")} />
          ) : (
            <StaggerList key={page} className="divide-y divide-black/5 py-1">
              {q.data?.data.map((n) => {
                const unread = !n.readAt;
                const content = (
                  <>
                    <span className="relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-offwhite text-ink/70 transition-colors duration-500 group-hover:bg-ink group-hover:text-white">
                      {unread ? <BellRing size={16} strokeWidth={1.75} /> : <Bell size={16} strokeWidth={1.75} />}
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-accent transition-[scale,opacity] duration-500",
                          unread ? "animate-pulse-dot" : "scale-0 opacity-0",
                        )}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={clsx("text-sm", unread ? "font-semibold" : "text-ink/75")}>
                        {n.title}
                        {unread && <span className="sr-only"> {t("(unread)")}</span>}
                      </p>
                      {n.body && <p className="mt-0.5 text-sm text-ink/60">{n.body}</p>}
                      <p className="mt-1.5 text-xs text-ink/40">{dateTime(n.createdAt, locale)}</p>
                    </div>
                    {n.payload?.link && <RowArrow className="mt-0.5 hidden sm:grid" />}
                  </>
                );
                return (
                  <StaggerRow key={n.id}>
                    {n.payload?.link ? (
                      <Link href={n.payload.link} onClick={() => !n.readAt && read.mutate(n.id)} className={rowClass}>
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => !n.readAt && read.mutate(n.id)} className={rowClass}>
                        {content}
                      </button>
                    )}
                  </StaggerRow>
                );
              })}
            </StaggerList>
          )}
        </Panel>
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </div>
  );
}
