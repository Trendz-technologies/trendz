"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertTriangle, Camera, History, LayoutDashboard, LogOut, Percent, Search, Trash2, WifiOff, XCircle } from "lucide-react";
import { LogoMark } from "@/components/store/navbar";
import { Button, ConfirmDialog, ErrorState, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { BillLines, LineDiscountDialog } from "@/components/pos/bill";
import { beep } from "@/components/pos/feedback";
import { ChargeDialog, GatewayPaymentDialog, SaleCompleteDialog } from "@/components/pos/payment";
import { RecentSalesDialog } from "@/components/pos/recent-sales";
import { CameraScanner, ScannerInput, type ScannerInputHandle } from "@/components/pos/scanner";
import { BillDiscountDialog, CouponSection, CustomerSection, Totals } from "@/components/pos/summary";
import { METHOD_LABELS, type CheckoutResult, type PosCart, type PosConfig, type PosLine, type PosPaymentMethod, type PosSearchResult, type ScannedProduct } from "@/components/pos/types";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import type { StoreConfig } from "@/lib/types";

interface Warehouse {
  id: string;
  code: string;
  name: string;
  status: string;
}

type ScanFeedback =
  | { kind: "ok"; product: ScannedProduct; quantity: number; at: number }
  | { kind: "error"; message: string; code: string; quantity: number; canOverride: boolean; product: ScannedProduct | null; at: number };

const WAREHOUSE_KEY = "trendz.pos.warehouse";

function storedWarehouse() {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(WAREHOUSE_KEY);
  } catch {
    return null;
  }
}

/** Browser connectivity plus a periodic API health check. */
function useConnection() {
  const online = useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const health = useQuery({
    queryKey: ["pos", "health"],
    queryFn: async () => {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error("API unavailable");
      return true;
    },
    refetchInterval: 15_000,
    retry: false,
  });
  return !online ? "offline" : health.isError ? "server" : "online";
}

