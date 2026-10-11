"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2 } from "lucide-react";
import { Can, PageHeader, useListState } from "@/components/admin/page";
import { ProductForm } from "@/components/admin/catalog-product-form";
import { ProductImages } from "@/components/admin/catalog-product-images";
import { ProductStock } from "@/components/admin/catalog-product-stock";
import { ProductCodes } from "@/components/admin/catalog-product-codes";
import { catalogKeys, type AdminProduct } from "@/components/admin/catalog-shared";
import { Button, ConfirmDialog, ErrorState, Spinner, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { dateTime, pluralize } from "@/lib/format";

type Tab = "details" | "images" | "stock" | "codes";
const TABS: Tab[] = ["details", "images", "stock", "codes"];

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { filters, set } = useListState({ tab: "details" });
  const tab: Tab = TABS.includes(filters.tab as Tab) ? (filters.tab as Tab) : "details";
  const [confirmDelete, setConfirmDelete] = useState(false);

  const q = useQuery({
    queryKey: catalogKeys.product(id),
    queryFn: () => api.get<AdminProduct>(`/products/${id}`),
    // Uploaded images are optimised in the background: poll until they are ready.
    refetchInterval: (query) => (query.state.data?.images.some((i) => i.status === "PROCESSING") ? 3000 : false),
  });

  const remove = useMutation({
    mutationFn: () => api.delete<{ deleted: boolean; archived: boolean }>(`/products/${id}`),
    onSuccess: (r) => {
      setConfirmDelete(false);
      void qc.invalidateQueries({ queryKey: catalogKeys.products });
      void qc.invalidateQueries({ queryKey: catalogKeys.categories });
      if (r.deleted) {
        toast("Product deleted");
        qc.removeQueries({ queryKey: catalogKeys.product(id) });
        router.replace("/admin/products");
      } else {
        toast("The product has order or stock history, so it was archived instead of deleted", "info");
        void qc.invalidateQueries({ queryKey: catalogKeys.product(id) });
      }
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Spinner />;
  const p = q.data;

  return (
    <>
      <PageHeader
        title={p.name}
        description={
          <>
            <span className="font-mono">{p.baseSku}</span> · {pluralize(p.variants.length, "variant")} · Updated {dateTime(p.updatedAt)}
          </>
        }
        back={{ href: "/admin/products", label: "Products" }}
        actions={
          <>
            <StatusBadge status={p.status} />
            {p.status === "ACTIVE" && (
              <a href={`/products/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-ink/60 hover:bg-black/5 hover:text-ink">
                View in store <ExternalLink size={12} />
              </a>
            )}
            <Can permission="products.delete">
              <Button variant="outline" size="sm" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </Can>
          </>
        }
      />

      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={(t) => set({ tab: t === "details" ? "" : t })}
          tabs={[
            { value: "details", label: "Details" },
            { value: "images", label: `Images (${p.images.length})` },
            { value: "stock", label: "Stock" },
            { value: "codes", label: "Codes" },
          ]}
        />
      </div>

      {/* The form stays mounted while other tabs are open so unsaved edits survive. */}
      <div hidden={tab !== "details"}>
        <ProductForm key={p.id} product={p} />
      </div>
      {tab === "images" && <ProductImages product={p} />}
      {tab === "stock" && <ProductStock product={p} />}
      {tab === "codes" && <ProductCodes product={p} />}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${p.name}?`}
        body="Products without any order, stock or purchase history are deleted permanently together with their images and codes. Products with history are archived instead, so past records stay intact."
        confirmLabel="Delete product"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
