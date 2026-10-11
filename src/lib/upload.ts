"use client";

import { api } from "./api";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * The largest file any upload accepts: one rule for every picture in the
 * application. The API refuses anything larger too (MAX_IMAGE_BYTES in
 * src/integrations/object-storage/storage.types.ts in trendz-api); checking here
 * first means nothing is sent before the person is told.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / 1024 / 1024;

/** What an upload accepts, in words, for the hint beside every upload control. */
export const IMAGE_RULES = `JPEG, PNG, WebP or AVIF, up to ${MAX_IMAGE_MB} MB`;

/** Why a file cannot be uploaded, or null when it can. */
export function imageProblem(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Use a JPEG, PNG, WebP or AVIF image";
  // Rounded up, so a file just over the limit never reads as "2.0 MB".
  if (file.size > MAX_IMAGE_BYTES) return `This image is ${(Math.ceil((file.size / 1024 / 1024) * 10) / 10).toFixed(1)} MB. Images must be ${MAX_IMAGE_MB} MB or smaller.`;
  return null;
}

/** Stops an upload before anything is sent when the file breaks a rule. */
function assertImage(file: File) {
  const problem = imageProblem(file);
  if (problem) throw new Error(problem);
}

/** The API's one-time permission to send one file straight to image storage. */
export interface UploadTicket {
  uploadUrl: string;
  /** For a PUT upload: the file is the request body. */
  headers: Record<string, string>;
  /** For a form upload (Cloudinary): these fields, then the file. */
  fields?: Record<string, string>;
}

/** Sends a file directly to image storage with an upload ticket (the file never passes through the API). */
export async function sendToStorage(ticket: UploadTicket, file: File) {
  let res: Response;
  if (ticket.fields) {
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
    form.append("file", file);
    res = await fetch(ticket.uploadUrl, { method: "POST", body: form });
  } else {
    res = await fetch(ticket.uploadUrl, { method: "PUT", headers: ticket.headers, body: file });
  }
  if (res.ok) return;
  // The storage service says why when it can (for example that the file is too large).
  const reason = await res.json().then(
    (body: { error?: { message?: string } }) => body?.error?.message,
    () => undefined,
  );
  throw new Error(reason ? `Upload failed: ${reason}` : `Upload failed (${res.status})`);
}

/** Category, brand and home page offer images: ticket → upload → returns the storage key to save on the record. */
export async function uploadSimpleImage(purpose: "category" | "brand" | "content", file: File): Promise<{ key: string; publicUrl: string }> {
  assertImage(file);
  const p = await api.post<UploadTicket & { key: string; publicUrl: string }>("/uploads/presign", { purpose, contentType: file.type, size: file.size });
  await sendToStorage(p, file);
  return { key: p.key, publicUrl: p.publicUrl };
}

/** Product images: ticket → upload → complete (the WebP/AVIF sizes are then made in the background). */
export async function uploadProductImage(productId: string, file: File, opts: { variantId?: string | null; altText?: string | null } = {}) {
  assertImage(file);
  const p = await api.post<UploadTicket & { image: { id: string } }>(`/products/${productId}/images/upload-url`, {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    variantId: opts.variantId ?? null,
    altText: opts.altText ?? null,
  });
  await sendToStorage(p, file);
  return api.post(`/products/${productId}/images/${p.image.id}/complete`);
}
