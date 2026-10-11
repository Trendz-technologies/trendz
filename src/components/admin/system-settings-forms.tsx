"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, get, useForm, type Control, type FieldErrors, type FieldValues, type UseFormSetValue } from "react-hook-form";
import { z } from "zod";
import { clsx } from "clsx";
import {
  Star,
  AlertTriangle,
  Barcode,
  Bell,
  Boxes,
  FileText,
  Percent,
  RotateCcw,
  ScanLine,
  ShoppingCart,
  Store,
  Tag,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, ConfirmDialog, Input, MoneyInput, Select, Textarea } from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { money, percent } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SettingKey = "store" | "pricing" | "shipping" | "checkout" | "returns" | "refunds" | "reviews" | "pos" | "coupons" | "invoice" | "barcodes" | "inventory" | "notifications";
export type SettingsMap = Record<SettingKey, Record<string, unknown>>;
export type StateOption = { name: string; code: string };

interface Base {
  name: string;
  label: string;
  hint?: string;
  /** Affects money, tax or invoices — flagged in the UI and confirmed on save. */
  money?: boolean;
  wide?: boolean;
}
type FieldDef =
  | (Base & { kind: "text"; maxLength?: number; placeholder?: string; upper?: boolean; mono?: boolean; inputMode?: "email" | "tel" | "numeric" })
  | (Base & { kind: "phone" })
  | (Base & { kind: "textarea"; maxLength?: number; rows?: number })
  | (Base & { kind: "switch" })
  | (Base & { kind: "int" | "decimal"; min?: number; max?: number; suffix?: string })
  | (Base & { kind: "money"; nullable?: boolean; placeholder?: string })
  | (Base & { kind: "percent"; max?: number })
  | (Base & { kind: "select"; options: { value: string; label: string }[] })
  | (Base & { kind: "multi"; options: { value: string; label: string; hint?: string }[] })
  | (Base & { kind: "emails" })
  | (Base & { kind: "state" })
  | (Base & { kind: "readonly" });

interface GroupDef {
  key: SettingKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Why this group needs an accountant's eye; enables the warning and save confirmation. */
  sensitive?: string;
  schema: z.ZodType;
  sections: { title?: string; description?: string; fields: FieldDef[] }[];
}

// ---------------------------------------------------------------------------
// Client-side validation (mirrors src/modules/settings/settings.schemas.ts in trendz-api)
// ---------------------------------------------------------------------------

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const isEmail = (v: string) => z.email().safeParse(v).success;

const int = (min: number, max?: number) => {
  let s = z.number({ error: "Enter a whole number" }).int("Enter a whole number").min(min, `Must be at least ${min}`);
  if (max !== undefined) s = s.max(max, `Must be at most ${max}`);
  return s;
};
const positive = (label = "Must be more than 0") => z.number({ error: "Enter a number" }).positive(label);
const bps = z.number({ error: "Enter a percentage" }).int().min(0, "Cannot be negative").max(10_000, "Cannot exceed 100%");
const emailList = z.array(z.string()).superRefine((list, ctx) => {
  const bad = list.filter((e) => !isEmail(e));
  if (bad.length) ctx.addIssue({ code: "custom", message: `Not valid email address${bad.length > 1 ? "es" : ""}: ${bad.join(", ")}` });
});

