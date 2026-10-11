"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { Badge, Button, Card, Checkbox, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { IMAGE_RULES, IMAGE_TYPES, uploadSimpleImage } from "@/lib/upload";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { withinChars } from "@/lib/rich-text";

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoKey: string | null;
  logoUrl: string | null;
  isActive: boolean;
  productCount: number;
}

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  slug: z.string().trim().regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens").optional(),
  description: z.string().refine(withinChars(2000), "At most 2,000 characters").optional(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

export default function BrandsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "brands"], queryFn: () => api.get<Brand[]>("/brands") });
  const [editing, setEditing] = useState<Brand | "new" | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/brands/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "brands"] });
      setDeleting(null);
      toast("Brand deleted");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <>
      <PageHeader
        title="Brands"
        description="Brands appear on product pages and in storefront filters."
        actions={
          <Can permission="brands.write">
            <Button icon={<Plus size={15} />} onClick={() => setEditing("new")}>
              New brand
            </Button>
          </Can>
        }
      />
      <Card padded>
        {q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            loading={q.isLoading}
            rows={q.data}
            rowKey={(b) => b.id}
            empty={<EmptyState title="No brands yet" />}
            columns={[
              {
                key: "name",
                header: "Brand",
                cell: (b) => (
                  <div className="flex items-center gap-3">
                    {b.logoUrl ? <img src={b.logoUrl} alt="" loading="lazy" decoding="async" className="h-8 w-8 rounded-lg object-contain" /> : <span className="h-8 w-8 rounded-lg bg-offwhite" />}
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-ink/45">/{b.slug}</p>
                    </div>
                  </div>
                ),
              },
              { key: "products", header: "Products", align: "right", cell: (b) => b.productCount },
              { key: "status", header: "Status", cell: (b) => (b.isActive ? <Badge tone="success">Active</Badge> : <Badge>Hidden</Badge>) },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (b) => (
                  <Can permission="brands.write">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${b.name}`} icon={<Pencil size={14} />} onClick={() => setEditing(b)} />
                      <Button variant="ghost" size="sm" aria-label={`Delete ${b.name}`} icon={<Trash2 size={14} />} onClick={() => setDeleting(b)} />
                    </div>
                  </Can>
                ),
              },
            ]}
          />
        )}
      </Card>
      {editing && <BrandForm brand={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        body={deleting?.productCount ? "Brands that are used by products cannot be deleted. Deactivate it instead." : "This cannot be undone."}
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function BrandForm({ brand, onClose }: { brand: Brand | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [logo, setLogo] = useState<{ key: string | null; url: string | null }>({ key: brand?.logoKey ?? null, url: brand?.logoUrl ?? null });
  const [uploading, setUploading] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: brand?.name ?? "", slug: brand?.slug ?? "", description: brand?.description ?? "", isActive: brand?.isActive ?? true },
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadSimpleImage("brand", file);
      setLogo({ key: r.key, url: r.publicUrl });
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setUploading(false);
    }
  };

  const submit = handleSubmit(async (v) => {
    const body = { name: v.name, slug: v.slug || undefined, description: v.description || null, isActive: v.isActive, logoKey: logo.key };
    try {
      if (brand) await api.put(`/brands/${brand.id}`, body);
      else await api.post("/brands", body);
      void qc.invalidateQueries({ queryKey: ["admin", "brands"] });
      toast(brand ? "Brand updated" : "Brand created");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) for (const e of err.errors) setError(e.path as keyof Values, { message: e.message });
      else setError("root", { message: errorMessage(err) });
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={brand ? `Edit ${brand.name}` : "New brand"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" error={errors.name?.message} htmlFor="name" required>
          <Input id="name" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="URL slug" error={errors.slug?.message} htmlFor="slug" hint="Leave empty to generate from the name">
          <Input id="slug" invalid={!!errors.slug} {...register("slug")} />
        </Field>
        <Field label="Description" htmlFor="description" error={errors.description?.message}>
          <Controller
            control={control}
            name="description"
            render={({ field }) => <RichTextEditor id="description" aria-label="Description" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.description} />}
          />
        </Field>
        <Field label="Logo" hint={`${IMAGE_RULES}.`}>
          <div className="flex items-center gap-3">
            {logo.url ? <img src={logo.url} alt="" className="h-14 w-14 rounded-xl bg-offwhite object-contain" /> : <span className="h-14 w-14 rounded-xl bg-offwhite" />}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.03]">
              <ImagePlus size={14} /> {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Cleared, so choosing the same file again after a refusal is noticed.
                  e.target.value = "";
                  void onFile(file);
                }}
              />
            </label>
            {logo.key && (
              <button type="button" onClick={() => setLogo({ key: null, url: null })} className="text-xs text-ink/50 underline">
                Remove
              </button>
            )}
          </div>
        </Field>
        <Checkbox label="Visible on the storefront" {...register("isActive")} />
        {errors.root && <p className="text-sm text-danger">{errors.root.message}</p>}
      </form>
    </Modal>
  );
}
