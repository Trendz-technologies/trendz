"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, Square, Upload, XCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/page";
import { catalogKeys } from "@/components/admin/catalog-shared";
import { Badge, Button, Card, DataTable, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, download, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pluralize } from "@/lib/format";

/** Mirrors ImportPreview in trendz-api (src/modules/catalog/product-import.ts). */
interface ReadyProduct {
  baseSku: string;
  name: string;
  rows: number[];
  category: string;
  options: string;
  variants: number;
  images: number;
  warnings: string[];
  payload: unknown;
}
interface Preview {
  rows: number;
  ready: ReadyProduct[];
  skipped: { baseSku: string; name: string; rows: number[]; reason: string }[];
  problems: { baseSku: string | null; name: string | null; rows: number[]; errors: string[] }[];
}
type ImportResult =
  | { status: "skipped"; reason: string }
  | { status: "created"; product: { id: string; name: string }; images: { added: number; failed: { url: string; error: string }[] } };
type Outcome = { state: "importing" | "created" | "skipped" | "failed"; message?: string; productId?: string };

const MAX_FILE_MB = 5;
const rowsLabel = (rows: number[]) => (rows.length === 1 ? `Row ${rows[0]}` : rows.length > 1 ? `Rows ${rows[0]}–${rows[rows.length - 1]}` : "");

