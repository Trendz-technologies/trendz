"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, EyeOff, Info, Plus, Undo2 } from "lucide-react";
// Drops the server's cached store config, which carries these offers as well as the theme.
import { refreshThemeCache } from "../appearance/actions";
import { LinkSelect, OfferCardEditor, TextPair } from "@/components/admin/home-offers-fields";
import { PageHeader } from "@/components/admin/page";
import { HomeOffers, offersHiddenReason } from "@/components/store/home-offers";
import { Badge, Button, Card, Checkbox, ErrorState, Field, Input, Spinner, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime } from "@/lib/format";
import { LOCALE_NAMES, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import type { CategoryNode, HomeOffers as Offers, OfferCard } from "@/lib/types";

interface OffersRecord {
  value: Offers;
  updatedAt: string | null;
  updatedBy: string | null;
}

const QUERY_KEY = ["admin", "settings", "homeOffers"];
const MAX_CARDS = 4;
const NEW_CARD: OfferCard = { tag: { en: "", ta: "" }, title: { en: "", ta: "" }, caption: { en: "", ta: "" }, price: null, href: "", imageKey: null, imageUrl: null };
const PREVIEW_LANGUAGES: { value: Locale; label: string }[] = [
  { value: "en", label: LOCALE_NAMES.en },
  { value: "ta", label: LOCALE_NAMES.ta },
];

export default function HomeOffersPage() {
  const { can } = useAuth();
  const canEdit = can("settings.write");
  const locked = !canEdit;
  const qc = useQueryClient();
  const toast = useToast();

  const record = useQuery({ queryKey: QUERY_KEY, queryFn: () => api.get<OffersRecord>("/settings/homeOffers") });
  const categories = useQuery({ queryKey: ["store-categories"], queryFn: () => api.get<CategoryNode[]>("/store/categories"), staleTime: 300_000 });
  const saved = record.data?.value ?? null;

  // Unsaved edits; null means "showing what is saved".
  const [edits, setEdits] = useState<Offers | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<Locale>("en");
  const draft = edits ?? saved;
  const dirty = !!(edits && saved && JSON.stringify(edits) !== JSON.stringify(saved));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (record.isError) return <ErrorState error={record.error} retry={() => void record.refetch()} />;
  if (!draft || !saved) return <Spinner className="py-32" label="Loading the offers" />;

  const edit = (patch: Partial<Offers>) => setEdits({ ...draft, ...patch });
  const setCards = (cards: OfferCard[]) => edit({ cards });
  const moveCard = (from: number, by: -1 | 1) => {
    const cards = [...draft.cards];
    const [card] = cards.splice(from, 1);
    cards.splice(from + by, 0, card!);
    setCards(cards);
  };

  const save = async () => {
    setSaving(true);
    try {
      const value = await api.put<Offers>("/settings/homeOffers", draft);
      qc.setQueryData<OffersRecord>(QUERY_KEY, (r) => (r ? { ...r, value, updatedAt: new Date().toISOString() } : r));
      setEdits(null);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ["store-config"] });
      // The home page reads a copy cached on the server for a minute; drop it so the change shows now.
      const live = await refreshThemeCache().catch(() => false);
      toast(live ? "Offers saved and live on the home page" : "Offers saved. The home page picks them up within a minute.");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const hidden = offersHiddenReason(draft);
  const hiddenNote = {
    off: "Switched off, so the home page does not show this section.",
    ended: `The offer period ended on ${date(draft.endsOn)}, so the home page no longer shows this section. Move or clear the end date to bring it back.`,
    empty: "Nothing to show yet: add a card or switch on a banner.",
  };
  const savedLabel = record.data?.updatedAt ? `Saved ${dateTime(record.data.updatedAt)}${record.data.updatedBy ? ` by ${record.data.updatedBy}` : ""}` : "Starting content (never saved)";

  return (
    <>
      <PageHeader
        title="Home page offers"
        description="The offers section under the banner on the store's home page. Write each text in English and Tamil; shoppers see the language they picked."
        actions={
          <>
            {!canEdit ? <Badge>Read only</Badge> : dirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
            <Link href="/" target="_blank" className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink/70 hover:bg-black/[0.04] hover:text-ink">
              View home page <ExternalLink size={14} />
            </Link>
            <Button variant="outline" icon={<Undo2 size={15} />} disabled={!dirty || saving} onClick={() => setEdits(null)}>
              Discard
            </Button>
            <Button icon={<Check size={15} />} disabled={!dirty || !canEdit} loading={saving} onClick={() => void save()}>
              Save offers
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card title="Section" actions={<span className="text-right text-xs text-ink/45">{savedLabel}</span>}>
            <div className="space-y-4">
              <Checkbox label="Show this section on the home page" checked={draft.enabled} disabled={locked} onChange={(e) => edit({ enabled: e.target.checked })} />
              <TextPair id="offers-eyebrow" label="Small heading" value={draft.eyebrow} onChange={(eyebrow) => edit({ eyebrow })} max={40} disabled={locked} />
              <TextPair id="offers-title" label="Heading" value={draft.title} onChange={(title) => edit({ title })} max={80} disabled={locked} />
              <TextPair id="offers-subtitle" label="Introduction" value={draft.subtitle} onChange={(subtitle) => edit({ subtitle })} max={200} rows={2} disabled={locked} />
              <div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Offer starts" htmlFor="offers-from">
                    <Input id="offers-from" type="date" value={draft.startsOn ?? ""} max={draft.endsOn ?? undefined} disabled={locked} onChange={(e) => edit({ startsOn: e.target.value || null })} />
                  </Field>
                  <Field label="Offer ends" htmlFor="offers-to">
                    <Input id="offers-to" type="date" value={draft.endsOn ?? ""} min={draft.startsOn ?? undefined} disabled={locked} onChange={(e) => edit({ endsOn: e.target.value || null })} />
                  </Field>
                </div>
                <p className="mt-1.5 text-xs text-ink/50">The dates are printed on the sale banner. The whole section leaves the home page the day after the end date; leave it empty to keep the section up.</p>
              </div>
            </div>
          </Card>

          <Card
            title={`Offer cards (${draft.cards.length} of ${MAX_CARDS})`}
            actions={
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} disabled={locked || draft.cards.length >= MAX_CARDS} onClick={() => setCards([...draft.cards, NEW_CARD])}>
                Add card
              </Button>
            }
          >
            {draft.cards.length ? (
              <div className="space-y-4">
                {draft.cards.map((card, i) => (
                  <OfferCardEditor
                    key={i}
                    index={i}
                    count={draft.cards.length}
                    card={card}
                    categories={categories.data ?? []}
                    disabled={locked}
                    onChange={(next) => setCards(draft.cards.map((c, j) => (j === i ? next : c)))}
                    onMove={(by) => moveCard(i, by)}
                    onRemove={() => setCards(draft.cards.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink/55">No cards. Add one for each offer you want to feature.</p>
            )}
          </Card>

          <Card title="Gift banner">
            <div className="space-y-4">
              <Checkbox label="Show the gift banner" checked={draft.gift.enabled} disabled={locked} onChange={(e) => edit({ gift: { ...draft.gift, enabled: e.target.checked } })} />
              <TextPair id="gift-text" label="Message" value={draft.gift.text} onChange={(text) => edit({ gift: { ...draft.gift, text } })} max={200} rows={3} disabled={locked} />
              <TextPair id="gift-tag" label="Badge" hint="The tilted gold badge on the right (a small label above the message on phones)." value={draft.gift.tag} onChange={(tag) => edit({ gift: { ...draft.gift, tag } })} max={40} disabled={locked} />
            </div>
          </Card>

          <Card title="Sale banner">
            <div className="space-y-4">
              <Checkbox label="Show the sale banner" checked={draft.sale.enabled} disabled={locked} onChange={(e) => edit({ sale: { ...draft.sale, enabled: e.target.checked } })} />
              <TextPair id="sale-label" label="Label" value={draft.sale.label} onChange={(label) => edit({ sale: { ...draft.sale, label } })} max={60} disabled={locked} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Big figure" htmlFor="sale-value" hint="e.g. 20%">
                  <Input id="sale-value" value={draft.sale.value} maxLength={10} disabled={locked} onChange={(e) => edit({ sale: { ...draft.sale, value: e.target.value } })} />
                </Field>
                <LinkSelect id="sale-link" label="Opens" value={draft.sale.href} onChange={(href) => edit({ sale: { ...draft.sale, href } })} categories={categories.data ?? []} disabled={locked} />
              </div>
              <TextPair id="sale-word" label="Word under the figure" value={draft.sale.valueLabel} onChange={(valueLabel) => edit({ sale: { ...draft.sale, valueLabel } })} max={20} disabled={locked} />
              <p className="flex items-start gap-2 rounded-xl bg-info/10 px-3.5 py-3 text-xs leading-relaxed text-ink/70">
                <Info size={14} className="mt-0.5 shrink-0 text-info" />
                <span>
                  This banner only announces the offer; it does not change any price. To take the discount off at checkout or at the billing counter, also set it up under{" "}
                  <Link href="/admin/discounts" className="link">
                    Discounts
                  </Link>
                  .
                </span>
              </p>
            </div>
          </Card>
        </div>

        <Card className="min-w-0 xl:sticky xl:top-20" title="Preview" actions={<Tabs value={previewLocale} onChange={setPreviewLocale} tabs={PREVIEW_LANGUAGES} />}>
          {hidden && (
            <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-warning/10 px-3.5 py-3 text-xs leading-relaxed text-ink/75">
              <EyeOff size={14} className="mt-0.5 shrink-0 text-warning" />
              {hiddenNote[hidden]}
            </p>
          )}
          {/* The real storefront component, in the storefront's own type and page colour. */}
          <div lang={LOCALE_TAGS[previewLocale]} className="store-theme rounded-2xl bg-offwhite p-4 sm:p-5">
            <HomeOffers offers={draft} locale={previewLocale} />
          </div>
          <p className="mt-3 text-xs text-ink/45">Shown at this panel&apos;s width. The home page is wider, so cards sit side by side there.</p>
        </Card>
      </div>
    </>
  );
}
