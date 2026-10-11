"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowLeft, ArrowRight, ImageOff, ImagePlus, Loader2, Pencil, Replace, Trash2 } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Select, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { IMAGE_RULES, IMAGE_TYPES, imageProblem, MAX_IMAGE_BYTES, MAX_IMAGE_MB, sendToStorage, uploadProductImage, type UploadTicket } from "@/lib/upload";
import type { ImageView } from "@/lib/types";
import { catalogKeys, MAX_PRODUCT_IMAGES, type AdminProduct } from "./catalog-shared";

const ACCEPT = IMAGE_TYPES.join(",");

/** Product gallery: upload, order, alt text / variant assignment, replace and delete. */
export function ProductImages({ product }: { product: AdminProduct }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("products.write");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<ImageView | null>(null);
  const [deleting, setDeleting] = useState<ImageView | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);

  const key = catalogKeys.product(product.id);
  const images = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const variantName = (id: string | null) => {
    const v = id ? product.variants.find((x) => x.id === id) : null;
    return v ? `${v.title} · ${v.sku}` : null;
  };
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const upload = async (files: File[]) => {
    if (!files.length) return;
    const room = MAX_PRODUCT_IMAGES - images.length;
    if (room <= 0) {
      toast(`A product can have at most ${MAX_PRODUCT_IMAGES} images`, "error");
      return;
    }
    // Files that break a rule are named and left out; the rest still upload.
    const valid = files.filter((f) => !imageProblem(f));
    if (files.some((f) => !IMAGE_TYPES.includes(f.type))) toast("Only JPEG, PNG, WebP and AVIF images are supported", "error");
    const tooLarge = files.filter((f) => IMAGE_TYPES.includes(f.type) && f.size > MAX_IMAGE_BYTES);
    if (tooLarge.length) {
      const names = tooLarge.slice(0, 3).map((f) => f.name).join(", ");
      toast(`Over ${MAX_IMAGE_MB} MB, not uploaded: ${names}${tooLarge.length > 3 ? ` and ${tooLarge.length - 3} more` : ""}`, "error");
    }
    const batch = valid.slice(0, room);
    if (valid.length > room) toast(`Only ${room} more image(s) fit; the rest were skipped`, "error");
    if (!batch.length) return;

    setProgress({ done: 0, total: batch.length });
    let ok = 0;
    for (const [i, file] of batch.entries()) {
      try {
        await uploadProductImage(product.id, file);
        ok += 1;
      } catch (err) {
        toast(`${file.name}: ${errorMessage(err)}`, "error");
      }
      setProgress({ done: i + 1, total: batch.length });
    }
    setProgress(null);
    await refresh();
    if (ok) toast(`${ok} image${ok === 1 ? "" : "s"} uploaded. Optimising…`);
  };

  const replace = async (image: ImageView, file: File | undefined) => {
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) {
      toast(problem, "error");
      return;
    }
    setReplacing(image.id);
    try {
      const p = await api.post<UploadTicket>(`/products/${product.id}/images/${image.id}/replace`, {
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      });
      await sendToStorage(p, file);
      await api.post(`/products/${product.id}/images/${image.id}/complete`);
      toast("Image replaced. Optimising…");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setReplacing(null);
      await refresh();
    }
  };

  const reorder = useMutation({
    mutationFn: (imageIds: string[]) => api.put(`/products/${product.id}/images/order`, { imageIds }),
    onMutate: async (imageIds) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AdminProduct>(key);
      if (previous) {
        qc.setQueryData<AdminProduct>(key, {
          ...previous,
          images: previous.images.map((img) => ({ ...img, sortOrder: imageIds.indexOf(img.id) })),
        });
      }
      return { previous };
    },
    onError: (err, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast(errorMessage(err), "error");
    },
    onSettled: () => void refresh(),
  });

  const move = (index: number, delta: -1 | 1) => {
    const ids = images.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate(ids);
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${product.id}/images/${id}`),
    onSuccess: () => {
      setDeleting(null);
      toast("Image deleted");
      void refresh();
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!canWrite || progress) return;
    void upload(Array.from(e.dataTransfer.files));
  };

  const processing = images.some((i) => i.status === "PROCESSING");

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Images</h2>
          <Badge>
            {images.length}/{MAX_PRODUCT_IMAGES}
          </Badge>
          {processing && (
            <span className="inline-flex items-center gap-1 text-xs text-ink/50">
              <Loader2 size={12} className="animate-spin" /> Optimising
            </span>
          )}
        </div>
      }
    >
      {canWrite && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            "mb-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
            dragging ? "border-ink/40 bg-black/[0.03]" : "border-black/10 hover:border-black/20",
            progress && "pointer-events-none opacity-70",
          )}
        >
          {progress ? <Loader2 size={22} className="animate-spin text-ink/50" /> : <ImagePlus size={22} className="text-ink/40" />}
          <span className="text-sm font-semibold">{progress ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : "Drop images here or click to upload"}</span>
          <span className="text-xs text-ink/50">{IMAGE_RULES} each. The first image is the cover. Images are optimised automatically.</span>
          <input
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            disabled={!!progress}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void upload(files);
            }}
          />
        </label>
      )}

      {images.length === 0 ? (
        <EmptyState title="No images yet" body="Products with clear photos convert better. Upload at least one image before activating the product." icon={<ImageOff size={22} />} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.map((img, i) => {
            const src = img.thumb ?? img.medium ?? img.url;
            const busy = replacing === img.id;
            return (
              <li key={img.id} className="group overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
                <div className="relative aspect-square bg-offwhite">
                  {src ? (
                    <img src={src} alt={img.altText ?? ""} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink/30">
                      {img.status === "FAILED" ? <ImageOff size={22} /> : <Loader2 size={20} className="animate-spin" />}
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {i === 0 && <Badge tone="dark">Cover</Badge>}
                    {img.status !== "READY" && <StatusBadge status={img.status} />}
                  </div>
                  {busy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-2.5">
                  <p className={clsx("truncate text-xs", img.altText ? "text-ink/70" : "italic text-ink/40")} title={img.altText ?? undefined}>
                    {img.altText || "No alt text"}
                  </p>
                  {img.variantId && <p className="truncate text-[11px] text-ink/50">{variantName(img.variantId) ?? "Variant"}</p>}
                  {img.status === "FAILED" && <p className="text-[11px] text-danger" title={img.error ?? undefined}>Processing failed{img.error ? `: ${img.error}` : ""}. Replace the file.</p>}
                  {canWrite && (
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex">
                        <IconButton label="Move earlier" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>
                          <ArrowLeft size={14} />
                        </IconButton>
                        <IconButton label="Move later" disabled={i === images.length - 1 || reorder.isPending} onClick={() => move(i, 1)}>
                          <ArrowRight size={14} />
                        </IconButton>
                      </div>
                      <div className="flex">
                        <IconButton label="Edit alt text and variant" onClick={() => setEditing(img)}>
                          <Pencil size={14} />
                        </IconButton>
                        <label
                          title="Replace file"
                          className={clsx("inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink/60 hover:bg-black/5 hover:text-ink", busy && "pointer-events-none opacity-40")}
                        >
                          <Replace size={14} />
                          <span className="sr-only">Replace image file</span>
                          <input
                            type="file"
                            accept={ACCEPT}
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              void replace(img, file);
                            }}
                          />
                        </label>
                        <IconButton label="Delete image" onClick={() => setDeleting(img)}>
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && <ImageEditModal product={product} image={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete this image?"
        body="The image and all its optimised sizes are removed. This cannot be undone."
        confirmLabel="Delete image"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </Card>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/60 hover:bg-black/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ImageEditModal({ product, image, onClose }: { product: AdminProduct; image: ImageView; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [altText, setAltText] = useState(image.altText ?? "");
  const [variantId, setVariantId] = useState(image.variantId ?? "");
  const save = useMutation({
    mutationFn: () => api.patch(`/products/${product.id}/images/${image.id}`, { altText: altText.trim() || null, variantId: variantId || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: catalogKeys.product(product.id) });
      toast("Image updated");
      onClose();
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const src = image.medium ?? image.url ?? image.thumb;

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit image"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={altText.length > 200} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {src && <img src={src} alt="" className="mx-auto max-h-56 rounded-xl object-contain" />}
        <Field label="Alt text" htmlFor="img-alt" hint="Describe the image for screen readers and search engines" error={altText.length > 200 ? "At most 200 characters" : undefined}>
          <Input id="img-alt" value={altText} onChange={(e) => setAltText(e.target.value)} invalid={altText.length > 200} />
        </Field>
        <Field label="Show for variant" htmlFor="img-variant" hint="Shown when the shopper selects this variant">
          <Select id="img-variant" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">All variants</option>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title} · {v.sku}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