export default function ImportProductsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [running, setRunning] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const stop = useRef(false);

  // Leaving mid-import would stop it halfway.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  if (!can("products.write")) {
    return (
      <>
        <PageHeader title="Import products" back={{ href: "/admin/products", label: "Products" }} />
        <EmptyState title="You don't have permission to create products" body="Ask an administrator for the products.write permission." />
      </>
    );
  }

  const check = async (f: File) => {
    setFile(f);
    setPreview(null);
    setOutcomes({});
    setCheckError(null);
    if (!/\.xlsx$/i.test(f.name)) return setCheckError("Choose an Excel workbook (.xlsx). Start from the template above.");
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setCheckError(`The file is larger than ${MAX_FILE_MB} MB. Split it into smaller files.`);
    setChecking(true);
    try {
      setPreview(await api.upload<Preview>("/products/import/preview", f));
    } catch (err) {
      setCheckError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && !checking && !running) void check(f);
  };

  const getTemplate = async () => {
    setTemplateBusy(true);
    try {
      await download("/products/import/template", "trendz-product-import.xlsx");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setTemplateBusy(false);
    }
  };

  const ready = preview?.ready ?? [];
  const finished = (sku: string) => ["created", "skipped"].includes(outcomes[sku]?.state ?? "");
  const pending = ready.filter((p) => !finished(p.baseSku));
  const count = (state: Outcome["state"]) => Object.values(outcomes).filter((o) => o.state === state).length;

  const run = async () => {
    setRunning(true);
    stop.current = false;
    const set = (sku: string, o: Outcome) => setOutcomes((prev) => ({ ...prev, [sku]: o }));
    // One product per request: each waits for its pictures, and a stop or an error leaves the rest untouched.
    for (const p of pending) {
      if (stop.current) break;
      set(p.baseSku, { state: "importing" });
      try {
        const r = await api.post<ImportResult>("/products/import/product", p.payload);
        if (r.status === "skipped") set(p.baseSku, { state: "skipped", message: r.reason });
        else {
          const bad = r.images.failed.length;
          set(p.baseSku, {
            state: "created",
            productId: r.product.id,
            message: bad ? `${pluralize(bad, "picture")} could not be optimised; replace ${bad === 1 ? "it" : "them"} on the product's Images tab` : undefined,
          });
        }
      } catch (err) {
        set(p.baseSku, { state: "failed", message: errorMessage(err) });
      }
    }
    setRunning(false);
    void qc.invalidateQueries({ queryKey: catalogKeys.products });
    toast(stop.current ? "Import stopped" : "Import finished", stop.current ? "info" : "success");
  };

  const done = ready.filter((p) => outcomes[p.baseSku] && outcomes[p.baseSku]!.state !== "importing").length;

  return (
    <>
      <PageHeader
        title="Import products"
        description="Add many products at once from an Excel sheet, with their pictures."
        back={{ href: "/admin/products", label: "Products" }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="1. Fill in the template">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/70">
            <li>One row per variant (size + colour). Rows with the same Base SKU make one product; fill its name, category and other details on its first row.</li>
            <li>The Base SKU is each product’s unique key. A Base SKU that is already in the shop is skipped, so a file can be imported again without adding anything twice.</li>
            <li>Put the web addresses of the pictures in the image columns: product photos for the whole product, variant photos for that size and colour.</li>
            <li>The template’s Example sheet shows two finished products; its How to fill sheet explains every column.</li>
          </ul>
          <Button className="mt-4" variant="outline" icon={<Download size={15} />} loading={templateBusy} onClick={getTemplate}>
            Download template
          </Button>
        </Card>

        <Card title="2. Upload the filled file">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={clsx(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
              dragging ? "border-ink/40 bg-black/[0.03]" : "border-black/10 hover:border-black/20",
              (checking || running) && "pointer-events-none opacity-60",
            )}
          >
            {checking ? <Loader2 size={22} className="animate-spin text-ink/50" /> : <FileSpreadsheet size={22} className="text-ink/40" />}
            <span className="text-sm font-semibold">{checking ? `Checking ${file?.name}…` : file ? file.name : "Drop the Excel file here or click to choose it"}</span>
            <span className="text-xs text-ink/50">.xlsx, up to {MAX_FILE_MB} MB. Nothing is added until you press Import.</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={checking || running}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void check(f);
              }}
            />
          </label>
          {checkError && <p className="mt-3 text-sm text-danger">{checkError}</p>}
          {file && preview && !running && (
            <Button className="mt-3" variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => void check(file)}>
              Check the same file again
            </Button>
          )}
        </Card>
      </div>

      {preview && (
        <Card
          className="mt-6"
          padded={false}
          title={
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">3. Check and import</h2>
              <Badge tone="success">{pluralize(ready.length, "product")} ready</Badge>
              {preview.skipped.length > 0 && <Badge>{preview.skipped.length} already in the shop</Badge>}
              {preview.problems.length > 0 && <Badge tone="danger">{preview.problems.length} to fix</Badge>}
            </div>
          }
          actions={
            running ? (
              <Button variant="outline" size="sm" icon={<Square size={13} />} onClick={() => (stop.current = true)}>
                Stop
              </Button>
            ) : (
              <Button size="sm" icon={<Upload size={14} />} disabled={!pending.length} onClick={() => void run()}>
                {pending.length ? `Import ${pluralize(pending.length, "product")}` : "Nothing left to import"}
              </Button>
            )
          }
        >
          {(running || done > 0) && (
            <div className="border-b border-black/5 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink/60">
                <span>{running ? `Importing ${Math.min(done + 1, ready.length)} of ${ready.length}…` : `${count("created")} added, ${count("skipped")} skipped, ${count("failed")} failed`}</span>
                {!running && count("created") > 0 && (
                  <Link href="/admin/products" className="font-semibold text-ink underline-offset-2 hover:underline">
                    View products
                  </Link>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${ready.length ? (done / ready.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* DataTable reaches out over a padded card's sides (-mx-5); this card is unpadded. */}
          <div className="px-5">
            <DataTable
              rows={ready}
              rowKey={(p) => p.baseSku}
              empty={<p className="px-5 py-6 text-sm text-ink/55">No new products in this file{preview.problems.length ? " yet: fix the rows below and upload the file again" : ""}.</p>}
              columns={[
                { key: "rows", header: "Rows", cell: (p) => <span className="whitespace-nowrap text-xs text-ink/50">{rowsLabel(p.rows)}</span> },
                {
                  key: "product",
                  header: "Product",
                  cell: (p) => (
                    <div className="min-w-48">
                      <p className="font-medium">{p.name}</p>
                      <p className="font-mono text-xs text-ink/50">{p.baseSku}</p>
                    </div>
                  ),
                },
                { key: "category", header: "Category", cell: (p) => p.category },
                {
                  key: "variants",
                  header: "Variants",
                  cell: (p) => (
                    <div className="min-w-40">
                      <p>{pluralize(p.variants, "variant")}</p>
                      {p.options && <p className="text-xs text-ink/50">{p.options}</p>}
                    </div>
                  ),
                },
                { key: "images", header: "Pictures", align: "right", cell: (p) => p.images },
                { key: "result", header: "Result", cell: (p) => <Result outcome={outcomes[p.baseSku]} warnings={p.warnings} /> },
              ]}
            />
          </div>

          {preview.problems.length > 0 && (
            <section className="border-t border-black/5 px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-danger">
                <XCircle size={15} /> To fix in the file ({preview.problems.length})
              </h3>
              <p className="mt-0.5 text-xs text-ink/50">These are not imported. Correct the rows, save the file and upload it again; products already added are skipped then.</p>
              <ul className="mt-3 space-y-2">
                {preview.problems.map((p, i) => (
                  <li key={`${p.baseSku}-${i}`} className="rounded-xl border border-danger/15 bg-danger/[0.04] px-3 py-2 text-sm">
                    <p className="font-medium">
                      {rowsLabel(p.rows)}
                      {p.baseSku && <span className="ml-2 font-mono text-xs text-ink/60">{p.baseSku}</span>}
                      {p.name && <span className="ml-2 text-ink/60">{p.name}</span>}
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink/70">
                      {p.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {preview.skipped.length > 0 && (
            <section className="border-t border-black/5 px-5 py-4">
              <h3 className="text-sm font-semibold">Already in the shop ({preview.skipped.length})</h3>
              <p className="mt-0.5 text-xs text-ink/50">Their Base SKU is already used, so they are left out and nothing is added twice.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {preview.skipped.map((s) => (
                  <li key={s.baseSku} className="flex flex-wrap gap-x-2 text-ink/70">
                    <span className="text-xs text-ink/50">{rowsLabel(s.rows)}</span>
                    <span className="font-mono text-xs">{s.baseSku}</span>
                    <span>{s.name}</span>
                    <span className="text-ink/50">· {s.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Card>
      )}
    </>
  );
}

function Result({ outcome, warnings }: { outcome?: Outcome; warnings: string[] }) {
  if (!outcome) {
    return warnings.length ? (
      <ul className="max-w-sm space-y-0.5 text-xs text-warning">
        {warnings.map((w) => (
          <li key={w} className="flex gap-1">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-xs text-ink/45">Ready</span>
    );
  }
  if (outcome.state === "importing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink/60">
        <Loader2 size={13} className="animate-spin" /> Adding…
      </span>
    );
  }
  return (
    <div className="max-w-sm space-y-1">
      {outcome.state === "created" ? (
        <Badge tone="success">
          <CheckCircle2 size={11} /> Added
        </Badge>
      ) : outcome.state === "skipped" ? (
        <Badge>Skipped</Badge>
      ) : (
        <Badge tone="danger">Failed</Badge>
      )}
      {outcome.message && <p className={clsx("text-xs", outcome.state === "failed" ? "text-danger" : "text-ink/55")}>{outcome.message}</p>}
      {outcome.productId && (
        <Link href={`/admin/products/${outcome.productId}`} className="text-xs font-semibold text-ink/70 underline-offset-2 hover:underline">
          Open
        </Link>
      )}
    </div>
  );
}