const schemas = {
  store: z
    .object({
      displayName: z.string().trim().min(1, "Required").max(100, "At most 100 characters"),
      legalName: z.string().trim().max(200, "At most 200 characters"),
      gstin: z
        .string()
        .trim()
        .max(15)
        .refine((v) => v === "" || GSTIN.test(v), "Enter a valid 15-character GSTIN"),
      email: z
        .string()
        .trim()
        .max(200)
        .refine((v) => v === "" || isEmail(v), "Enter a valid email address"),
      phone: z.string().trim().max(20, "At most 20 characters"),
      address: z.object({
        line1: z.string().trim().max(200),
        line2: z.string().trim().max(200),
        city: z.string().trim().max(100),
        state: z.string().trim().max(100),
        stateCode: z.string().regex(/^\d{2}$/, "Select the registered state"),
        postalCode: z
          .string()
          .trim()
          .max(12)
          .refine((v) => v === "" || /^[1-9]\d{5}$/.test(v), "Enter a valid 6-digit PIN code"),
        country: z.string().length(2),
      }),
      currency: z.literal("INR"),
    })
    .superRefine((s, ctx) => {
      // The first two digits of a GSTIN are the registration state's code.
      if (s.gstin && GSTIN.test(s.gstin) && s.gstin.slice(0, 2) !== s.address.stateCode) {
        ctx.addIssue({ code: "custom", path: ["gstin"], message: `This GSTIN is registered in state ${s.gstin.slice(0, 2)}, but the store address is in state ${s.address.stateCode}` });
      }
    }),
  pricing: z.object({ pricesIncludeTax: z.boolean(), roundGrandTotal: z.boolean() }),
  shipping: z.object({
    mode: z.enum(["FLAT", "PROVIDER_RATES"]),
    flatRate: int(0),
    freeShippingThreshold: int(0).nullable(),
    chargeTaxable: z.boolean(),
    taxRateBps: bps,
    defaultWeightGrams: int(1),
    defaultLengthCm: positive(),
    defaultWidthCm: positive(),
    defaultHeightCm: positive(),
  }),
  checkout: z.object({ reservationTtlMinutes: int(5, 24 * 60), allowGuestCheckout: z.boolean(), maxQuantityPerLine: int(1, 1000) }),
  returns: z.object({ windowDays: int(0, 365), autoRestockGood: z.boolean() }),
  refunds: z.object({ allowPartial: z.boolean() }),
  reviews: z.object({ enabled: z.boolean(), requireApproval: z.boolean() }),
  pos: z.object({
    maxManualDiscountBps: bps,
    enabledPaymentMethods: z.array(z.enum(["CASH", "UPI_MANUAL", "CARD_MANUAL", "RAZORPAY"])).min(1, "Enable at least one payment method"),
  }),
  coupons: z.object({ allowWithAutomaticDiscounts: z.boolean() }),
  invoice: z.object({
    prefix: z.string().regex(/^[A-Z0-9]{1,4}$/, "1–4 capital letters or digits"),
    creditNotePrefix: z.string().regex(/^[A-Z0-9]{1,4}$/, "1–4 capital letters or digits"),
    footerNote: z.string().max(500, "At most 500 characters"),
    terms: z.string().max(2000, "At most 2000 characters"),
  }),
  barcodes: z.object({ ean13Prefix: z.string().regex(/^\d{3,10}$/, "3–10 digits") }),
  inventory: z.object({ defaultLowStockThreshold: int(0), lowStockAlertEmails: emailList }),
  notifications: z.object({ emailEnabled: z.boolean(), smsEnabled: z.boolean(), adminEmails: emailList }),
} satisfies Record<SettingKey, z.ZodType>;

// ---------------------------------------------------------------------------
// Group definitions
// ---------------------------------------------------------------------------

