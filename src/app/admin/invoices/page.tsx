"use client";

import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ReceiptText } from "lucide-react";
import { Can, PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { ChannelBadge, DateRange, dayEndIso, dayStartIso, DownloadButton, FilterBar, pdfName, RowLink, useDownloader } from "@/components/admin/sales-shared";
import type { PaymentStatus } from "@/components/admin/sales-types";
import { Card, DataTable, EmptyState, ErrorState, Pagination, StatusBadge, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { date, moneyExact } from "@/lib/format";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  status: "ISSUED" | "CANCELLED";
  grandTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  paymentStatus: PaymentStatus;
  buyer: { name?: string | null; email?: string | null; phone?: string | null } | null;
  order: { id: string; orderNumber: string; channel: "ONLINE" | "POS" };
}

interface CreditNoteRow {
  id: string;
  creditNoteNumber: string;
  invoiceId: string;
  orderId: string;
  refundId: string | null;
  reason: string | null;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  total: number;
  issuedAt: string;
  invoice: { invoiceNumber: string };
  order: { orderNumber: string };
}

type Tab = "invoices" | "credit-notes";
const DEFAULTS = { tab: "invoices", q: "", from: "", to: "" };

export default function InvoicesPage() {
  const { page, filters, set, setPage } = useListState(DEFAULTS);
  const tab: Tab = filters.tab === "credit-notes" ? "credit-notes" : "invoices";

  return (
    <>
      <PageHeader
        title="Invoices"
        description="GST tax invoices issued for paid orders, and the credit notes issued against them for refunds."
        actions={
          <Tabs<Tab>
            value={tab}
            onChange={(t) => set({ tab: t, q: "", from: "", to: "" })}
            tabs={[
              { value: "invoices", label: "Invoices" },
              { value: "credit-notes", label: "Credit notes" },
            ]}
          />
        }
      />
      {tab === "invoices" ? <InvoicesTab page={page} filters={filters} set={set} setPage={setPage} /> : <CreditNotesTab page={page} setPage={setPage} />}
    </>
  );
}

function InvoicesTab({ page, filters, set, setPage }: { page: number; filters: typeof DEFAULTS; set: (c: Partial<typeof DEFAULTS>) => void; setPage: (p: number) => void }) {
  const router = useRouter();
  const { busy, run } = useDownloader();
  const q = useQuery({
    queryKey: ["admin", "invoices", page, filters.q, filters.from, filters.to],
    queryFn: () => api.page<InvoiceRow[]>("/invoices", { page, limit: 25, q: filters.q, from: dayStartIso(filters.from), to: dayEndIso(filters.to) }),
    placeholderData: keepPreviousData,
  });
  const filtered = !!(filters.q || filters.from || filters.to);

  return (
    <Card>
      <FilterBar active={filtered} onClear={() => set({ q: "", from: "", to: "" })}>
        <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Invoice or order number" />
        <DateRange from={filters.from} to={filters.to} onChange={(v) => set(v)} />
      </FilterBar>
      {q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <DataTable
          loading={q.isLoading}
          rows={q.data?.data}
          rowKey={(i) => i.id}
          onRowClick={(i) => router.push(`/admin/orders/${i.order.id}`)}
          empty={<EmptyState icon={<ReceiptText size={22} />} title={filtered ? "No invoices match these filters" : "No invoices yet"} body={filtered ? undefined : "Invoices are issued automatically when an order is paid, or from the order page."} />}
          columns={[
            { key: "number", header: "Invoice", cell: (i) => <span className="font-mono text-xs font-semibold">{i.invoiceNumber}</span> },
            { key: "issued", header: "Issued", cell: (i) => <span className="whitespace-nowrap text-ink/70">{date(i.issuedAt)}</span> },
            {
              key: "order",
              header: "Order",
              cell: (i) => (
                <div className="flex items-center gap-2">
                  <RowLink href={`/admin/orders/${i.order.id}`}>{i.order.orderNumber}</RowLink>
                  <ChannelBadge channel={i.order.channel} />
                </div>
              ),
            },
            {
              key: "buyer",
              header: "Billed to",
              cell: (i) => (
                <div className="min-w-0">
                  <p className="max-w-44 truncate">{i.buyer?.name ?? "—"}</p>
                  <p className="max-w-44 truncate text-xs text-ink/50">{i.buyer?.email ?? i.buyer?.phone ?? ""}</p>
                </div>
              ),
            },
            { key: "gst", header: "GST", align: "right", cell: (i) => moneyExact(i.cgstTotal + i.sgstTotal + i.igstTotal) },
            { key: "total", header: "Total", align: "right", cell: (i) => <span className="font-semibold">{moneyExact(i.grandTotal)}</span> },
            {
              key: "status",
              header: "Status",
              cell: (i) => (
                <div className="flex flex-wrap gap-1">
                  {i.status === "CANCELLED" ? <StatusBadge status="CANCELLED" /> : null}
                  <StatusBadge status={i.paymentStatus} />
                </div>
              ),
            },
            {
              key: "pdf",
              header: "",
              align: "right",
              cell: (i) => (
                <Can permission="invoices.read">
                  <DownloadButton variant="ghost" busy={busy === i.id} label={`Download invoice ${i.invoiceNumber}`} onClick={() => run(i.id, `/invoices/${i.id}/pdf?download=1`, pdfName(i.invoiceNumber))}>
                    PDF
                  </DownloadButton>
                </Can>
              ),
            },
          ]}
        />
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </Card>
  );
}

function CreditNotesTab({ page, setPage }: { page: number; setPage: (p: number) => void }) {
  const router = useRouter();
  const { busy, run } = useDownloader();
  const q = useQuery({
    queryKey: ["admin", "credit-notes", page],
    queryFn: () => api.page<CreditNoteRow[]>("/credit-notes", { page, limit: 25 }),
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      {q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <DataTable
          loading={q.isLoading}
          rows={q.data?.data}
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/admin/orders/${c.orderId}`)}
          empty={<EmptyState icon={<ReceiptText size={22} />} title="No credit notes yet" body="A credit note is issued automatically for every refund on an invoiced order." />}
          columns={[
            { key: "number", header: "Credit note", cell: (c) => <span className="font-mono text-xs font-semibold">{c.creditNoteNumber}</span> },
            { key: "issued", header: "Issued", cell: (c) => <span className="whitespace-nowrap text-ink/70">{date(c.issuedAt)}</span> },
            { key: "invoice", header: "Against invoice", cell: (c) => <span className="font-mono text-xs">{c.invoice.invoiceNumber}</span> },
            { key: "order", header: "Order", cell: (c) => <RowLink href={`/admin/orders/${c.orderId}`}>{c.order.orderNumber}</RowLink> },
            {
              key: "reason",
              header: "Reason",
              cell: (c) => (
                <p className="max-w-60 truncate text-ink/70" title={c.reason ?? undefined}>
                  {c.reason ?? "—"}
                </p>
              ),
            },
            { key: "gst", header: "GST", align: "right", cell: (c) => moneyExact(c.cgstTotal + c.sgstTotal + c.igstTotal) },
            { key: "total", header: "Total", align: "right", cell: (c) => <span className="font-semibold">{moneyExact(c.total)}</span> },
            {
              key: "pdf",
              header: "",
              align: "right",
              cell: (c) => (
                <Can permission="invoices.read">
                  <DownloadButton variant="ghost" busy={busy === c.id} label={`Download credit note ${c.creditNoteNumber}`} onClick={() => run(c.id, `/credit-notes/${c.id}/pdf?download=1`, pdfName(c.creditNoteNumber))}>
                    PDF
                  </DownloadButton>
                </Can>
              ),
            },
          ]}
        />
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </Card>
  );
}
