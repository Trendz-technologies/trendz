"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button, Checkbox, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { IMAGE_RULES, IMAGE_TYPES, uploadSimpleImage } from "@/lib/upload";
import type { CategoryNode } from "@/lib/types";
import { catalogKeys, categoryOptionLabel, flattenCategories, MAX_CATEGORY_DEPTH, splitApiErrors } from "./catalog-shared";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { withinChars } from "@/lib/rich-text";

/** GET /categories/:id (the raw row, including fields the tree omits). */
interface CategoryDetail {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  isActive: boolean;
  depth: number;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80, "At most 80 characters"),
  slug: z.string().trim().toLowerCase().max(80, "At most 80 characters").refine((v) => v === "" || SLUG.test(v), "Use lowercase letters, numbers and hyphens"),
  parentId: z.string(),
  description: z.string().refine(withinChars(2000), "At most 2,000 characters"),
  isActive: z.boolean(),
  seoTitle: z.string().trim().max(70, "At most 70 characters"),
  seoDescription: z.string().trim().max(170, "At most 170 characters"),
  seoKeywords: z.string().trim().max(300, "At most 300 characters"),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;
const FIELDS = new Set(["name", "slug", "parentId", "description", "isActive", "seoTitle", "seoDescription", "seoKeywords"]);

/** Levels below a node (0 for a leaf). */
const height = (n: CategoryNode): number => (n.children.length ? 1 + Math.max(...n.children.map(height)) : 0);

function findNode(nodes: CategoryNode[], id: string): CategoryNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

export function CategoryFormModal({ categoryId, defaultParentId, tree, onClose }: { categoryId: string | null; defaultParentId: string | null; tree: CategoryNode[]; onClose: () => void }) {
  const detail = useQuery({
    queryKey: catalogKeys.category(categoryId ?? "new"),
    queryFn: () => api.get<CategoryDetail>(`/categories/${categoryId}`),
    enabled: !!categoryId,
  });

  if (categoryId && !detail.data) {
    return (
      <Modal open onClose={onClose} title="Edit category">
        {detail.error ? <ErrorState error={detail.error} retry={() => detail.refetch()} /> : <Spinner />}
      </Modal>
    );
  }
  return <CategoryForm category={detail.data ?? null} defaultParentId={defaultParentId} tree={tree} onClose={onClose} />;
}

