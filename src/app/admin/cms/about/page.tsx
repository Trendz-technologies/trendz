"use client";

import { EyeOff } from "lucide-react";
import { isWritten, PageTextCard } from "@/components/admin/cms-legal-editor";
import { ContentActions, ContentSection, useContentEditor } from "@/components/admin/cms-shared";
import { PictureField, TextPair } from "@/components/admin/home-offers-fields";
import { PageHeader } from "@/components/admin/page";
import { Card, Checkbox, ErrorState, Spinner } from "@/components/ui";
import type { AboutPageContent } from "@/lib/types";

export default function AboutEditor() {
  const editor = useContentEditor<AboutPageContent>("aboutPage");
  const { draft, record, canEdit, edit } = editor;
  const locked = !canEdit;

  if (record.isError) return <ErrorState error={record.error} retry={() => void record.refetch()} />;
  if (!draft || !record.data) return <Spinner className="py-32" label="Loading the About us page" />;

  const written = isWritten(draft.body);

  return (
    <>
      <PageHeader
        title="About us"
        description="The shop's own story, at /about. While the page is shown, the store's header and footer link to it."
        actions={
          <ContentActions
            editor={editor}
            // Only a page that is shown has something to open.
            view={record.data.value.published ? { href: "/about", label: "View page" } : undefined}
            saveLabel="Save page"
            onSave={() => void editor.save(draft.published ? "About us page saved." : "About us page saved. It is hidden from the store.", draft.published)}
          />
        }
      />

      <div className="max-w-4xl space-y-6">
        <Card title="Page" actions={<span className="text-right text-xs text-ink/45">{editor.savedLabel}</span>}>
          <Checkbox label="Show on the store" checked={draft.published} disabled={locked || (!written && !draft.published)} onChange={(e) => edit({ published: e.target.checked })} />
          {!draft.published && (
            <p role="status" className="mt-2 flex items-start gap-2 rounded-xl bg-warning/10 px-3.5 py-3 text-xs leading-relaxed text-ink/75">
              <EyeOff size={14} className="mt-0.5 shrink-0 text-warning" />
              {written ? "Hidden: shoppers cannot open this page, and the header and footer do not link to it." : "Nothing is written yet. Add the text below, then show the page."}
            </p>
          )}
        </Card>

        <ContentSection title="Banner" note="The top of the page: the heading and a few lines about the shop, with a picture beside them (above them on phones).">
          <TextPair id="about-eyebrow" label="Small heading" value={draft.eyebrow} onChange={(eyebrow) => edit({ eyebrow })} max={40} disabled={locked} />
          <TextPair id="about-title" label="Heading" value={draft.title} onChange={(title) => edit({ title })} max={80} disabled={locked} />
          <TextPair id="about-intro" label="Introduction" value={draft.intro} onChange={(intro) => edit({ intro })} max={400} rows={3} disabled={locked} />
          <PictureField
            hint="Optional. A photo of the shop or of an outfit: it fills half of the banner and is cropped from the bottom to fit. Without one, the shop's logo is shown."
            imageKey={draft.imageKey}
            imageUrl={draft.imageUrl}
            onChange={(picture) => edit(picture)}
            disabled={locked}
          />
        </ContentSection>

        <PageTextCard name="About us" body={draft.body} onChange={(body) => edit({ body })} disabled={locked} />
      </div>
    </>
  );
}