export default function PosPage() {
  const { user, can, logout } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const connection = useConnection();
  const scanner = useRef<ScannerInputHandle>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const warehouses = useQuery({ queryKey: ["pos", "warehouses"], queryFn: () => api.get<Warehouse[]>("/warehouses"), staleTime: 300_000 });
  const config = useQuery({ queryKey: ["pos", "config"], queryFn: () => api.get<PosConfig>("/pos/config"), staleTime: 60_000 });
  const store = useQuery({ queryKey: ["store-config"], queryFn: () => api.get<StoreConfig>("/store/config"), staleTime: 300_000 });

  const active = (warehouses.data ?? []).filter((w) => w.status === "ACTIVE");
  const [chosen, setChosen] = useState<string | null>(storedWarehouse);
  const warehouseId = active.find((w) => w.id === chosen)?.id ?? active.find((w) => w.id === user?.defaultWarehouseId)?.id ?? active[0]?.id ?? null;
  const warehouse = active.find((w) => w.id === warehouseId);

  // One open bill per cashier per location; opening is "open or resume".
  const opened = useQuery({
    queryKey: ["pos", "open", warehouseId],
    enabled: !!warehouseId,
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => {
      const c = await api.post<PosCart>("/pos/carts", { warehouseId });
      qc.setQueryData(["pos", "cart", c.id], c);
      return c;
    },
  });
  const [nextCart, setNextCart] = useState<{ warehouseId: string; cartId: string } | null>(null);
  const cartId = nextCart && nextCart.warehouseId === warehouseId ? nextCart.cartId : (opened.data?.id ?? null);
  const cartQ = useQuery({ queryKey: ["pos", "cart", cartId], enabled: !!cartId, staleTime: Infinity, queryFn: () => api.get<PosCart>(`/pos/carts/${cartId}`) });
  const cart = cartQ.data;

  // Every bill change goes through one queue so rapid scans are applied in order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [pending, setPending] = useState(0);
  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    setPending((p) => p + 1);
    const run = queue.current.then(fn);
    queue.current = run.catch(() => undefined);
    return run.finally(() => setPending((p) => p - 1));
  }, []);
  const applyCart = useCallback((c: PosCart) => qc.setQueryData(["pos", "cart", c.id], c), [qc]);

  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [method, setMethod] = useState<PosPaymentMethod | null>(null);
  const [charging, setCharging] = useState<PosPaymentMethod | null>(null);
  const [complete, setComplete] = useState<{ sale: CheckoutResult; method: PosPaymentMethod } | null>(null);
  const [gateway, setGateway] = useState<CheckoutResult | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [discountLine, setDiscountLine] = useState<PosLine | null>(null);
  const [billDiscountOpen, setBillDiscountOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const methods = config.data?.enabledPaymentMethods ?? [];
  const selectedMethod = method && methods.includes(method) ? method : (methods[0] ?? null);

  const scan = (code: string, quantity: number, override = false) => {
    if (!cartId || !warehouseId) return;
    void enqueue(async () => {
      try {
        const r = await api.post<{ scanned: ScannedProduct; cart: PosCart }>(`/pos/carts/${cartId}/scan`, { code, quantity, override });
        applyCart(r.cart);
        setFeedback({ kind: "ok", product: r.scanned, quantity, at: Date.now() });
        beep("ok");
      } catch (err) {
        beep("error");
        const outOfStock = err instanceof ApiError && err.code === "OUT_OF_STOCK";
        // For stock problems, look the product up to show where else it is available.
        const product = outOfStock ? await api.post<{ product: ScannedProduct }>("/products/scan", { code, warehouseId }).then((r) => r.product, () => null) : null;
        setFeedback({ kind: "error", message: errorMessage(err), code, quantity, canOverride: outOfStock && can("pos.override_stock"), product, at: Date.now() });
      }
    });
  };

  const mutateCart = useCallback(
    (fn: (id: string) => Promise<PosCart>) => {
      if (!cartId) return Promise.reject(new Error("No open bill"));
      return enqueue(async () => {
        const c = await fn(cartId);
        applyCart(c);
        return c;
      });
    },
    [cartId, enqueue, applyCart],
  );
  const patchCart = useCallback((body: Record<string, unknown>) => mutateCart((id) => api.patch<PosCart>(`/pos/carts/${id}`, body)), [mutateCart]);
  const report = (p: Promise<unknown>) => p.catch((e) => toast(errorMessage(e), "error"));

  const addFromSearch = (r: PosSearchResult) => {
    report(
      mutateCart((id) => api.post<PosCart>(`/pos/carts/${id}/items`, { variantId: r.variantId, quantity: 1 })).then(() => {
        beep("ok");
        scanner.current?.focus();
      }),
    );
  };

  const startNewBill = (id: string) => {
    if (!warehouseId) return;
    setNextCart({ warehouseId, cartId: id });
    setFeedback(null);
    void qc.invalidateQueries({ queryKey: ["pos", "recent"] });
  };

  const onCheckout = (result: CheckoutResult, m: PosPaymentMethod) => {
    setCharging(null);
    startNewBill(result.nextCartId);
    if (result.requiresGatewayPayment) setGateway(result);
    else setComplete({ sale: result, method: m });
  };

  const clearBill = async () => {
    if (!cartId || !warehouseId) return;
    setClearing(true);
    try {
      await enqueue(() => api.post(`/pos/carts/${cartId}/abandon`));
      const fresh = await api.post<PosCart>("/pos/carts", { warehouseId });
      applyCart(fresh);
      startNewBill(fresh.id);
      setClearOpen(false);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setClearing(false);
    }
  };

  const blockingIssue = cart?.items.some((l) => l.stockIssue && !l.stockOverride) ?? false;
  const canCharge = !!cart && cart.items.length > 0 && !blockingIssue && pending === 0 && connection !== "offline" && !!selectedMethod;

  // Keyboard shortcuts for the counter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "F2") {
        e.preventDefault();
        searchInput.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        setCameraOpen((o) => !o);
      } else if (e.key === "F9" && canCharge && selectedMethod) {
        e.preventDefault();
        setCharging(selectedMethod);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canCharge, selectedMethod]);

  if (warehouses.error) return <ErrorState error={warehouses.error} retry={() => warehouses.refetch()} />;
  if (warehouses.data && !active.length) {
    return (
      <div className="container-x py-24 text-center">
        <p className="text-lg font-semibold">No active billing location</p>
        <p className="mt-2 text-sm text-ink/55">Ask an administrator to activate a warehouse or store before billing.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-black/5 bg-offwhite/90 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <Link href="/admin" className="flex items-center gap-2" aria-label="Back to admin">
          <LogoMark />
          <span className="text-sm font-semibold tracking-[0.25em]">TRENDZ</span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">Billing</span>
        </Link>
        <Select
          aria-label="Billing location"
          value={warehouseId ?? ""}
          onChange={(e) => {
            setChosen(e.target.value);
            try {
              window.localStorage.setItem(WAREHOUSE_KEY, e.target.value);
            } catch {
              // Remembering the location is a convenience only.
            }
            if (cart?.items.length) toast(`The open bill at ${warehouse?.name} is kept; switch back to resume it.`);
          }}
          className="h-9 max-w-60 py-0 text-sm"
        >
          {active.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.code})
            </option>
          ))}
        </Select>
        <ConnectionPill status={connection} />
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" icon={<History size={15} />} onClick={() => setRecentOpen(true)} disabled={!warehouseId}>
            <span className="hidden sm:inline">Recent sales</span>
          </Button>
          <Link href="/admin" className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink/60 hover:bg-black/5 md:flex">
            <LayoutDashboard size={14} /> Admin
          </Link>
          <span className="hidden max-w-36 truncate text-xs text-ink/50 lg:block">{user?.name ?? user?.email}</span>
          <button aria-label="Sign out" onClick={() => void logout()} className="rounded-full p-2 text-ink/50 hover:bg-black/5 hover:text-ink">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {connection !== "online" && (
        <div role="status" className="flex items-center gap-2 bg-danger px-4 py-2 text-sm font-medium text-white sm:px-6">
          <WifiOff size={16} />
          {connection === "offline" ? "You are offline. Bills cannot be completed until the connection is back." : "The billing server is not responding. Retrying…"}
        </div>
      )}

      {!cart ? (
        cartQ.error || opened.error ? (
          <ErrorState error={cartQ.error ?? opened.error} retry={() => (cartQ.error ? cartQ.refetch() : opened.refetch())} />
        ) : (
          <Spinner className="py-32" label="Opening bill" />
        )
      ) : (
        <div className="grid flex-1 gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <main className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <ScannerInput ref={scanner} onScan={scan} busy={pending > 0} />
              </div>
              <Button variant={cameraOpen ? "primary" : "outline"} size="lg" className="h-14" icon={<Camera size={18} />} onClick={() => setCameraOpen((o) => !o)} aria-pressed={cameraOpen}>
                Camera <kbd className="ml-1 hidden text-[10px] opacity-60 sm:inline">F4</kbd>
              </Button>
            </div>

            {cameraOpen && (
              <div className="card p-4">
                <CameraScanner onScan={(code) => scan(code, 1)} onClose={() => setCameraOpen(false)} />
              </div>
            )}

            {feedback && <ScanFeedbackCard feedback={feedback} onOverride={() => feedback.kind === "error" && scan(feedback.code, feedback.quantity, true)} onDismiss={() => setFeedback(null)} />}

            <ProductSearch inputRef={searchInput} warehouseId={warehouseId!} onPick={addFromSearch} />

            <section className="card flex-1 p-3 sm:p-4" aria-label="Bill">
              <div className="mb-1 flex items-center justify-between px-1">
                <h1 className="text-sm font-semibold">
                  Current bill <span className="font-normal text-ink/45">· {cart.totals.itemCount} {cart.totals.itemCount === 1 ? "item" : "items"}</span>
                </h1>
                {pending > 0 && <span className="text-xs text-ink/45">Updating…</span>}
              </div>
              <BillLines
                lines={cart.items}
                canDiscount={can("pos.manual_discount")}
                onQuantity={(l, quantity) => report(mutateCart((id) => api.patch<PosCart>(`/pos/carts/${id}/items/${l.id}`, { quantity })))}
                onDiscount={setDiscountLine}
                onRemove={(l) => report(mutateCart((id) => api.delete<PosCart>(`/pos/carts/${id}/items/${l.id}`)))}
              />
            </section>
          </main>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-18 lg:h-[calc(100vh-96px)] lg:overflow-y-auto">
            <CustomerSection key={`c-${cart.id}`} cart={cart} onPatch={patchCart} />
            <CouponSection key={`k-${cart.id}`} cart={cart} onPatch={patchCart} />
            <div className="card space-y-4 p-4">
              <Totals cart={cart} pricesIncludeTax={store.data?.pricesIncludeTax ?? true} />
              {can("pos.manual_discount") && (
                <Button variant="ghost" size="sm" icon={<Percent size={14} />} disabled={!cart.items.length} onClick={() => setBillDiscountOpen(true)}>
                  {cart.manualDiscount ? `Bill discount ${money(cart.manualDiscount)}` : "Add bill discount"}
                </Button>
              )}
            </div>
            <div className="card space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink/45">Payment</p>
              <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2">
                {methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={selectedMethod === m}
                    onClick={() => setMethod(m)}
                    className={clsx("rounded-2xl border px-3 py-2.5 text-sm font-semibold transition", selectedMethod === m ? "border-ink bg-ink text-white" : "border-black/10 bg-white hover:bg-black/3")}
                  >
                    {METHOD_LABELS[m]}
                  </button>
                ))}
                {!methods.length && config.data && <p className="col-span-2 text-sm text-danger">No payment methods are enabled for billing. Check Settings → POS.</p>}
              </div>
              {blockingIssue && (
                <p className="flex items-start gap-1.5 text-xs text-danger">
                  <AlertTriangle size={14} className="mt-px shrink-0" /> Some items are short of stock at this location. Reduce the quantity or remove them.
                </p>
              )}
              <Button size="lg" className="w-full" disabled={!canCharge} onClick={() => selectedMethod && setCharging(selectedMethod)}>
                Charge {money(cart.totals.grandTotal)} <kbd className="ml-1 text-[10px] opacity-60">F9</kbd>
              </Button>
              <Button variant="ghost" size="sm" className="w-full" icon={<Trash2 size={14} />} disabled={!cart.items.length || pending > 0} onClick={() => setClearOpen(true)}>
                Clear bill
              </Button>
            </div>
            <p className="px-1 text-[11px] text-ink/40">Shortcuts: F2 search · F4 camera · F9 charge · Esc closes dialogs</p>
          </aside>
        </div>
      )}

      {cart && charging && <ChargeDialog cart={cart} method={charging} onClose={() => setCharging(null)} onDone={(r) => onCheckout(r, charging)} />}
      {gateway && (
        <GatewayPaymentDialog
          sale={gateway}
          onClose={() => setGateway(null)}
          onPaid={() => {
            setComplete({ sale: { ...gateway, order: { ...gateway.order, paymentStatus: "PAID" } }, method: "RAZORPAY" });
            setGateway(null);
            void qc.invalidateQueries({ queryKey: ["pos", "recent"] });
          }}
        />
      )}
      {complete && (
        <SaleCompleteDialog
          sale={complete.sale}
          method={complete.method}
          onClose={() => {
            setComplete(null);
            scanner.current?.focus();
          }}
        />
      )}
      {recentOpen && warehouseId && (
        <RecentSalesDialog
          warehouseId={warehouseId}
          onClose={() => setRecentOpen(false)}
          onCollect={(s) => {
            setRecentOpen(false);
            setGateway(s);
          }}
        />
      )}
      {discountLine && (
        <LineDiscountDialog
          line={discountLine}
          config={config.data}
          onClose={() => setDiscountLine(null)}
          onSave={async (manualDiscount) => {
            await mutateCart((id) => api.patch<PosCart>(`/pos/carts/${id}/items/${discountLine.id}`, { manualDiscount }));
          }}
        />
      )}
      {cart && billDiscountOpen && <BillDiscountDialog cart={cart} config={config.data} onPatch={patchCart} onClose={() => setBillDiscountOpen(false)} />}
      <ConfirmDialog
        open={clearOpen}
        title="Clear this bill?"
        body="All scanned items are removed. Nothing has been charged and no stock was deducted."
        confirmLabel="Clear bill"
        tone="danger"
        loading={clearing}
        onConfirm={() => void clearBill()}
        onClose={() => setClearOpen(false)}
      />
    </div>
  );
}