function CategoryForm({ category, defaultParentId, tree, onClose }: { category: CategoryDetail | null; defaultParentId: string | null; tree: CategoryNode[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [image, setImage] = useState<{ key: string | null; url: string | null }>({ key: category?.imageKey ?? null, url: category?.imageUrl ?? null });
  const [uploading, setUploading] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      parentId: category ? (category.parentId ?? "") : (defaultParentId ?? ""),
      description: category?.description ?? "",
      isActive: category?.isActive ?? true,
      seoTitle: category?.seoTitle ?? "",
      seoDescription: category?.seoDescription ?? "",
      seoKeywords: category?.seoKeywords ?? "",
    },
  });
  const name = useWatch({ control, name: "name" });

  // A category cannot move inside itself, and the moved subtree must stay within the depth limit.
  const self = category ? findNode(tree, category.id) : null;
  const excluded = new Set(self ? flattenCategories([self]).map((n) => n.id) : []);
  const subtreeHeight = self ? height(self) : 0;
  const parents = flattenCategories(tree).filter((c) => !excluded.has(c.id));

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadSimpleImage("category", file);
      setImage({ key: r.key, url: r.publicUrl });
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  };

  const submit = handleSubmit(async (v) => {
    const body = {
      name: v.name,
      slug: v.slug || undefined,
      parentId: v.parentId || null,
      description: v.description || null,
      imageKey: image.key,
      isActive: v.isActive,
      seoTitle: v.seoTitle || null,
      seoDescription: v.seoDescription || null,
      seoKeywords: v.seoKeywords || null,
    };
    try {
      if (category) await api.put(`/categories/${category.id}`, body);
      else await api.post("/categories", body);
      void qc.invalidateQueries({ queryKey: catalogKeys.categories });
      if (category) void qc.invalidateQueries({ queryKey: catalogKeys.category(category.id) });
      toast(category ? "Category updated" : "Category created");
      onClose();
    } catch (err) {
      const { fields, message } = splitApiErrors(err, (p) => (FIELDS.has(p) ? p : null));
      for (const f of fields) setError(f.path as keyof FormIn, { message: f.message });
      setError("root", { message: message ?? "Could not save the category" });
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={category ? `Edit ${category.name}` : "New category"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} disabled={uploading} onClick={submit}>
            {category ? "Save" : "Create category"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="c-name" error={errors.name?.message} required>
            <Input id="c-name" invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="URL slug" htmlFor="c-slug" error={errors.slug?.message} hint={category ? "Changing it breaks existing links" : "Leave empty to generate from the name"}>
            <Input id="c-slug" invalid={!!errors.slug} {...register("slug")} />
          </Field>
        </div>
        <Field label="Parent category" htmlFor="c-parent" error={errors.parentId?.message} hint={`Categories nest up to ${MAX_CATEGORY_DEPTH + 1} levels deep`}>
          <Select id="c-parent" invalid={!!errors.parentId} {...register("parentId")}>
            <option value="">None (top level)</option>
            {parents.map((c) => (
              <option key={c.id} value={c.id} disabled={c.depth + 1 + subtreeHeight > MAX_CATEGORY_DEPTH}>
                {categoryOptionLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" htmlFor="c-description" error={errors.description?.message} hint="Shown in the banner at the top of the category page.">
          <Controller
            control={control}
            name="description"
            render={({ field }) => <RichTextEditor id="c-description" aria-label="Description" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.description} />}
          />
        </Field>
        <Field
          label="Image"
          hint={`Shown in the banner of the category page and on its home page card; it is cropped from the bottom to fit, so keep faces near the top. Without one, a product photo from the category is used. ${IMAGE_RULES}.`}
        >
          <div className="flex flex-wrap items-center gap-3">
            {image.url ? <img src={image.url} alt="" className="h-16 w-16 rounded-xl bg-offwhite object-cover" /> : <span className="h-16 w-16 rounded-xl bg-offwhite" />}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.03]">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {uploading ? "Uploading…" : image.key ? "Change" : "Upload"}
              <input
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void onFile(file);
                }}
              />
            </label>
            {image.key && (
              <button type="button" onClick={() => setImage({ key: null, url: null })} className="text-xs text-ink/50 underline">
                Remove
              </button>
            )}
          </div>
        </Field>
        <Checkbox label="Visible on the storefront" {...register("isActive")} />

        <fieldset className="space-y-4 rounded-2xl border border-black/[0.06] p-4">
          <legend className="px-1 text-xs font-semibold text-ink/60">Search engine listing</legend>
          <Field label="SEO title" htmlFor="c-seo-title" error={errors.seoTitle?.message} hint={`Defaults to “${name || "the name"}”`}>
            <Input id="c-seo-title" invalid={!!errors.seoTitle} {...register("seoTitle")} />
          </Field>
          <Field label="SEO description" htmlFor="c-seo-desc" error={errors.seoDescription?.message} hint="Up to 170 characters">
            <Textarea id="c-seo-desc" rows={2} className="min-h-16" invalid={!!errors.seoDescription} {...register("seoDescription")} />
          </Field>
          <Field label="SEO keywords" htmlFor="c-seo-keywords" error={errors.seoKeywords?.message} hint="Comma separated">
            <Input id="c-seo-keywords" invalid={!!errors.seoKeywords} {...register("seoKeywords")} />
          </Field>
        </fieldset>
        {errors.root && (
          <p role="alert" className="text-sm text-danger">
            {errors.root.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
