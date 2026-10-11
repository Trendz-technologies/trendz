"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";
import { Card, Checkbox, ErrorState, Spinner, Tabs } from "@/components/ui";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES, type Locale } from "@/lib/i18n";
import { plainText } from "@/lib/rich-text";
import type { LegalPageContent, LocalizedText, PageSlug } from "@/lib/types";
import { ContentActions, useContentEditor } from "./cms-shared";
import { TextPair } from "./home-offers-fields";
import { PageHeader } from "./page";

// The API's limit on the text of one language (MAX_PAGE_CHARS in src/modules/settings/cms.ts in trendz-api).
const MAX_CHARS = 40_000;
const LANGUAGES = LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }));

/** Whether a page has any text, in either language (an emptied editor still holds markup). */
export const isWritten = (body: LocalizedText) => LOCALES.some((l) => plainText(body[l]) !== "");

/** A page's text in the rich text editor, one language at a time. `name` is the page's name in the admin. */
export function PageTextCard({ name, body, onChange, disabled }: { name: string; body: LocalizedText; onChange: (body: LocalizedText) => void; disabled: boolean }) {
  const [language, setLanguage] = useState<Locale>("en");
  const length = plainText(body[language]).length;

  return (
    <Card title="Text" actions={<Tabs value={language} onChange={setLanguage} tabs={LANGUAGES} />}>
      {/* Remounted per language, so undo never crosses from one text into the other. */}
      <div lang={LOCALE_TAGS[language]}>
        <RichTextEditor
          key={language}
          aria-label={`${name} (${LOCALE_NAMES[language]})`}
          className="[--rte-min-height:20rem]!"
          value={body[language]}
          onChange={(html) => onChange({ ...body, [language]: html })}
          invalid={length > MAX_CHARS}
          disabled={disabled}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-ink/50">
        <p>Type here or paste from a document: headings, lists, bold and links are kept. A language left empty shows the other one.</p>
        <p className={length > MAX_CHARS ? "tabular-nums text-danger" : "tabular-nums"}>
          {length.toLocaleString("en-IN")} / {MAX_CHARS.toLocaleString("en-IN")}
        </p>
      </div>
    </Card>
  );
}

/** Editor for one of the store's legal pages (Admin → CMS → Terms & Conditions, Privacy Policy). `name` is the page's name in the admin. */
export function LegalPageEditor({ slug, name }: { slug: PageSlug; name: string }) {
  const editor = useContentEditor<LegalPageContent>(`${slug}Page`);
  const { draft, record, canEdit, edit } = editor;
  const locked = !canEdit;

  if (record.isError) return <ErrorState error={record.error} retry={() => void record.refetch()} />;
  if (!draft || !record.data) return <Spinner className="py-32" label={`Loading the ${name} page`} />;

  const written = isWritten(draft.body);

  return (
    <>
      <PageHeader
        title={name}
        description={`The store's ${name} page, at /${slug}. Once published it is linked from the footer of every page.`}
        actions={
          <ContentActions
            editor={editor}
            // Only a page that is already published has something to open.
            view={record.data.value.published ? { href: `/${slug}`, label: "View page" } : undefined}
            saveLabel={draft.published ? "Save page" : "Save draft"}
            onSave={() => void editor.save(draft.published ? `${name} saved.` : "Draft saved. Publish it to show it on the store.", draft.published)}
          />
        }
      />

      <div className="max-w-4xl space-y-6">
        <Card title="Page" actions={<span className="text-right text-xs text-ink/45">{editor.savedLabel}</span>}>
          <div className="space-y-4">
            <div>
              <Checkbox label="Published" checked={draft.published} disabled={locked || (!written && !draft.published)} onChange={(e) => edit({ published: e.target.checked })} />
              {!draft.published && (
                <p role="status" className="mt-2 flex items-start gap-2 rounded-xl bg-warning/10 px-3.5 py-3 text-xs leading-relaxed text-ink/75">
                  <EyeOff size={14} className="mt-0.5 shrink-0 text-warning" />
                  {written ? "Draft: shoppers cannot open this page until it is published." : "Nothing is written yet. Add the text below, then publish the page."}
                </p>
              )}
            </div>
            <TextPair id={`${slug}-title`} label="Title" value={draft.title} onChange={(title) => edit({ title })} max={80} disabled={locked} />
          </div>
        </Card>

        <PageTextCard name={name} body={draft.body} onChange={(body) => edit({ body })} disabled={locked} />
      </div>
    </>
  );
}