function ConnectionPill({ status }: { status: "online" | "offline" | "server" }) {
  const label = { online: "Online", offline: "Offline", server: "Server unreachable" }[status];
  return (
    <span role="status" className={clsx("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", status === "online" ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
      <span className={clsx("h-2 w-2 rounded-full", status === "online" ? "bg-success" : "animate-pulse bg-danger")} />
      {label}
    </span>
  );
}

function ScanFeedbackCard({ feedback, onOverride, onDismiss }: { feedback: ScanFeedback; onOverride: () => void; onDismiss: () => void }) {
  if (feedback.kind === "ok") {
    const p = feedback.product;
    return (
      <div key={feedback.at} role="status" className="flex animate-rise items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-3">
        {p.image ? <img src={p.image} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-xl object-cover" /> : <span className="h-12 w-12 rounded-xl bg-white" />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-semibold">
            {feedback.quantity > 1 && <span className="text-success">{feedback.quantity} × </span>}
            {p.name} <span className="font-normal text-ink/55">· {p.variant}</span>
          </p>
          <p className="text-xs text-ink/55">
            <span className="font-mono">{p.sku}</span> · {money(p.price)}
            {p.mrp > p.price && <span className="ml-1 line-through">{money(p.mrp)}</span>} · {Math.max(0, p.availableStock - feedback.quantity)} left here
          </p>
        </div>
      </div>
    );
  }
  const p = feedback.product;
  return (
    <div key={feedback.at} role="alert" className="animate-rise rounded-2xl border border-danger/30 bg-danger/5 p-3">
      <div className="flex items-start gap-3">
        <XCircle size={20} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-danger">{feedback.message}</p>
          <p className="text-xs text-ink/55">
            Scanned: <span className="font-mono">{feedback.code}</span>
            {p && (
              <>
                {" "}
                · {p.name} ({p.variant}) · {Math.max(0, p.availableStock)} here
              </>
            )}
          </p>
          {p && p.otherWarehouses.length > 0 && (
            <p className="mt-1 text-xs text-ink/70">Available at: {p.otherWarehouses.map((w) => `${w.name} (${w.available})`).join(", ")}</p>
          )}
          {feedback.canOverride && (
            <Button size="sm" variant="outline" className="mt-2" onClick={onOverride}>
              Sell anyway (stock override, audited)
            </Button>
          )}
        </div>
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="rounded-full p-1 text-ink/40 hover:bg-black/5">
          <XCircle size={16} />
        </button>
      </div>
    </div>
  );
}

/** Name / SKU search for items without a readable code. */
function ProductSearch({ warehouseId, onPick, inputRef }: { warehouseId: string; onPick: (r: PosSearchResult) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(term.trim()), 250);
    return () => window.clearTimeout(t);
  }, [term]);
  const q = useQuery({
    queryKey: ["pos", "search", warehouseId, debounced],
    enabled: debounced.length >= 2,
    queryFn: () => api.get<PosSearchResult[]>("/pos/products/search", { q: debounced, warehouseId }),
    staleTime: 15_000,
  });
  const results = debounced.length >= 2 ? (q.data ?? []) : [];
  const pick = (r: PosSearchResult | undefined) => {
    if (!r) return;
    onPick(r);
    setTerm("");
    setDebounced("");
    setHighlight(0);
  };

  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
      <input
        ref={inputRef}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[highlight]);
          } else if (e.key === "Escape") setTerm("");
        }}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="pos-search-results"
        aria-autocomplete="list"
        aria-label="Search products by name or SKU"
        placeholder="Search by product name or SKU (F2)"
        className="input h-11 pl-10"
      />
      {debounced.length >= 2 && (
        <ul id="pos-search-results" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-2xl border border-black/5 bg-white p-1 shadow-neu-lg">
          {q.isLoading && <li className="px-3 py-2 text-sm text-ink/50">Searching…</li>}
          {!q.isLoading && !results.length && <li className="px-3 py-2 text-sm text-ink/50">No matching products</li>}
          {results.map((r, i) => (
            <li
              key={r.variantId}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={clsx("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2", i === highlight && "bg-offwhite")}
            >
              {r.image ? <img src={r.image} alt="" loading="lazy" decoding="async" className="h-9 w-9 rounded-lg object-cover" /> : <span className="h-9 w-9 rounded-lg bg-offwhite" />}
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">
                  {r.name} <span className="text-ink/50">· {r.variant}</span>
                </p>
                <p className="font-mono text-xs text-ink/45">{r.sku}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{money(r.price)}</p>
                <p className={clsx("text-xs", r.available > 0 ? "text-ink/50" : "text-danger")}>{r.available > 0 ? `${r.available} in stock` : "Out of stock"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
