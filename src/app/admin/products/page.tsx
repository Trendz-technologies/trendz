"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Package, Plus, Star } from "lucide-react";
import { Can, PageHeader, SearchInput, useListState } from "@/components/admin/page";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Pagination, Select, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date, money } from "@/lib/format";
import { catalogKeys, CategoryOptions, PRODUCT_STATUSES, Thumb, useBrands, useCategoryTree, type ProductListRow } from "@/components/admin/catalog-shared";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "updated", label: "Recently updated" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export default function ProductsPage() {
  const router = useRouter();
  const { page, filters, set, setPage } = useListState({ q: "", categoryId: "", brandId: "", status: "", stock: "", sort: "newest" });
  const q = useQuery({
    queryKey: [...catalogKeys.products, page, filters],
    queryFn: () => api.page<ProductListRow[]>("/products", { page, limit: 25, ...filters }),
    placeholderData: (prev) => prev,
  });
  const categories = useCategoryTree();
  const brands = useBrands();
  const filtered = !!(filters.q || filters.categoryId || filters.brandId || filters.status || filters.stock);

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell, with variants, pricing and stock."
        actions={
          <Can permission="products.write">
            <Button icon={<Plus size={15} />} onClick={() => router.push("/admin/products/new")}>
              New product
            </Button>
          </Can>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput value={filters.q} onChange={(v) => set({ q: v })} placeholder="Name, SKU or tag" className="w-full lg:w-72" />
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:w-auto lg:flex-1 lg:flex-wrap">
            <Select aria-label="Category" className="lg:w-48" value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">All categories</option>
              <CategoryOptions tree={categories.data} />
            </Select>
            <Select aria-label="Brand" className="lg:w-40" value={filters.brandId} onChange={(e) => set({ brandId: e.target.value })}>
              <option value="">All brands</option>
              {brands.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Status" className="lg:w-36" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">Any status</option>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
            <Select aria-label="Stock" className="lg:w-36" value={filters.stock} onChange={(e) => set({ stock: e.target.value })}>
              <option value="">Any stock</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
            <Select aria-label="Sort" className="lg:w-44" value={filters.sort} onChange={(e) => set({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => set({ q: "", categoryId: "", brandId: "", status: "", stock: "" })}>
              Clear filters
            </Button>
          )}
        </div>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data?.data}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/admin/products/${p.id}`)}
            empty={
              <EmptyState
                icon={<Package size={22} />}
                title={filtered ? "No products match these filters" : "No products yet"}
                body={filtered ? "Try a different search or clear the filters." : "Create your first product to start selling."}
              />
            }
            columns={[
              {
                key: "product",
                header: "Product",
                cell: (p) => (
                  <div className="flex items-center gap-3">
                    <Thumb src={p.image?.thumb ?? p.image?.url} size={44} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium">
                        <span className="truncate">{p.name}</span>
                        {p.isFeatured && <Star size={12} className="shrink-0 fill-warning text-warning" aria-label="Featured" />}
                      </p>
                      <p className="font-mono text-xs text-ink/45">{p.baseSku}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: "category",
                header: "Category",
                cell: (p) => (
                  <div className="text-sm">
                    <p>{p.category.name}</p>
                    {p.brand && <p className="text-xs text-ink/45">{p.brand.name}</p>}
                  </div>
                ),
              },
              {
                key: "price",
                header: "Price",
                align: "right",
                cell: (p) => (
                  <div>
                    <p className="font-medium">{money(p.sellingPrice)}</p>
                    {p.mrp > p.sellingPrice && <p className="text-xs text-ink/40 line-through">{money(p.mrp)}</p>}
                  </div>
                ),
              },
              { key: "variants", header: "Variants", align: "right", cell: (p) => p.variantCount },
              {
                key: "stock",
                header: "Available",
                align: "right",
                cell: (p) => (p.available > 0 ? p.available.toLocaleString("en-IN") : <Badge tone="danger">Out of stock</Badge>),
              },
              { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
              { key: "updated", header: "Updated", cell: (p) => <span className="whitespace-nowrap text-ink/60">{date(p.updatedAt)}</span> },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
