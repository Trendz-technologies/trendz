"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { ContentActions, ContentSection, useContentEditor } from "@/components/admin/cms-shared";
import { LinkSelect, PictureField, TextPair } from "@/components/admin/home-offers-fields";
import { PageHeader } from "@/components/admin/page";
import { Card, ErrorState, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { CategoryNode, HomeListing, HomePageContent } from "@/lib/types";

const MAX_POINTS = 3;
const EMPTY = { en: "", ta: "" };

/** The three texts every product section has. */
function ListingFields({ id, value, onChange, disabled }: { id: string; value: HomeListing; onChange: (patch: Partial<HomeListing>) => void; disabled: boolean }) {
  return (
    <>
      <TextPair id={`${id}-eyebrow`} label="Small heading" value={value.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} max={40} disabled={disabled} />
      <TextPair id={`${id}-title`} label="Heading" value={value.title} onChange={(title) => onChange({ title })} max={80} disabled={disabled} />
      <TextPair id={`${id}-link`} label="Link beside the heading" value={value.linkLabel} onChange={(linkLabel) => onChange({ linkLabel })} max={40} disabled={disabled} />
    </>
  );
}

export default function HomePageEditor() {
  const editor = useContentEditor<HomePageContent>("homePage");
  const categories = useQuery({ queryKey: ["store-categories"], queryFn: () => api.get<CategoryNode[]>("/store/categories"), staleTime: 300_000 });
  const { draft, record, canEdit } = editor;
  const locked = !canEdit;

  if (record.isError) return <ErrorState error={record.error} retry={() => void record.refetch()} />;
  if (!draft) return <Spinner className="py-32" label="Loading the home page" />;

  // Changes some fields of one section, keeping the rest of it.
  const set = <K extends keyof HomePageContent>(section: K, patch: Partial<HomePageContent[K]>) => editor.edit({ [section]: { ...draft[section], ...patch } } as Partial<HomePageContent>);
  const { hero, editorial, promises, closing } = draft;
  const links = categories.data ?? [];
  // Always three boxes, so a point can be typed into any of them; the page leaves out the empty ones.
  const points = Array.from({ length: MAX_POINTS }, (_, i) => editorial.points[i] ?? EMPTY);

  return (
    <>
      <PageHeader
        title="Home page"
        description="The sections of the store's home page, from top to bottom. Write each text in English and Tamil; shoppers see the language they picked, and a text left empty is left out."
        actions={<ContentActions editor={editor} view={{ href: "/", label: "View home page" }} saveLabel="Save home page" onSave={() => void editor.save("Home page saved.")} />}
      />

      <div className="max-w-4xl space-y-6">
        <p className="text-right text-xs text-ink/45">{editor.savedLabel}</p>

        <ContentSection title="Shop logo" note="Shown at the top and at the foot of every page of the store, and in the closing band of this page.">
          <PictureField
            label="Logo"
            logo
            hint="Optional. The store shows the logo on dark panels, so one drawn for a black or transparent background looks best. Without one, the logo that came with the store is shown."
            imageKey={draft.logo.imageKey}
            imageUrl={draft.logo.imageUrl}
            onChange={(picture) => set("logo", picture)}
            disabled={locked}
          />
        </ContentSection>

        <ContentSection title="Banner" note="The top of the page: the headline and two links, with one picture beside them (above them on phones).">
          <TextPair id="hero-top" label="Headline, first line" hint="Shown in gold." value={hero.titleTop} onChange={(titleTop) => set("hero", { titleTop })} max={40} disabled={locked} />
          <TextPair id="hero-bottom" label="Headline, second line" hint="Shown in the brand colour." value={hero.titleBottom} onChange={(titleBottom) => set("hero", { titleBottom })} max={40} disabled={locked} />
          <TextPair id="hero-tagline" label="Tagline" hint="The handwritten line above the headline." value={hero.tagline} onChange={(tagline) => set("hero", { tagline })} max={60} disabled={locked} />
          <TextPair id="hero-body" label="Introduction" value={hero.body} onChange={(body) => set("hero", { body })} max={300} rows={3} disabled={locked} />
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <TextPair id="hero-primary" label="Button" value={hero.primaryLabel} onChange={(primaryLabel) => set("hero", { primaryLabel })} max={40} disabled={locked} />
            <LinkSelect id="hero-primary-link" label="Opens" value={hero.primaryHref} onChange={(primaryHref) => set("hero", { primaryHref })} categories={links} disabled={locked} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <TextPair id="hero-secondary" label="Link beside the button" value={hero.secondaryLabel} onChange={(secondaryLabel) => set("hero", { secondaryLabel })} max={40} disabled={locked} />
            <LinkSelect id="hero-secondary-link" label="Opens" value={hero.secondaryHref} onChange={(secondaryHref) => set("hero", { secondaryHref })} categories={links} disabled={locked} />
          </div>
          <div className="space-y-2">
            <TextPair id="hero-highlight-value" label="First highlight" value={hero.highlightValue} onChange={(highlightValue) => set("hero", { highlightValue })} max={20} disabled={locked} />
            <TextPair
              id="hero-highlight-label"
              label="Words under it"
              hint="The first of the three figures under the buttons. The other two show the free-shipping amount and the return window, and follow Settings."
              value={hero.highlightLabel}
              onChange={(highlightLabel) => set("hero", { highlightLabel })}
              max={30}
              disabled={locked}
            />
          </div>
          <PictureField
            hint="Optional. A photo of an outfit works best: it fills half of the banner and is cropped from the bottom to fit, so keep faces near the top. Without one, the first featured product is shown with its name and price."
            imageKey={hero.imageKey}
            imageUrl={hero.imageUrl}
            onChange={(picture) => set("hero", picture)}
            disabled={locked}
          />
        </ContentSection>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Offers</h2>
              <p className="mt-1 text-xs text-ink/55">The offer cards and banners under the banner have their own editor, with a preview and an offer period.</p>
            </div>
            <Link href="/admin/home-offers" className="inline-flex h-10 items-center gap-2 rounded-full border border-black/15 px-4 text-sm font-semibold hover:bg-black/[0.03]">
              Home page offers <ArrowRight size={15} />
            </Link>
          </div>
        </Card>

        <ContentSection title="Shop by category" note="One tile for each top-level category." enabled={draft.categories.enabled} onToggle={(enabled) => set("categories", { enabled })} disabled={locked}>
          <ListingFields id="categories" value={draft.categories} onChange={(patch) => set("categories", patch)} disabled={locked} />
        </ContentSection>

        <ContentSection title="Popular picks" note="A row of the products marked as featured." enabled={draft.popular.enabled} onToggle={(enabled) => set("popular", { enabled })} disabled={locked}>
          <ListingFields id="popular" value={draft.popular} onChange={(patch) => set("popular", patch)} disabled={locked} />
        </ContentSection>

        <ContentSection title="About the collection" note="The wide card with a product photo beside a short piece about the shop." enabled={editorial.enabled} onToggle={(enabled) => set("editorial", { enabled })} disabled={locked}>
          <TextPair id="editorial-eyebrow" label="Small heading" value={editorial.eyebrow} onChange={(eyebrow) => set("editorial", { eyebrow })} max={40} disabled={locked} />
          <TextPair id="editorial-title" label="Heading, first line" value={editorial.title} onChange={(title) => set("editorial", { title })} max={80} disabled={locked} />
          <TextPair id="editorial-accent" label="Heading, second line" hint="Shown in the brand colour." value={editorial.titleAccent} onChange={(titleAccent) => set("editorial", { titleAccent })} max={80} disabled={locked} />
          <TextPair id="editorial-body" label="Text" value={editorial.body} onChange={(body) => set("editorial", { body })} max={400} rows={3} disabled={locked} />
          <div className="space-y-2">
            {points.map((point, i) => (
              <TextPair
                key={i}
                id={`editorial-point-${i}`}
                label={`Point ${i + 1}`}
                hint={i === MAX_POINTS - 1 ? "Up to three short points, shown as gold-edged tags under the text." : undefined}
                value={point}
                onChange={(next) => set("editorial", { points: points.map((p, j) => (j === i ? next : p)) })}
                max={40}
                disabled={locked}
              />
            ))}
          </div>
        </ContentSection>

        <ContentSection
          title="Delivery, returns and payment"
          note="Three cards. The delivery and returns headings state the free-shipping amount and the return window, so they follow Settings and cannot disagree with checkout; the lines under them are yours."
          enabled={promises.enabled}
          onToggle={(enabled) => set("promises", { enabled })}
          disabled={locked}
        >
          <TextPair id="promise-shipping" label="Under the delivery heading" value={promises.shippingBody} onChange={(shippingBody) => set("promises", { shippingBody })} max={200} rows={2} disabled={locked} />
          <TextPair id="promise-returns" label="Under the returns heading" value={promises.returnsBody} onChange={(returnsBody) => set("promises", { returnsBody })} max={200} rows={2} disabled={locked} />
          <TextPair id="promise-payment-title" label="Third card, heading" value={promises.paymentTitle} onChange={(paymentTitle) => set("promises", { paymentTitle })} max={60} disabled={locked} />
          <TextPair id="promise-payment" label="Third card, text" value={promises.paymentBody} onChange={(paymentBody) => set("promises", { paymentBody })} max={200} rows={2} disabled={locked} />
        </ContentSection>

        <ContentSection title="New arrivals" note="A grid of the newest products." enabled={draft.newArrivals.enabled} onToggle={(enabled) => set("newArrivals", { enabled })} disabled={locked}>
          <ListingFields id="new-arrivals" value={draft.newArrivals} onChange={(patch) => set("newArrivals", patch)} disabled={locked} />
        </ContentSection>

        <ContentSection title="Closing band" note="The dark band with the logo at the foot of the page." enabled={closing.enabled} onToggle={(enabled) => set("closing", { enabled })} disabled={locked}>
          <TextPair id="closing-title" label="Heading" value={closing.title} onChange={(title) => set("closing", { title })} max={120} disabled={locked} />
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <TextPair id="closing-button" label="Button" value={closing.buttonLabel} onChange={(buttonLabel) => set("closing", { buttonLabel })} max={40} disabled={locked} />
            <LinkSelect id="closing-link" label="Opens" value={closing.buttonHref} onChange={(buttonHref) => set("closing", { buttonHref })} categories={links} disabled={locked} />
          </div>
          <TextPair
            id="closing-whatsapp"
            label="WhatsApp button"
            hint="Opens a chat with the WhatsApp number under Contact us. Leave empty to hide the button."
            value={closing.whatsappLabel}
            onChange={(whatsappLabel) => set("closing", { whatsappLabel })}
            max={40}
            disabled={locked}
          />
        </ContentSection>
      </div>
    </>
  );
}
