"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { AccountHeader, EmptyPanel } from "@/components/store/account-ui";
import { AddressForm } from "@/components/store/address-form";
import { delay } from "@/components/store/checkout-ui";
import { EASE_OUT } from "@/components/store/motion";
import { ConfirmDialog } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n/client";
import type { Address } from "@/lib/types";

const addButton =
  "group inline-flex h-11 items-center gap-2 rounded-full bg-ink pl-3 pr-5 text-sm font-semibold text-white shadow-neu-lg transition hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35";

export default function AddressesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["addresses"], queryFn: () => api.get<Address[]>("/account/addresses") });
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/account/addresses/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["addresses"] });
      setDeleting(null);
      toast(t("Address removed"));
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const saved = () => {
    void qc.invalidateQueries({ queryKey: ["addresses"] });
    setEditing(null);
    toast(t("Address saved"));
  };

  const addAction = (
    <button type="button" className={addButton} onClick={() => setEditing("new")}>
      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 transition-transform duration-500 group-hover:rotate-90">
        <Plus size={14} />
      </span>
      {t("Add address")}
    </button>
  );

  return (
    <div className="space-y-8">
      <AccountHeader eyebrow={t("Address book")} title={t("Addresses")} description={t("Saved addresses make checkout a one-tap affair.")} actions={!editing ? addAction : undefined} />

      <AnimatePresence initial={false}>
        {editing && (
          <m.div
            key={editing === "new" ? "new" : editing.id}
            className="overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <section className="rounded-3xl bg-white p-5 shadow-neu sm:p-7">
              <p className="eyebrow">{editing === "new" ? t("New address") : t("Edit address")}</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight">{editing === "new" ? t("Where should we deliver?") : editing.fullName}</h2>
              <div className="mt-6">
                <AddressForm initial={editing === "new" ? undefined : editing} onSaved={saved} onCancel={() => setEditing(null)} />
              </div>
            </section>
          </m.div>
        )}
      </AnimatePresence>

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <p role="status" className="sr-only">
            {t("Loading your addresses")}…
          </p>
          <div className="skeleton h-52 rounded-3xl" />
          <div className="skeleton h-52 rounded-3xl" />
        </div>
      ) : !q.data?.length ? (
        !editing && <EmptyPanel icon={<MapPin size={28} strokeWidth={1.5} />} title={t("No saved addresses")} body={t("Add an address to check out faster.")} action={addAction} />
      ) : (
        <ul className="relative grid gap-4 md:grid-cols-2">
          <AnimatePresence initial={false} mode="popLayout">
            {q.data.map((a, i) => (
              <m.li key={a.id} layout exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.35, ease: EASE_OUT } }} transition={{ layout: { duration: 0.5, ease: EASE_OUT } }}>
                <div className="h-full animate-rise" style={delay(120 + Math.min(i, 6) * 70)}>
                  <article className="group flex h-full flex-col rounded-3xl bg-white p-6 text-sm shadow-neu transition-shadow duration-500 hover:shadow-neu-lg">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-offwhite transition-colors duration-500 group-hover:bg-ink group-hover:text-white">
                        <MapPin size={18} strokeWidth={1.75} />
                      </span>
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {a.label && <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink/60">{a.label}</span>}
                        {a.isDefaultShipping && <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">{t("Default")}</span>}
                      </span>
                    </div>
                    <p className="mt-5 font-semibold">{a.fullName}</p>
                    <p className="mt-1 leading-relaxed text-ink/65">
                      {[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}
                      <br />
                      {a.city}, {a.state} {a.postalCode}
                      <br />
                      {a.phone}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      <button
                        type="button"
                        onClick={() => setEditing(a)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/15 px-4 text-xs font-semibold transition hover:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
                      >
                        <Pencil size={13} /> {t("Edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(a)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-ink/60 transition hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
                      >
                        <Trash2 size={13} /> {t("Remove")}
                      </button>
                    </div>
                  </article>
                </div>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <ConfirmDialog open={!!deleting} title={t("Remove this address?")} confirmLabel={t("Remove")} tone="danger" loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />
    </div>
  );
}
