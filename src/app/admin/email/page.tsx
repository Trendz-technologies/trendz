"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import { Can, PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { Button, Card, DataTable, EmptyState, ErrorState, Pagination, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { ErrorText, MessagingTabs, SendTestModal } from "@/components/admin/system-messaging";

interface EmailLogRow {
  id: string;
  notificationId: string | null;
  to: string;
  subject: string;
  template: string;
  provider: string;
  providerMessageId: string | null;
  status: string;
  error: string | null;
  createdAt: string;
}

export default function EmailLogPage() {
  const [testing, setTesting] = useState(false);
  const { page, filters, set, setPage } = useListState({ q: "" });
  const q = useQuery({
    queryKey: ["admin", "email-logs", page, filters],
    queryFn: () => api.page<EmailLogRow[]>("/email-logs", { page, limit: 25, q: filters.q.trim().slice(0, 200) }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Email log"
        description="Every email handed to the provider. Password-reset and verification links are never stored."
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
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Search by recipient email" />
        </div>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(r) => r.id}
            empty={<EmptyState icon={<Mail size={22} />} title={filters.q ? "No emails to this recipient" : "No emails sent yet"} />}
            columns={[
              { key: "time", header: "Sent", cell: (r) => <span className="whitespace-nowrap text-ink/70">{dateTime(r.createdAt)}</span> },
              { key: "to", header: "Recipient", cell: (r) => <span className="block max-w-[220px] truncate" title={r.to}>{r.to}</span> },
              {
                key: "subject",
                header: "Subject",
                cell: (r) => (
                  <div className="max-w-sm">
                    <p className="truncate font-medium" title={r.subject}>
                      {r.subject}
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
                      <p className="max-w-[160px] truncate font-mono text-[11px] text-ink/40" title={r.providerMessageId}>
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
