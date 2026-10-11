"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, RotateCcw } from "lucide-react";
import { Can } from "@/components/admin/page";
import { Button, Card, ConfirmDialog, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date, dateTime, moneyExact } from "@/lib/format";
import type { OrderAddress } from "@/lib/types";
import { DefinitionList, DownloadButton, pdfName, useDownloader, useInvalidateSales } from "./sales-shared";
import type { StaffOrder } from "./sales-types";

/** Payment states that allow an invoice to be issued. */
const INVOICEABLE = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];

function AddressBlock({ title, address }: { title: string; address: OrderAddress | null }) {
  if (!address) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/45">{title}</p>
      <address className="text-sm not-italic leading-relaxed text-ink/75">
        <span className="font-medium text-ink">{address.fullName}</span>
        <br />
        {address.line1}
        {address.line2 && (
          <>
            <br />
            {address.line2}
          </>
        )}
        {address.landmark && (
          <>
            <br />
            Near {address.landmark}
          </>
        )}
        <br />
        {address.city}, {address.state} {address.postalCode}
        <br />
        {address.phone}
      </address>
    </div>
  );
}

const sameAddress = (a: OrderAddress | null, b: OrderAddress | null) => !!a && !!b && a.line1 === b.line1 && a.postalCode === b.postalCode && a.fullName === b.fullName;

export function OrderCustomerCard({ order: o }: { order: StaffOrder }) {
  return (
    <Card title="Customer">
      <div className="space-y-4">
        <DefinitionList
          rows={[
            { label: "Name", value: o.customerName ?? (o.channel === "POS" ? "Walk-in customer" : "—") },
            { label: "Email", value: o.customerEmail ? <a className="link break-all" href={`mailto:${o.customerEmail}`}>{o.customerEmail}</a> : "—" },
            { label: "Phone", value: o.customerPhone ? <a className="link" href={`tel:${o.customerPhone}`}>{o.customerPhone}</a> : "—" },
            {
              label: "Account",
              value: o.user ? (
                <Link href={`/admin/customers/${o.user.id}`} className="link">
                  View customer
                </Link>
              ) : (
                "Guest"
              ),
            },
          ]}
        />
        {o.channel === "POS" && (
          <DefinitionList
            className="border-t border-black/5 pt-4"
            rows={[
              { label: "Billed at", value: o.warehouse ? `${o.warehouse.name} (${o.warehouse.code})` : "—" },
              { label: "Cashier", value: o.createdBy?.email ?? "—" },
            ]}
          />
        )}
        {(o.shippingAddress || o.billingAddress) && (
          <div className="space-y-4 border-t border-black/5 pt-4">
            <AddressBlock title="Ship to" address={o.shippingAddress} />
            {sameAddress(o.shippingAddress, o.billingAddress) ? <p className="text-xs text-ink/50">Billing address is the same.</p> : <AddressBlock title="Bill to" address={o.billingAddress} />}
          </div>
        )}
        <DefinitionList
          className="border-t border-black/5 pt-4"
          rows={[
            { label: "Place of supply", value: o.placeOfSupply },
            { label: "Coupon", value: o.couponCode ?? "—", hidden: !o.couponCode },
            { label: "Confirmed", value: dateTime(o.confirmedAt), hidden: !o.confirmedAt },
            { label: "Delivered", value: dateTime(o.deliveredAt), hidden: !o.deliveredAt },
            { label: "Cancelled", value: dateTime(o.cancelledAt), hidden: !o.cancelledAt },
            { label: "Payment hold until", value: dateTime(o.reservationExpiresAt), hidden: o.status !== "PENDING" || !o.reservationExpiresAt },
          ]}
        />
        {o.cancelReason && <p className="rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">Cancelled: {o.cancelReason}</p>}
        {o.notes && (
          <div className="border-t border-black/5 pt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/45">Order notes</p>
            <p className="whitespace-pre-line text-sm text-ink/75">{o.notes}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export function OrderDocumentsCard({ order: o }: { order: StaffOrder }) {
  const toast = useToast();
  const invalidate = useInvalidateSales();
  const { busy, run } = useDownloader();
  const [confirmIssue, setConfirmIssue] = useState(false);
  const canInvoice = INVOICEABLE.includes(o.paymentStatus);

  const issue = useMutation({
    mutationFn: () => api.post<{ id: string; invoiceNumber: string }>(`/invoices/${o.id}`),
    onSuccess: (inv) => {
      setConfirmIssue(false);
      toast(`Invoice ${inv.invoiceNumber} issued`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
    onSettled: () => void invalidate(o.id),
  });

  return (
    <Card title="Documents">
      <div className="space-y-5 text-sm">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Tax invoice</p>
          {o.invoice ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <FileText size={14} className="shrink-0 text-ink/40" /> {o.invoice.invoiceNumber}
                </p>
                <p className="text-xs text-ink/50">
                  Issued {date(o.invoice.issuedAt)}
                  {o.invoice.status !== "ISSUED" && <> · {o.invoice.status.toLowerCase()}</>}
                </p>
              </div>
              <Can permission="invoices.read">
                <DownloadButton busy={busy === "invoice"} label={`Download invoice ${o.invoice.invoiceNumber}`} onClick={() => o.invoice && run("invoice", `/invoices/${o.invoice.id}/pdf?download=1`, pdfName(o.invoice.invoiceNumber))}>
                  PDF
                </DownloadButton>
              </Can>
            </div>
          ) : canInvoice ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-ink/55">No invoice issued yet.</p>
              <Can permission="invoices.write" fallback={<span className="text-xs text-ink/40">Not issued</span>}>
                <Button variant="secondary" size="sm" onClick={() => setConfirmIssue(true)}>
                  Issue invoice
                </Button>
              </Can>
            </div>
          ) : (
            <p className="text-ink/55">An invoice can be issued once the order is paid.</p>
          )}
        </section>

        {o.creditNotes.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Credit notes</p>
            <ul className="space-y-2">
              {o.creditNotes.map((cn) => (
                <li key={cn.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{cn.creditNoteNumber}</p>
                    <p className="text-xs text-ink/50">
                      {moneyExact(cn.total)} · {date(cn.issuedAt)}
                    </p>
                  </div>
                  <Can permission="invoices.read">
                    <DownloadButton variant="ghost" busy={busy === cn.id} label={`Download credit note ${cn.creditNoteNumber}`} onClick={() => run(cn.id, `/credit-notes/${cn.id}/pdf?download=1`, pdfName(cn.creditNoteNumber))}>
                      PDF
                    </DownloadButton>
                  </Can>
                </li>
              ))}
            </ul>
          </section>
        )}

        {o.returnRequests.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Returns</p>
            <ul className="space-y-2">
              {o.returnRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/returns/${r.id}`} className="link inline-flex items-center gap-1.5">
                      <RotateCcw size={13} /> {r.returnNumber}
                    </Link>
                    <p className="text-xs text-ink/50">
                      {r.items.reduce((s, i) => s + i.quantity, 0)} unit(s) · {date(r.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={confirmIssue}
        title="Issue the tax invoice?"
        body="A GST invoice with the next invoice number is generated from this order. Invoices are permanent and cannot be edited afterwards."
        confirmLabel="Issue invoice"
        loading={issue.isPending}
        onConfirm={() => issue.mutate()}
        onClose={() => setConfirmIssue(false)}
      />
    </Card>
  );
}
