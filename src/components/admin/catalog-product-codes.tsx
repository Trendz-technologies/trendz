"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Download, Eye, Plus, Power, Printer, QrCode, RefreshCw } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, download, errorMessage, refreshSession } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date } from "@/lib/format";
import { catalogKeys, CODE_TYPE_LABELS, CODE_TYPES, type AdminProduct, type AdminVariant, type CodeType, type ProductCode } from "./catalog-shared";

const VALUE_HINTS: Record<CodeType, string> = {
  EAN13: "13 digits with a valid check digit (e.g. the manufacturer's barcode)",
  UPC: "12 digits with a valid check digit",
  CODE128: "1–48 printable characters",
  QR: "4–48 letters, digits or hyphens",
};

/** Loads a code image with the session cookies and returns it as a data URL. */
async function fetchCodeImage(id: string, format: "png" | "svg"): Promise<string> {
  const url = `/api/codes/${id}/image?format=${format}`;
  let res = await fetch(url, { credentials: "same-origin" });
  if (res.status === 401 && (await refreshSession())) res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
    throw new ApiError(res.status, body?.code ?? "IMAGE_FAILED", body?.message ?? "Could not load the code image");
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image"));
    reader.readAsDataURL(blob);
  });
}

/** QR codes and barcodes of every variant: generate, assign, (de)activate, regenerate, preview and download. */
export function ProductCodes({ product }: { product: AdminProduct }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canManage = can("codes.manage");
  const key = catalogKeys.productCodes(product.id);
  const codes = useQuery({ queryKey: key, queryFn: () => api.get<ProductCode[]>(`/products/${product.id}/codes`) });
  const [preview, setPreview] = useState<ProductCode | null>(null);
  const [assigning, setAssigning] = useState<AdminVariant | null>(null);
  const [regenerating, setRegenerating] = useState<ProductCode | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const generate = useMutation({
    mutationFn: ({ variantId, type }: { variantId: string; type: CodeType }) => api.post<ProductCode>(`/variants/${variantId}/codes`, { type }),
    onSuccess: (code) => {
      toast(`${CODE_TYPE_LABELS[code.codeType]} ${code.codeValue} created`);
      void refresh();
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "INACTIVE" }) => api.patch<ProductCode>(`/codes/${id}`, { status }),
    onSuccess: (code) => {
      toast(code.status === "ACTIVE" ? "Code activated" : "Code deactivated");
      void refresh();
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => api.post<ProductCode>(`/codes/${id}/regenerate`),
    onSuccess: (code) => {
      setRegenerating(null);
      toast(`New ${CODE_TYPE_LABELS[code.codeType]}: ${code.codeValue}`);
      void refresh();
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const byVariant = (variantId: string) => (codes.data ?? []).filter((c) => c.variantId === variantId);

  return (
    <Card
      title={
        <div>
          <h2 className="text-sm font-semibold">QR codes & barcodes</h2>
          <p className="mt-0.5 text-xs text-ink/50">Codes resolve to a variant at the POS and in the warehouse. Variants without codes are still scannable by SKU.</p>
        </div>
      }
      actions={
        <Link href="/admin/codes?tab=labels" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/15 px-3 text-xs font-semibold hover:bg-black/[0.03]">
          <Printer size={14} /> Print labels
        </Link>
      }
    >
      {codes.error ? (
        <ErrorState error={codes.error} retry={() => codes.refetch()} />
      ) : codes.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {product.variants.map((v) => {
            const list = byVariant(v.id);
            return (
              <section key={v.id} className="rounded-2xl border border-black/[0.06]">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {v.title}
                      {v.status !== "ACTIVE" && <StatusBadge status={v.status} />}
                    </p>
                    <p className="font-mono text-xs text-ink/50">{v.sku}</p>
                  </div>
                  {canManage && v.status !== "DISCONTINUED" && (
                    <GenerateControls
                      existing={list}
                      busy={generate.isPending && generate.variables?.variantId === v.id}
                      onGenerate={(type) => generate.mutate({ variantId: v.id, type })}
                      onAssign={() => setAssigning(v)}
                    />
                  )}
                </header>
                {list.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-ink/50">No codes yet. Labels for this variant encode its SKU.</p>
                ) : (
                  <ul className="divide-y divide-black/[0.04]">
                    {list.map((c) => {
                      const sku128 = c.codeType === "CODE128" && c.codeValue === v.sku;
                      return (
                        <li key={c.id} className={clsx("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5", c.status === "INACTIVE" && "opacity-60")}>
                          <Badge tone={c.codeType === "QR" ? "dark" : "info"}>{CODE_TYPE_LABELS[c.codeType]}</Badge>
                          <span className="min-w-0 flex-1 truncate font-mono text-sm" title={c.codeValue}>
                            {c.codeValue}
                          </span>
                          <StatusBadge status={c.status} />
                          <span className="hidden text-xs text-ink/45 sm:inline">{date(c.createdAt)}</span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => setPreview(c)} aria-label={`Preview ${c.codeValue}`}>
                              <span className="hidden sm:inline">View</span>
                            </Button>
                            {canManage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={<Power size={14} />}
                                  loading={setStatus.isPending && setStatus.variables?.id === c.id}
                                  onClick={() => setStatus.mutate({ id: c.id, status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                                >
                                  {c.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                </Button>
                                {!sku128 && (
                                  <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => setRegenerating(c)}>
                                    Regenerate
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
          {!product.variants.length && <EmptyState title="No variants" icon={<QrCode size={22} />} />}
        </div>
      )}

      {preview && <CodePreviewModal code={preview} onClose={() => setPreview(null)} />}
      {assigning && <AssignCodeModal variant={assigning} onClose={() => setAssigning(null)} onDone={() => void refresh()} />}
      <ConfirmDialog
        open={!!regenerating}
        title={`Regenerate ${regenerating ? CODE_TYPE_LABELS[regenerating.codeType] : "code"}?`}
        body={
          <>
            <span className="font-mono">{regenerating?.codeValue}</span> is deactivated and a new code of the same type is issued. Printed labels with the old code stop resolving, so reprint them.
          </>
        }
        confirmLabel="Regenerate"
        tone="danger"
        loading={regenerate.isPending}
        onConfirm={() => regenerating && regenerate.mutate(regenerating.id)}
        onClose={() => setRegenerating(null)}
      />
    </Card>
  );
}

function GenerateControls({ existing, busy, onGenerate, onAssign }: { existing: ProductCode[]; busy: boolean; onGenerate: (type: CodeType) => void; onAssign: () => void }) {
  const hasActive = (t: CodeType) => existing.some((c) => c.codeType === t && c.status === "ACTIVE");
  const [type, setType] = useState<CodeType>(() => CODE_TYPES.find((t) => !hasActive(t)) ?? "QR");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Code type" className="h-8 w-40 py-0 text-xs" value={type} onChange={(e) => setType(e.target.value as CodeType)}>
        {CODE_TYPES.map((t) => (
          <option key={t} value={t}>
            {CODE_TYPE_LABELS[t]}
            {hasActive(t) ? " (has one)" : ""}
          </option>
        ))}
      </Select>
      <Button size="sm" icon={<Plus size={14} />} loading={busy} onClick={() => onGenerate(type)}>
        Generate
      </Button>
      <Button size="sm" variant="outline" onClick={onAssign}>
        Assign existing
      </Button>
    </div>
  );
}

function AssignCodeModal({ variant, onClose, onDone }: { variant: AdminVariant; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<CodeType>("EAN13");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const assign = useMutation({
    mutationFn: () => api.post<ProductCode>(`/variants/${variant.id}/codes`, { type, value: value.trim() }),
    onSuccess: (code) => {
      toast(`${CODE_TYPE_LABELS[code.codeType]} ${code.codeValue} assigned to ${variant.sku}`);
      onDone();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError && err.errors.length ? err.errors.map((e) => e.message).join(", ") : errorMessage(err)),
  });
  const submit = () => {
    if (!value.trim()) {
      setError("Enter the code value");
      return;
    }
    setError(null);
    assign.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign a code to ${variant.sku}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={assign.isPending} onClick={submit}>
            Assign
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Type" htmlFor="assign-type">
          <Select id="assign-type" value={type} onChange={(e) => setType(e.target.value as CodeType)}>
            {CODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CODE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Value" htmlFor="assign-value" hint={VALUE_HINTS[type]} error={error ?? undefined} required>
          <Input
            id="assign-value"
            className="font-mono"
            autoComplete="off"
            maxLength={48}
            value={value}
            invalid={!!error}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
        </Field>
      </form>
    </Modal>
  );
}

export function CodePreviewModal({ code, onClose }: { code: ProductCode; onClose: () => void }) {
  const toast = useToast();
  const [format, setFormat] = useState<"png" | "svg">("png");
  const image = useQuery({
    queryKey: ["admin", "code-image", code.id, format],
    queryFn: () => fetchCodeImage(code.id, format),
    staleTime: 5 * 60_000,
  });
  const save = async (f: "png" | "svg") => {
    try {
      await download(`/codes/${code.id}/image?format=${f}&download=1`, `${code.sku}-${code.codeType.toLowerCase()}.${f}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${CODE_TYPE_LABELS[code.codeType]} · ${code.sku}`}
      footer={
        <>
          <Button variant="outline" icon={<Download size={15} />} onClick={() => void save("svg")}>
            SVG
          </Button>
          <Button icon={<Download size={15} />} onClick={() => void save("png")}>
            PNG
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={code.status} />
          <Tabs
            value={format}
            onChange={setFormat}
            tabs={[
              { value: "png", label: "PNG" },
              { value: "svg", label: "SVG" },
            ]}
          />
        </div>
        <div className="flex min-h-56 items-center justify-center rounded-2xl border border-black/[0.06] bg-white p-6">
          {image.error ? (
            <ErrorState error={image.error} retry={() => image.refetch()} />
          ) : image.data ? (
            <img src={image.data} alt={`${CODE_TYPE_LABELS[code.codeType]} for ${code.sku}`} className="max-h-72 max-w-full object-contain" />
          ) : (
            <Spinner label="Rendering" />
          )}
        </div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink/50">Value</dt>
            <dd className="break-all text-right font-mono">{code.codeValue}</dd>
          </div>
          {code.qrPayload && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink/50">Encodes</dt>
              <dd className="break-all text-right font-mono text-xs">{code.qrPayload}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-ink/50">Created</dt>
            <dd>{date(code.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