export const SETTING_GROUPS: GroupDef[] = [
  {
    key: "store",
    label: "Store",
    description: "Business identity, GST registration and registered address.",
    icon: Store,
    sensitive: "The GSTIN and registered state decide how GST is split on every order (CGST + SGST within the state, IGST otherwise) and what is printed on tax invoices.",
    schema: schemas.store,
    sections: [
      {
        title: "Identity",
        fields: [
          { kind: "text", name: "displayName", label: "Store name", hint: "Shown on the storefront, emails and receipts", maxLength: 100 },
          { kind: "text", name: "legalName", label: "Legal name", hint: "Printed on tax invoices", maxLength: 200 },
          { kind: "text", name: "gstin", label: "GSTIN", hint: "15 characters. Leave empty if the business is not GST-registered.", upper: true, mono: true, maxLength: 15, money: true },
          { kind: "readonly", name: "currency", label: "Currency", hint: "All prices are in Indian rupees" },
          { kind: "text", name: "email", label: "Support email", inputMode: "email", maxLength: 200 },
          { kind: "phone", name: "phone", label: "Support phone" },
        ],
      },
      {
        title: "Registered address",
        description: "The address on your GST registration. It is printed on invoices and decides intra- vs inter-state supply.",
        fields: [
          { kind: "text", name: "address.line1", label: "Address line 1", maxLength: 200, wide: true },
          { kind: "text", name: "address.line2", label: "Address line 2", maxLength: 200, wide: true },
          { kind: "text", name: "address.city", label: "City", maxLength: 100 },
          { kind: "state", name: "address.stateCode", label: "State", hint: "GST state code is set automatically", money: true },
          { kind: "text", name: "address.postalCode", label: "PIN code", inputMode: "numeric", maxLength: 6 },
          { kind: "readonly", name: "address.country", label: "Country" },
        ],
      },
    ],
  },
  {
    key: "pricing",
    label: "Pricing & tax",
    description: "How catalogue prices relate to GST and how totals are rounded.",
    icon: Percent,
    sensitive: "Changes how prices and GST are calculated on every new order and POS bill.",
    schema: schemas.pricing,
    sections: [
      {
        fields: [
          {
            kind: "switch",
            name: "pricesIncludeTax",
            label: "Prices include GST",
            hint: "On: catalogue prices are GST-inclusive and tax is backed out of them. Off: GST is added on top of the price at checkout.",
            money: true,
          },
          { kind: "switch", name: "roundGrandTotal", label: "Round order totals to the nearest rupee", hint: "The difference is shown as round-off on invoices.", money: true },
        ],
      },
    ],
  },
  {
    key: "shipping",
    label: "Shipping",
    description: "Shipping fees, free-shipping threshold and default parcel size.",
    icon: Truck,
    sensitive: "Shipping fees and the GST charged on them apply to every new online order.",
    schema: schemas.shipping,
    sections: [
      {
        title: "Rates",
        fields: [
          {
            kind: "select",
            name: "mode",
            label: "How shipping is charged",
            options: [
              { value: "FLAT", label: "Flat rate per order" },
              { value: "PROVIDER_RATES", label: "Courier provider rates" },
            ],
          },
          { kind: "money", name: "flatRate", label: "Flat rate", hint: "Charged per order in flat-rate mode", money: true },
          { kind: "money", name: "freeShippingThreshold", label: "Free shipping from", nullable: true, placeholder: "No free shipping", hint: "Orders at or above this amount ship free. Leave empty to never offer free shipping.", money: true },
        ],
      },
      {
        title: "GST on shipping",
        fields: [
          { kind: "switch", name: "chargeTaxable", label: "Charge GST on shipping fees", money: true },
          { kind: "percent", name: "taxRateBps", label: "GST rate on shipping", hint: "Applied when shipping is taxable, e.g. 18", money: true },
        ],
      },
      {
        title: "Default parcel",
        description: "Used for courier rates and labels when a product has no weight or dimensions.",
        fields: [
          { kind: "int", name: "defaultWeightGrams", label: "Weight", suffix: "g", min: 1 },
          { kind: "decimal", name: "defaultLengthCm", label: "Length", suffix: "cm", min: 0 },
          { kind: "decimal", name: "defaultWidthCm", label: "Width", suffix: "cm", min: 0 },
          { kind: "decimal", name: "defaultHeightCm", label: "Height", suffix: "cm", min: 0 },
        ],
      },
    ],
  },
  {
    key: "checkout",
    label: "Checkout",
    description: "Stock reservations, guest checkout and order limits.",
    icon: ShoppingCart,
    schema: schemas.checkout,
    sections: [
      {
        fields: [
          { kind: "int", name: "reservationTtlMinutes", label: "Hold stock during payment for", suffix: "minutes", min: 5, max: 1440, hint: "Unpaid checkouts release their stock after this time (5–1440)." },
          { kind: "int", name: "maxQuantityPerLine", label: "Maximum quantity per item", min: 1, max: 1000, hint: "Per cart line (1–1000)." },
          { kind: "switch", name: "allowGuestCheckout", label: "Allow guest checkout", hint: "Customers can order without creating an account." },
        ],
      },
    ],
  },
  {
    key: "returns",
    label: "Returns",
    description: "Return window and restocking.",
    icon: RotateCcw,
    schema: schemas.returns,
    sections: [
      {
        fields: [
          { kind: "int", name: "windowDays", label: "Return window", suffix: "days", min: 0, max: 365, hint: "Days after delivery a customer can request a return. 0 turns returns off." },
          { kind: "switch", name: "autoRestockGood", label: "Restock items returned in good condition", hint: "Off: good returns wait in a separate “returned” bucket until someone restocks them." },
        ],
      },
    ],
  },
  {
    key: "refunds",
    label: "Refunds",
    description: "What kinds of refunds staff can issue.",
    icon: Undo2,
    sensitive: "Controls whether part of an order's payment can be refunded.",
    schema: schemas.refunds,
    sections: [{ fields: [{ kind: "switch", name: "allowPartial", label: "Allow partial refunds", hint: "Refund less than the full paid amount, e.g. for one item.", money: true }] }],
  },
  {
    key: "reviews",
    label: "Reviews",
    description: "Ratings and reviews from customers who have received their order.",
    icon: Star,
    schema: schemas.reviews,
    sections: [
      {
        fields: [
          { kind: "switch", name: "enabled", label: "Let customers review products", hint: "A customer can rate a product once an order with it has been delivered. Off: reviews are neither taken nor shown." },
          { kind: "switch", name: "requireApproval", label: "Approve reviews before they are shown", hint: "On: a review appears on the product page only after staff publish it in Admin → Reviews. Off: it appears as soon as the customer sends it." },
        ],
      },
    ],
  },
  {
    key: "pos",
    label: "Billing / POS",
    description: "Payment methods and discount limits at the counter.",
    icon: ScanLine,
    sensitive: "Limits the manual discounts cashiers can give and the ways they can take payment.",
    schema: schemas.pos,
    sections: [
      {
        fields: [
          { kind: "percent", name: "maxManualDiscountBps", label: "Maximum manual discount", hint: "Largest discount a cashier with the manual discount permission can apply.", money: true },
          {
            kind: "multi",
            name: "enabledPaymentMethods",
            label: "Payment methods",
            wide: true,
            options: [
              { value: "CASH", label: "Cash" },
              { value: "UPI_MANUAL", label: "UPI (customer scans, cashier confirms)" },
              { value: "CARD_MANUAL", label: "Card on an external terminal" },
              { value: "RAZORPAY", label: "Razorpay payment link / QR", hint: "Confirmed automatically by the gateway" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "coupons",
    label: "Coupons",
    description: "How coupons combine with automatic discounts.",
    icon: Tag,
    sensitive: "Changes how discounts stack on new orders.",
    schema: schemas.coupons,
    sections: [
      {
        fields: [
          { kind: "switch", name: "allowWithAutomaticDiscounts", label: "Allow coupons on already-discounted items", hint: "Off: coupons skip items that have an automatic discount.", money: true },
        ],
      },
    ],
  },
  {
    key: "invoice",
    label: "Invoices",
    description: "Invoice numbering and the text printed on invoices.",
    icon: FileText,
    sensitive: "GST invoice and credit-note numbers must be unique and sequential within a financial year. Change prefixes only at the start of a financial year.",
    schema: schemas.invoice,
    sections: [
      {
        fields: [
          { kind: "text", name: "prefix", label: "Invoice prefix", upper: true, mono: true, maxLength: 4, hint: "1–4 letters or digits, e.g. INV → INV/2627/000123", money: true },
          { kind: "text", name: "creditNotePrefix", label: "Credit note prefix", upper: true, mono: true, maxLength: 4, hint: "1–4 letters or digits", money: true },
          { kind: "textarea", name: "footerNote", label: "Footer note", maxLength: 500, rows: 2, wide: true },
          { kind: "textarea", name: "terms", label: "Terms and conditions", maxLength: 2000, rows: 5, wide: true },
        ],
      },
    ],
  },
  {
    key: "barcodes",
    label: "Barcodes",
    description: "Prefix for generated EAN-13 barcodes.",
    icon: Barcode,
    schema: schemas.barcodes,
    sections: [
      {
        fields: [
          {
            kind: "text",
            name: "ean13Prefix",
            label: "EAN-13 prefix",
            mono: true,
            inputMode: "numeric",
            maxLength: 10,
            hint: "3–10 digits. 200–299 is reserved for in-store use; use your GS1 company prefix if you have one. Existing barcodes are not changed.",
          },
        ],
      },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Low-stock threshold and alert recipients.",
    icon: Boxes,
    schema: schemas.inventory,
    sections: [
      {
        fields: [
          { kind: "int", name: "defaultLowStockThreshold", label: "Default low-stock threshold", min: 0, suffix: "units", hint: "Used when a product or variant has no threshold of its own." },
          { kind: "emails", name: "lowStockAlertEmails", label: "Low-stock alert emails", hint: "One per line or comma-separated. Admin alert emails also receive these.", wide: true },
        ],
      },
    ],
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Email and SMS delivery, and who receives admin alerts.",
    icon: Bell,
    schema: schemas.notifications,
    sections: [
      {
        fields: [
          { kind: "switch", name: "emailEnabled", label: "Send email notifications", hint: "Order, shipping and account updates. Sign-in codes and password resets are always sent." },
          { kind: "switch", name: "smsEnabled", label: "Send SMS notifications", hint: "Order and delivery updates." },
          { kind: "emails", name: "adminEmails", label: "Admin alert emails", hint: "New orders, payment issues and stock alerts. One per line or comma-separated.", wide: true },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Small controls
// ---------------------------------------------------------------------------

export function MoneyMark() {
  return (
    <span title="Affects money, tax or invoices" className="ml-1.5 inline-flex items-center rounded-full bg-warning/10 px-1.5 py-px align-middle text-[10px] font-semibold text-warning">
      ₹ / tax
    </span>
  );
}

export function AccountantNotice({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] px-4 py-3 text-sm">
      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warning" />
      <div>
        <p className="font-semibold text-ink">Affects money or tax — confirm with your accountant before changing.</p>
        <p className="mt-0.5 text-ink/65">{children}</p>
      </div>
    </div>
  );
}

function Switch({ id, checked, onChange, labelledBy, describedBy }: { id: string; checked: boolean; onChange: (v: boolean) => void; labelledBy: string; describedBy?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-ink" : "bg-black/15",
      )}
    >
      <span className={clsx("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** Email list kept as free text while typing; the form value is the parsed array. */
const parseEmails = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

function EmailListInput({ id, value, onChange, onBlur, invalid, describedBy }: { id: string; value: string[]; onChange: (v: string[]) => void; onBlur: () => void; invalid?: boolean; describedBy?: string }) {
  const [text, setText] = useState(() => (value ?? []).join("\n"));
  const [seen, setSeen] = useState(value);
  // The form was reset (discard / save): show the new list unless it is what the text already says.
  if (value !== seen) {
    setSeen(value);
    if (JSON.stringify(parseEmails(text)) !== JSON.stringify(value ?? [])) setText((value ?? []).join("\n"));
  }
  return (
    <Textarea
      id={id}
      rows={3}
      className="min-h-0 font-mono text-[13px]"
      placeholder="ops@example.com"
      value={text}
      invalid={invalid}
      aria-describedby={describedBy}
      onBlur={onBlur}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseEmails(e.target.value));
      }}
    />
  );
}

const numberOrNull = (v: string) => (v === "" ? null : Number(v));

function displayValue(def: FieldDef, v: unknown, states: StateOption[]): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (def.kind) {
    case "money":
      return money(Number(v));
    case "percent":
      return percent(Number(v));
    case "switch":
      return v ? "On" : "Off";
    case "multi":
      return (v as string[]).map((x) => def.options.find((o) => o.value === x)?.label ?? x).join(", ") || "None";
    case "emails":
      return (v as string[]).join(", ") || "None";
    case "state":
      return states.find((s) => s.code === v)?.name ?? String(v);
    case "select":
      return def.options.find((o) => o.value === v)?.label ?? String(v);
    default:
      return `${String(v)}${"suffix" in def && def.suffix ? ` ${def.suffix}` : ""}`;
  }
}

// ---------------------------------------------------------------------------
// One field
// ---------------------------------------------------------------------------

function SettingControl({ def, control, setValue, errors, states }: { def: FieldDef; control: Control<FieldValues>; setValue: UseFormSetValue<FieldValues>; errors: FieldErrors<FieldValues>; states: StateOption[] }) {
  const id = `setting-${def.name.replace(/\./g, "-")}`;
  const error = (get(errors, def.name) as { message?: string } | undefined)?.message;
  const hintId = `${id}-hint`;
  const describedBy = error || def.hint ? hintId : undefined;
  const label = (
    <>
      {def.label}
      {def.money && <MoneyMark />}
    </>
  );
  const message = error ? (
    <p id={hintId} className="mt-1 text-xs text-danger">
      {error}
    </p>
  ) : def.hint ? (
    <p id={hintId} className="mt-1 text-xs text-ink/50">
      {def.hint}
    </p>
  ) : null;

  if (def.kind === "switch") {
    return (
      <div className="flex items-start justify-between gap-6 rounded-xl border border-black/[0.06] px-4 py-3 sm:col-span-2">
        <div className="min-w-0">
          <p id={`${id}-label`} className="text-sm font-medium">
            {label}
          </p>
          {message}
        </div>
        <Controller control={control} name={def.name} render={({ field }) => <Switch id={id} checked={!!field.value} onChange={field.onChange} labelledBy={`${id}-label`} describedBy={describedBy} />} />
      </div>
    );
  }

  return (
    <div className={clsx((def.wide || def.kind === "textarea" || def.kind === "multi" || def.kind === "emails") && "sm:col-span-2")}>
      {def.kind === "multi" ? (
        <p className="label">{label}</p>
      ) : (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <Controller
        control={control}
        name={def.name}
        render={({ field }) => {
          const common = { id, onBlur: field.onBlur, invalid: !!error, "aria-describedby": describedBy };
          switch (def.kind) {
            case "text":
              return (
                <Input
                  {...common}
                  value={(field.value as string) ?? ""}
                  maxLength={def.maxLength}
                  placeholder={def.placeholder}
                  inputMode={def.inputMode}
                  className={clsx(def.mono && "font-mono", def.upper && "uppercase")}
                  onChange={(e) => field.onChange(def.upper ? e.target.value.toUpperCase() : e.target.value)}
                />
              );
            case "phone":
              return <PhoneInput {...common} value={(field.value as string) ?? ""} onChange={field.onChange} />;
            case "textarea":
              return <Textarea {...common} rows={def.rows ?? 3} className="min-h-0" maxLength={def.maxLength} value={(field.value as string) ?? ""} onChange={(e) => field.onChange(e.target.value)} />;
            case "int":
            case "decimal":
              return (
                <div className="relative">
                  <Input
                    {...common}
                    type="number"
                    inputMode={def.kind === "int" ? "numeric" : "decimal"}
                    step={def.kind === "int" ? 1 : 0.1}
                    min={def.min}
                    max={def.max}
                    className={def.suffix ? "pr-16" : undefined}
                    value={field.value == null || Number.isNaN(field.value) ? "" : String(field.value)}
                    onChange={(e) => field.onChange(numberOrNull(e.target.value))}
                  />
                  {def.suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink/40">{def.suffix}</span>}
                </div>
              );
            case "money":
              return <MoneyInput {...common} value={field.value as number | null} placeholder={def.placeholder} onChange={(p) => field.onChange(p)} />;
            case "percent":
              return (
                <div className="relative">
                  <Input
                    {...common}
                    type="number"
                    inputMode="decimal"
                    step={0.01}
                    min={0}
                    max={100}
                    className="pr-9"
                    value={field.value == null ? "" : String(Number(field.value) / 100)}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : Math.round(Number(e.target.value) * 100))}
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink/40">%</span>
                </div>
              );
            case "select":
              return (
                <Select {...common} value={(field.value as string) ?? ""} onChange={(e) => field.onChange(e.target.value)}>
                  {def.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              );
            case "multi": {
              const selected = (field.value as string[]) ?? [];
              return (
                <div role="group" aria-label={def.label} aria-describedby={describedBy} className="grid gap-2 sm:grid-cols-2">
                  {def.options.map((o) => {
                    const checked = selected.includes(o.value);
                    return (
                      <label key={o.value} className={clsx("flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition", checked ? "border-ink/35 bg-offwhite" : "border-black/10 hover:border-black/20")}>
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-accent"
                          checked={checked}
                          onChange={() => field.onChange(checked ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
                        />
                        <span>
                          <span className="block font-medium">{o.label}</span>
                          {o.hint && <span className="block text-xs text-ink/50">{o.hint}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            }
            case "emails":
              return <EmailListInput id={id} value={field.value as string[]} onChange={field.onChange} onBlur={field.onBlur} invalid={!!error} describedBy={describedBy} />;
            case "state":
              return (
                <Select
                  {...common}
                  value={(field.value as string) ?? ""}
                  onChange={(e) => {
                    const st = states.find((s) => s.code === e.target.value);
                    field.onChange(e.target.value);
                    if (st) setValue("address.state", st.name, { shouldDirty: true });
                  }}
                >
                  {!states.some((s) => s.code === field.value) && <option value={(field.value as string) ?? ""}>{field.value ? `State code ${field.value}` : "Select a state"}</option>}
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </Select>
              );
            case "readonly":
              return <Input id={id} value={String(field.value ?? "")} readOnly disabled />;
          }
        }}
      />
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One settings group
// ---------------------------------------------------------------------------

export function SettingsGroupForm({ group, value, states, canEdit, onDirtyChange }: { group: GroupDef; value: Record<string, unknown>; states: StateOption[]; canEdit: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FieldValues>({ defaultValues: value });

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const fields = group.sections.flatMap((s) => s.fields);
  const fieldFor = (path: string) => (path === "address.state" ? "address.stateCode" : fields.find((f) => path === f.name || path.startsWith(`${f.name}.`))?.name);

  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const saved = await api.put<Record<string, unknown>>(`/settings/${group.key}`, body);
      qc.setQueryData<SettingsMap>(["admin", "settings"], (s) => (s ? { ...s, [group.key]: saved } : s));
      void qc.invalidateQueries({ queryKey: ["store-config"] });
      reset(saved);
      toast(`${group.label} settings saved`);
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) {
        const other: string[] = [];
        for (const e of err.errors) {
          const f = fieldFor(e.path);
          if (f) setError(f, { message: e.message });
          else other.push(`${e.path}: ${e.message}`);
        }
        if (other.length) setError("root", { message: other.join(" · ") });
      } else setError("root", { message: errorMessage(err) });
    } finally {
      setSaving(false);
      setPending(null);
    }
  };

  const submit = handleSubmit((raw) => {
    clearErrors();
    const values = { ...raw };
    // Keep the state name in step with the GST state code.
    if (group.key === "store") {
      const address = { ...(values.address as Record<string, unknown>) };
      const st = states.find((s) => s.code === address.stateCode);
      if (st) address.state = st.name;
      values.address = address;
    }
    const parsed = group.schema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) setError(fieldFor(issue.path.map(String).join(".")) ?? "root", { message: issue.message });
      return;
    }
    const body = { ...values, ...(parsed.data as Record<string, unknown>) };
    if (group.sensitive) setPending(body);
    else void save(body);
  });

  const changes = pending
    ? fields
        .filter((f) => f.kind !== "readonly" && JSON.stringify(get(pending, f.name)) !== JSON.stringify(get(value, f.name)))
        .map((f) => ({ label: f.label, from: displayValue(f, get(value, f.name), states), to: displayValue(f, get(pending, f.name), states), money: f.money }))
    : [];

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {group.sensitive && <AccountantNotice>{group.sensitive}</AccountantNotice>}
      <fieldset disabled={!canEdit} className="space-y-6">
        {group.sections.map((s, i) => (
          <Card
            key={s.title ?? i}
            title={
              s.title ? (
                <div>
                  <h2 className="text-sm font-semibold">{s.title}</h2>
                  {s.description && <p className="mt-0.5 text-xs text-ink/50">{s.description}</p>}
                </div>
              ) : undefined
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {s.fields.map((f) => (
                <SettingControl key={f.name} def={f} control={control} setValue={setValue} errors={errors} states={states} />
              ))}
            </div>
          </Card>
        ))}
      </fieldset>
      {errors.root && (
        <p role="alert" className="rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
          {errors.root.message}
        </p>
      )}
      {canEdit ? (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-2xl bg-offwhite/90 px-1 py-3 backdrop-blur">
          {isDirty && <span className="mr-auto text-xs font-medium text-warning">Unsaved changes</span>}
          {isDirty && (
            <Button variant="ghost" onClick={() => reset()}>
              Discard
            </Button>
          )}
          <Button type="submit" loading={saving} disabled={!isDirty}>
            Save {group.label.toLowerCase()} settings
          </Button>
        </div>
      ) : (
        <p className="text-xs text-ink/50">You can view these settings. Changing them requires the settings.write permission.</p>
      )}
      <ConfirmDialog
        open={!!pending}
        title={`Save ${group.label.toLowerCase()} settings?`}
        confirmLabel="Yes, save changes"
        loading={saving}
        onConfirm={() => pending && void save(pending)}
        onClose={() => setPending(null)}
        body={
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-warning">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>These settings affect money or tax on new orders. Make sure your accountant has confirmed them.</span>
            </p>
            {changes.length > 0 && (
              <ul className="space-y-1.5">
                {changes.map((c) => (
                  <li key={c.label}>
                    <span className="font-medium text-ink">{c.label}</span>
                    {c.money && <MoneyMark />}
                    <span className="block text-xs">
                      <span className="line-through decoration-ink/30">{c.from}</span> → <span className="font-semibold text-ink">{c.to}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
      />
    </form>
  );
}

