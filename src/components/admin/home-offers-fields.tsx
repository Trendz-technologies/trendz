"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES } from "@/lib/i18n";
import type { CategoryNode, LocalizedText, OfferCard } from "@/lib/types";
import { IMAGE_RULES, IMAGE_TYPES, uploadSimpleImage } from "@/lib/upload";

/** One piece of storefront text, typed once per language. An empty language falls back to the other on the store. */
export function TextPair({
  id,
  label,
  hint,
  value,
  onChange,
  max,
  rows,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  max: number;
  /** Set for a multi-line field. */
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {LOCALES.map((l) => {
          const shared = {
            id: `${id}-${l}`,
            lang: LOCALE_TAGS[l],
            "aria-label": `${label} (${LOCALE_NAMES[l]})`,
            placeholder: LOCALE_NAMES[l],
            value: value[l],
            maxLength: max,
            disabled,
          };
          return rows ? (
            <Textarea key={l} {...shared} rows={rows} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          ) : (
            <Input key={l} {...shared} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          );
        })}
      </div>
      {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}

const FIXED_LINKS = [
  { href: "", label: "No link" },
  { href: "/products", label: "All products" },
  { href: "/products?sort=newest", label: "New arrivals" },
  { href: "/offers", label: "Offers & coupons page" },
  { href: "/contact", label: "Contact page" },
];

/** Where a card or banner leads: a page of this shop, chosen from a list. */
export function LinkSelect({ id, label, value, onChange, categories, disabled }: { id: string; label: string; value: string; onChange: (href: string) => void; categories: CategoryNode[]; disabled?: boolean }) {
  const collections = categories.flatMap((c) => [c, ...c.children]).map((c) => ({ href: `/category/${c.slug}`, label: `Collection: ${c.name}` }));
  const options = [...FIXED_LINKS, ...collections];
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.href} value={o.href}>
            {o.label}
          </option>
        ))}
        {/* A saved path that is no longer in the list (a collection that was renamed or removed). */}
        {!options.some((o) => o.href === value) && <option value={value}>{value}</option>}
      </Select>
    </Field>
  );
}

/** An optional picture, sent to storage straight from the browser; the form keeps its storage key. */
export function PictureField({
  label = "Picture",
  hint,
  logo,
  imageKey,
  imageUrl,
  onChange,
  disabled,
}: {
  label?: string;
  hint?: string;
  /** Preview it the way the store shows a logo: whole, on a dark tile (a photo is cropped to a square instead). */
  logo?: boolean;
  imageKey: string | null;
  imageUrl: string | null;
  onChange: (picture: { imageKey: string | null; imageUrl: string | null }) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadSimpleImage("content", file);
      onChange({ imageKey: r.key, imageUrl: r.publicUrl });
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={label} hint={[hint, `${IMAGE_RULES}.`].filter(Boolean).join(" ")}>
      <div className="flex flex-wrap items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className={logo ? "h-16 w-24 rounded-xl bg-night object-contain p-1.5" : "h-16 w-16 rounded-xl bg-offwhite object-cover"} />
        ) : (
          <span className={logo ? "h-16 w-24 rounded-xl bg-night" : "h-16 w-16 rounded-xl bg-offwhite"} />
        )}
        <label className={`inline-flex items-center gap-2 rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold ${disabled ? "opacity-50" : "cursor-pointer hover:bg-black/[0.03]"}`}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {uploading ? "Uploading…" : imageKey ? "Change" : "Upload"}
          <input
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void onFile(file);
            }}
          />
        </label>
        {imageKey && !disabled && (
          <button type="button" onClick={() => onChange({ imageKey: null, imageUrl: null })} className="text-xs text-ink/50 underline">
            Remove
          </button>
        )}
      </div>
    </Field>
  );
}

const iconButton = "grid h-8 w-8 place-items-center rounded-full text-ink/55 transition hover:bg-black/5 hover:text-ink disabled:opacity-30";

/** One offer card: its text, price, link and optional picture, with controls to reorder or remove it. */
export function OfferCardEditor({
  index,
  count,
  card,
  onChange,
  onMove,
  onRemove,
  categories,
  disabled,
}: {
  index: number;
  count: number;
  card: OfferCard;
  onChange: (card: OfferCard) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  categories: CategoryNode[];
  disabled?: boolean;
}) {
  const id = `offer-${index}`;
  const set = (patch: Partial<OfferCard>) => onChange({ ...card, ...patch });

  return (
    <fieldset className="space-y-4 rounded-2xl border border-black/[0.08] p-4">
      <legend className="sr-only">Offer card {index + 1}</legend>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Card {index + 1}</p>
        <div className="flex items-center">
          <button type="button" className={iconButton} aria-label={`Move card ${index + 1} up`} disabled={disabled || index === 0} onClick={() => onMove(-1)}>
            <ArrowUp size={15} />
          </button>
          <button type="button" className={iconButton} aria-label={`Move card ${index + 1} down`} disabled={disabled || index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown size={15} />
          </button>
          <button type="button" className={`${iconButton} hover:text-danger`} aria-label={`Remove card ${index + 1}`} disabled={disabled} onClick={onRemove}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <TextPair id={`${id}-tag`} label="Ribbon" hint="The small gold label at the top, e.g. “Opening offer”." value={card.tag} onChange={(tag) => set({ tag })} max={40} disabled={disabled} />
      <TextPair id={`${id}-title`} label="Title" value={card.title} onChange={(title) => set({ title })} max={60} disabled={disabled} />
      <TextPair id={`${id}-caption`} label="Line above the price" hint="e.g. “4 tops for”." value={card.caption} onChange={(caption) => set({ caption })} max={80} disabled={disabled} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price" htmlFor={`${id}-price`} hint="Leave empty to show no price.">
          <MoneyInput id={`${id}-price`} value={card.price} onChange={(price) => set({ price })} disabled={disabled} />
        </Field>
        <LinkSelect id={`${id}-link`} label="Opens" value={card.href} onChange={(href) => set({ href })} categories={categories} disabled={disabled} />
      </div>

      <PictureField hint="Optional. Shown on the right side of the card; a tall photo works best." imageKey={card.imageKey} imageUrl={card.imageUrl} onChange={set} disabled={disabled} />
    </fieldset>
  );
}
