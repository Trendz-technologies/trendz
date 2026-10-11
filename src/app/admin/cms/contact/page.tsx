"use client";

import { ContentActions, ContentSection, useContentEditor } from "@/components/admin/cms-shared";
import { TextPair } from "@/components/admin/home-offers-fields";
import { PageHeader } from "@/components/admin/page";
import { ErrorState, Field, Input, Spinner } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import type { ContactDetails } from "@/lib/types";

export default function ContactEditor() {
  const editor = useContentEditor<ContactDetails>("contact");
  const { draft, record, canEdit, edit } = editor;
  const locked = !canEdit;

  if (record.isError) return <ErrorState error={record.error} retry={() => void record.refetch()} />;
  if (!draft) return <Spinner className="py-32" label="Loading the contact details" />;

  return (
    <>
      <PageHeader
        title="Contact us"
        description="How shoppers reach the shop. Shown on the store's contact page and in the footer of every page; a detail left empty is left out."
        actions={<ContentActions editor={editor} view={{ href: "/contact", label: "View contact page" }} saveLabel="Save contact details" onSave={() => void editor.save("Contact details saved.")} />}
      />

      <div className="max-w-4xl space-y-6">
        <p className="text-right text-xs text-ink/45">{editor.savedLabel}</p>

        <ContentSection title="Contact page" note="The heading and introduction at the top of the contact page.">
          <TextPair id="contact-eyebrow" label="Small heading" value={draft.eyebrow} onChange={(eyebrow) => edit({ eyebrow })} max={40} disabled={locked} />
          <TextPair id="contact-title" label="Heading" value={draft.title} onChange={(title) => edit({ title })} max={80} disabled={locked} />
          <TextPair id="contact-intro" label="Introduction" value={draft.intro} onChange={(intro) => edit({ intro })} max={400} rows={3} disabled={locked} />
        </ContentSection>

        <ContentSection title="Ways to reach you" note="These are what shoppers see. The legal name, GSTIN and address printed on invoices are under Settings.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="contact-phone" hint="Shown on the store as +91 93607 34597.">
              <PhoneInput id="contact-phone" value={draft.phone} disabled={locked} onChange={(phone) => edit({ phone })} />
            </Field>
            <Field label="WhatsApp number" htmlFor="contact-whatsapp" hint="Used for every WhatsApp button on the store.">
              <PhoneInput id="contact-whatsapp" value={draft.whatsapp} disabled={locked} onChange={(whatsapp) => edit({ whatsapp })} />
            </Field>
            <Field label="Email" htmlFor="contact-email">
              <Input id="contact-email" type="email" value={draft.email} maxLength={200} disabled={locked} onChange={(e) => edit({ email: e.target.value })} />
            </Field>
            <Field label="Instagram" htmlFor="contact-instagram" hint="Only the handle, without @.">
              <Input id="contact-instagram" value={draft.instagram} maxLength={30} disabled={locked} onChange={(e) => edit({ instagram: e.target.value })} />
            </Field>
          </div>
        </ContentSection>

        <ContentSection title="Visit the shop">
          <TextPair id="contact-address" label="Address" hint="One line of the address per line." value={draft.address} onChange={(address) => edit({ address })} max={300} rows={3} disabled={locked} />
          <TextPair id="contact-hours" label="Opening hours" hint="One line per line, e.g. “Monday to Saturday: 10 am – 9 pm”." value={draft.hours} onChange={(hours) => edit({ hours })} max={300} rows={3} disabled={locked} />
          <Field label="Directions link" htmlFor="contact-map" hint="The shop's link from Google Maps (Share → Copy link). Adds a “Get directions” button to the contact page.">
            <Input id="contact-map" type="url" placeholder="https://" value={draft.mapUrl} maxLength={500} disabled={locked} onChange={(e) => edit({ mapUrl: e.target.value })} />
          </Field>
        </ContentSection>
      </div>
    </>
  );
}
