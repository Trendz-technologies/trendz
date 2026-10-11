"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, MessageSquare, RefreshCw, RotateCw, Send, Smartphone } from "lucide-react";
import { Can, PageHeader, useListState } from "@/components/admin/page";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Pagination, Select, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { ErrorText, MessagingTabs, SendTestModal } from "@/components/admin/system-messaging";

interface NotificationRow {
  id: string;
  channel: "EMAIL" | "SMS" | "IN_APP";
  template: string;
  recipient: string | null;
  subject: string | null;
  title: string | null;
  status: "PENDING" | "SENT" | "FAILED";
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  userId: string | null;
}

const CHANNEL_ICON = { EMAIL: Mail, SMS: MessageSquare, IN_APP: Smartphone } as const;
const CHANNEL_LABEL = { EMAIL: "Email", SMS: "SMS", IN_APP: "In-app" } as const;

export default function NotificationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const [testing, setTesting] = useState(false);
  const { page, filters, set, setPage } = useListState({ channel: "", status: "" });

  const q = useQuery({
    queryKey: ["admin", "notifications", page, filters],
    queryFn: () => api.page<NotificationRow[]>("/notifications", { page, limit: 25, channel: filters.channel, status: filters.status }),
    placeholderData: keepPreviousData,
    // Poll while something is still being delivered.
    refetchInterval: (query) => (query.state.data?.data.some((n) => n.status === "PENDING") ? 10_000 : false),
  });

  const retry = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/retry`),
    onSuccess: () => {
      toast("Queued for another attempt");
      void qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const canManage = can("notifications.manage");

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Delivery log for every email, SMS and in-app message. Failed messages are retried automatically; you can also retry them here."
        actions={
          <>
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} className={q.isFetching ? "animate-spin" : undefined} />} onClick={() => q.refetch()}>
              Refresh
            </Button>
            <Can permission="notifications.manage">
              <Button icon={<Send size={15} />} onClick={() => setTesting(true)}>
                Send test
              </Button>
            </Can>
          </>
        }
      />
      <MessagingTabs />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select aria-label="Channel" value={filters.channel} onChange={(e) => set({ channel: e.target.value })} className="w-40">
            <option value="">All channels</option>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="IN_APP">In-app</option>
          </Select>
          <Select aria-label="Status" value={filters.status} onChange={(e) => set({ status: e.target.value })} className="w-40">
            <option value="">Any status</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </Select>
          {filters.status !== "FAILED" && (
            <Button variant="ghost" size="sm" onClick={() => set({ status: "FAILED" })}>
              Show failures
            </Button>
          )}
        </div>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(n) => n.id}
            empty={<EmptyState icon={<Bell size={22} />} title={filters.channel || filters.status ? "No notifications match these filters" : "No notifications yet"} />}
            columns={[
              {
                key: "created",
                header: "Created",
                cell: (n) => <span className="whitespace-nowrap text-ink/70">{dateTime(n.createdAt)}</span>,
              },
              {
                key: "channel",
                header: "Channel",
                cell: (n) => {
                  const Icon = CHANNEL_ICON[n.channel];
                  return (
                    <span className="inline-flex items-center gap-1.5 text-ink/70">
                      <Icon size={14} /> {CHANNEL_LABEL[n.channel]}
                    </span>
                  );
                },
              },
              {
                key: "message",
                header: "Message",
                cell: (n) => (
                  <div className="min-w-0 max-w-xs">
                    <p className="truncate font-medium">{n.subject ?? n.title ?? n.template}</p>
                    <p className="truncate text-xs text-ink/50">
                      <code>{n.template}</code>
                      {n.recipient ? ` · ${n.recipient}` : ""}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (n) => (
                  <div>
                    <StatusBadge status={n.status} />
                    {n.sentAt && <p className="mt-0.5 whitespace-nowrap text-[11px] text-ink/45">{dateTime(n.sentAt)}</p>}
                  </div>
                ),
              },
              { key: "attempts", header: "Attempts", align: "right", cell: (n) => (n.attempts > 1 ? <Badge tone="warning">{n.attempts}</Badge> : n.attempts) },
              { key: "error", header: "Last error", cell: (n) => <ErrorText text={n.lastError} /> },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (n) =>
                  canManage && n.status === "FAILED" ? (
                    <Button variant="outline" size="sm" icon={<RotateCw size={13} />} loading={retry.isPending && retry.variables === n.id} disabled={retry.isPending && retry.variables !== n.id} onClick={() => retry.mutate(n.id)}>
                      Retry
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
      {testing && <SendTestModal onClose={() => setTesting(false)} />}
    </>
  );
}
