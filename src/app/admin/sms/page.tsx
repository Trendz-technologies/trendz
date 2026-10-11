"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { Can, PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { Button, Card, DataTable, EmptyState, ErrorState, Pagination, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { ErrorText, MessagingTabs, SendTestModal } from "@/components/admin/system-messaging";

interface SmsLogRow {
  id: string;
  notificationId: string | null;
  phone: string;
  template: string;
  body: string;
  provider: string;
  providerMessageId: string | null;
  status: string;
  error: string | null;
  createdAt: string;
}

export default function SmsLogPage() {
  const [testing, setTesting] = useState(false);
  const { page, filters, set, setPage } = useListState({ q: "" });
  const q = useQuery({
    queryKey: ["admin", "sms-logs", page, filters],
    queryFn: () => api.page<SmsLogRow[]>("/sms-logs", { page, limit: 25, q: filters.q.replace(/[^\d+]/g, "").slice(0, 20) }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="SMS log"
        description="Every SMS handed to the provider. One-time passwords are masked before they are stored."
        actions={
          <Can permission="notifications.manage">
            <Button icon={<Send size={15} />} onClick={() => setTesting(true)}>
              Send test
            </Button>
          </Can>
        }
      />
      <MessagingTabs />
      <Card>
        <div className="mb-4">
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Search by phone number" />
        </div>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(r) => r.id}
            empty={<EmptyState icon={<MessageSquare size={22} />} title={filters.q ? "No messages to this number" : "No SMS sent yet"} />}
            columns={[
              { key: "time", header: "Sent", cell: (r) => <span className="whitespace-nowrap text-ink/70">{dateTime(r.createdAt)}</span> },
              { key: "phone", header: "Phone", cell: (r) => <span className="whitespace-nowrap font-mono text-[13px]">{r.phone}</span> },
              {
                key: "body",
                header: "Message",
                cell: (r) => (
                  <div className="max-w-md">
                    <p className="line-clamp-2 text-sm" title={r.body}>
                      {r.body}
                    </p>
                    <code className="text-[11px] text-ink/45">{r.template}</code>
                  </div>
                ),
              },
              {
                key: "provider",
                header: "Provider",
                cell: (r) => (
                  <div>
                    <p className="text-ink/70">{r.provider}</p>
                    {r.providerMessageId && (
                      <p className="max-w-[140px] truncate font-mono text-[11px] text-ink/40" title={r.providerMessageId}>
                        {r.providerMessageId}
                      </p>
                    )}
                  </div>
                ),
              },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status.toUpperCase()} /> },
              { key: "error", header: "Error", cell: (r) => <ErrorText text={r.error} /> },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
      {testing && <SendTestModal onClose={() => setTesting(false)} />}
    </>
  );
}
