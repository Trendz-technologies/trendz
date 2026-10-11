"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Moon, Pencil, RotateCcw, Sun, Undo2, X, type LucideIcon } from "lucide-react";
import { refreshThemeCache } from "./actions";
import { ColorPicker, CopyButton, HexInput, RgbInputs } from "@/components/admin/appearance-picker";
import { ThemePreview } from "@/components/admin/appearance-preview";
import { Badge, Button, Card, ErrorState, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { CONTROL_CONTRAST, DEFAULT_APPEARANCE, TEXT_CONTRAST, applyAppearance, contrast, normaliseAppearance, resolveText, surfaces, type Appearance, type ThemeMode } from "@/lib/theme";
import type { StoreConfig } from "@/lib/types";

interface AppearanceRecord {
  value: Appearance;
  updatedAt: string | null;
  updatedBy: string | null;
}

const QUERY_KEY = ["admin", "settings", "appearance"];

const MODES: { value: ThemeMode; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", hint: "Light surfaces, dark text.", icon: Sun },
  { value: "dark", label: "Dark", hint: "Dark surfaces, light text. The brand colour is unchanged.", icon: Moon },
];

/** Shortcuts only: the picker accepts any colour. */
const STARTING_POINTS = [
  { name: "Trendz pink", hex: "#ff3d9a" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Magenta", hex: "#c2187a" },
  { name: "Plum", hex: "#8e3b8f" },
  { name: "Violet", hex: "#6d4aff" },
  { name: "Royal blue", hex: "#2563eb" },
  { name: "Teal", hex: "#0f766e" },
  { name: "Emerald", hex: "#059669" },
  { name: "Gold", hex: "#c9902e" },
  { name: "Coral", hex: "#f0553c" },
];

const same = (a: Appearance, b: Appearance) => a.mode === b.mode && a.brandColor === b.brandColor && a.textColor === b.textColor;
const ratio = (n: number) => `${n.toFixed(1)}:1`;

export default function AppearancePage() {
  const { can } = useAuth();
  const canEdit = can("settings.write");
  const qc = useQueryClient();
  const toast = useToast();

  const record = useQuery({ queryKey: QUERY_KEY, queryFn: () => api.get<AppearanceRecord>("/settings/appearance") });
  const saved = record.data ? normaliseAppearance(record.data.value) : null;

  // Unsaved edits; null means "showing what is saved".
  const [edits, setEdits] = useState<Appearance | null>(null);
  const [saving, setSaving] = useState(false);
  const draft = edits ?? saved;
  const dirty = !!(edits && saved && !same(edits, saved));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (record.isError) return <ErrorState error={record.error} retry={() => void record.refetch()} />;
  if (!draft || !saved) return <Spinner className="py-32" label="Loading the theme" />;

  const edit = (patch: Partial<Appearance>) => setEdits({ ...draft, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      const value = normaliseAppearance(await api.put<Appearance>("/settings/appearance", draft));
      // Re-theme this tab straight away, and everything that reads the shared store config.
      applyAppearance(value);
      qc.setQueryData<StoreConfig>(["store-config"], (c) => (c ? { ...c, appearance: value } : c));
      qc.setQueryData<AppearanceRecord>(QUERY_KEY, (r) => (r ? { ...r, value, updatedAt: new Date().toISOString() } : r));
      setEdits(null);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      // Pages are cached on the server for a minute; drop that copy so the storefront changes now.
      const live = await refreshThemeCache().catch(() => false);
      toast(live ? "Theme saved and applied across the store" : "Theme saved. Other pages pick it up within a minute.");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const text = resolveText(draft);
  const isDefault = same(draft, DEFAULT_APPEARANCE);
  const savedLabel = record.data?.updatedAt ? `Saved ${dateTime(record.data.updatedAt)}${record.data.updatedBy ? ` by ${record.data.updatedBy}` : ""}` : "Default theme (never changed)";

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ink/50">
        <Link href="/admin" className="hover:text-ink">
          Admin
        </Link>
        <ChevronRight size={12} aria-hidden="true" />
        <Link href="/admin/settings" className="hover:text-ink">
          Settings
        </Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span aria-current="page" className="text-ink/80">
          Appearance
        </span>
      </nav>

      <div className="mb-6 mt-1 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Appearance &amp; Theme</h1>
          <p className="mt-1 text-sm text-ink/55">One brand colour and one mode, shared by the storefront, the admin console and the billing counter (POS).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!canEdit ? <Badge>Read only</Badge> : dirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
          <Button variant="outline" icon={<Undo2 size={15} />} disabled={!dirty || saving} onClick={() => setEdits(null)}>
            Discard
          </Button>
          <Button icon={<Check size={15} />} disabled={!dirty || !canEdit} loading={saving} onClick={() => void save()}>
            Save theme
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card title="Theme mode" actions={<span className="text-right text-xs text-ink/45">{savedLabel}</span>}>
            <p className="text-xs leading-relaxed text-ink/55">
              Changes only the surfaces and text. Your brand colour is the same in both. This is what everyone sees first; shoppers can switch between light and dark for themselves with the icon in the
              storefront header, and that choice stays in their own browser.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {MODES.map(({ value, label, hint, icon: Icon }) => {
                const active = draft.mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    disabled={!canEdit}
                    onClick={() => edit({ mode: value })}
                    className={clsx(
                      "flex flex-col items-start rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 disabled:cursor-not-allowed",
                      active ? "border-accent bg-accent/10" : "border-black/10 enabled:hover:border-accent/50",
                    )}
                  >
                    <span className={clsx("grid h-9 w-9 place-items-center rounded-xl", active ? "bg-accent text-white" : "bg-accent/10 text-accent")}>
                      <Icon size={17} />
                    </span>
                    <span className="mt-3 block text-sm font-semibold">{label}</span>
                    <span className="mt-0.5 block text-xs text-ink/55">{hint}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Brand colour">
            <p className="text-xs leading-relaxed text-ink/55">
              The only colour you set. Buttons and their hovers, active navigation, links, icons, checkboxes, radios, toggles, tabs, progress bars, badges, charts, table row selection, focus rings, hover and
              disabled states are all generated from it.
            </p>

            <div className="mt-4">
              <ColorPicker value={draft.brandColor} onChange={(brandColor) => edit({ brandColor })} disabled={!canEdit} />
            </div>

            <div className="mt-4 flex items-end gap-3">
              <span aria-hidden="true" className="h-10.5 w-10.5 shrink-0 rounded-xl border border-black/10" style={{ background: draft.brandColor }} />
              <div className="min-w-0 flex-1">
                <label htmlFor="brand-hex" className="label">
                  HEX
                </label>
                <HexInput id="brand-hex" value={draft.brandColor} onChange={(brandColor) => edit({ brandColor })} disabled={!canEdit} />
              </div>
              <CopyButton value={draft.brandColor.toUpperCase()} />
            </div>

            <div className="mt-3">
              <RgbInputs value={draft.brandColor} onChange={(brandColor) => edit({ brandColor })} disabled={!canEdit} />
            </div>

            <div className="mt-5">
              <p className="label">Starting points</p>
              <div className="flex flex-wrap gap-2.5">
                {STARTING_POINTS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={`${c.name} ${c.hex.toUpperCase()}`}
                    aria-label={`${c.name} ${c.hex.toUpperCase()}`}
                    aria-pressed={draft.brandColor === c.hex}
                    disabled={!canEdit}
                    onClick={() => edit({ brandColor: c.hex })}
                    className={clsx(
                      "h-7 w-7 rounded-full border border-black/10 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35 enabled:hover:scale-110 disabled:cursor-not-allowed",
                      draft.brandColor === c.hex && "ring-2 ring-ink ring-offset-2 ring-offset-white",
                    )}
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-ink/45">Shortcuts only — the picker accepts any colour.</p>
            </div>

            <div className="mt-6 border-t border-black/5 pt-5">
              <p className="text-sm font-semibold">Text colour</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">
                Optional. Body text and admin headings default to a near-{draft.mode === "dark" ? "white" : "black"} that carries a trace of your brand. Set a colour here to override it — secondary and muted
                text are still derived from it, so the text scale stays consistent. Storefront titles stay gold.
              </p>
              {draft.textColor === null ? (
                <Button variant="secondary" size="sm" className="mt-3" icon={<Pencil size={13} />} disabled={!canEdit} onClick={() => edit({ textColor: text.derived })}>
                  Choose a text colour
                </Button>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <input
                      type="color"
                      aria-label="Text colour"
                      value={draft.textColor}
                      disabled={!canEdit}
                      onChange={(e) => edit({ textColor: e.target.value.toLowerCase() })}
                      className="h-10.5 w-14 shrink-0 cursor-pointer rounded-xl border border-black/10 bg-white p-1 disabled:cursor-not-allowed"
                    />
                    <div className="w-36">
                      <label htmlFor="text-hex" className="label">
                        HEX
                      </label>
                      <HexInput id="text-hex" value={draft.textColor} onChange={(textColor) => edit({ textColor })} disabled={!canEdit} />
                    </div>
                    <Button variant="ghost" icon={<X size={14} />} disabled={!canEdit} onClick={() => edit({ textColor: null })}>
                      Use the default
                    </Button>
                  </div>
                  {text.ratio !== null && (
                    <p role="status" className={clsx("mt-2.5 flex items-start gap-1.5 text-xs", text.ignored ? "text-warning" : "text-ink/55")}>
                      {text.ignored ? <AlertTriangle size={14} className="mt-px shrink-0" /> : <CheckCircle2 size={14} className="mt-px shrink-0 text-success" />}
                      {text.ignored
                        ? `Only ${ratio(text.ratio)} against cards in ${draft.mode} mode (text needs ${TEXT_CONTRAST}:1), so the default text colour is used instead. Pick a ${draft.mode === "dark" ? "lighter" : "darker"} colour.`
                        : `${ratio(text.ratio)} against cards in ${draft.mode} mode. Easy to read.`}
                    </p>
                  )}
                </>
              )}
            </div>

            <ContrastNote brand={draft.brandColor} />

            <Button variant="outline" className="mt-4 w-full" icon={<RotateCcw size={14} />} disabled={!canEdit || isDefault} onClick={() => setEdits(DEFAULT_APPEARANCE)}>
              Restore default ({DEFAULT_APPEARANCE.brandColor.toUpperCase()}, {DEFAULT_APPEARANCE.mode})
            </Button>
          </Card>
        </div>

        <Card
          className="min-w-0 xl:sticky xl:top-20"
          title="Live preview"
          actions={
            <span className="font-mono text-xs text-ink/45">
              {draft.mode} mode · {draft.brandColor.toUpperCase()}
            </span>
          }
        >
          <ThemePreview appearance={draft} />
        </Card>
      </div>
    </>
  );
}

/** How well the brand colour stands out from cards in each mode. */
function ContrastNote({ brand }: { brand: string }) {
  const light = contrast(brand, surfaces("light", brand).card);
  const dark = contrast(brand, surfaces("dark", brand).card);
  const failing = [light < CONTROL_CONTRAST && "light", dark < CONTROL_CONTRAST && "dark"].filter(Boolean);
  const ok = failing.length === 0;
  return (
    <div role="status" className={clsx("mt-5 rounded-xl px-3.5 py-3 text-xs", ok ? "bg-accent/[0.07]" : "bg-warning/10")}>
      <p className="flex items-center gap-1.5 font-semibold">
        {ok ? <CheckCircle2 size={14} className="shrink-0 text-success" /> : <AlertTriangle size={14} className="shrink-0 text-warning" />}
        Contrast on cards — light {ratio(light)} · dark {ratio(dark)}
      </p>
      <p className="mt-0.5 text-ink/60">
        {ok
          ? `Meets the ${CONTROL_CONTRAST}:1 guideline for buttons and controls in both modes.`
          : `Below the ${CONTROL_CONTRAST}:1 guideline in ${failing.join(" and ")} mode: buttons, links and icons in this colour will be hard to see there.`}
      </p>
    </div>
  );
}
