import { createElement, Fragment, type ReactNode } from "react";
import { ta } from "./ta";
import { statuses, terms } from "./ta/data";

/**
 * Storefront languages: English (the source text) and Tamil.
 *
 * The English sentence is the key. `t("Add to bag")` returns it unchanged in
 * English and looks it up in the Tamil dictionary (lib/i18n/ta) otherwise, so
 * the code stays readable and a missing key is a type error, not a blank label.
 * Only the storefront has a language switch; the admin and POS never mount the
 * provider and therefore always get English.
 */
export const LOCALES = ["en", "ta"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "trendz_lang";
/** Each language's own name, as shown on the switch. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ta: "தமிழ்" };
/** BCP 47 tags for the `lang` attribute and Intl formatters. */
export const LOCALE_TAGS: Record<Locale, string> = { en: "en-IN", ta: "ta-IN" };

export const toLocale = (value: string | null | undefined): Locale => (value === "ta" ? "ta" : "en");

/** Every sentence that has a Tamil translation. */
export type Message = keyof typeof ta;
type Vars = Record<string, string | number>;

/** Marks a string defined outside a component (nav items, schema messages) so it is checked like `t()`. */
export const msg = <K extends Message>(key: K): K => key;

export interface I18n {
  locale: Locale;
  /** Translates a sentence; `{name}` placeholders are filled from `vars`. */
  t: (message: Message, vars?: Vars) => string;
  /** Singular / plural: `tn(count, "{n} item", "{n} items")`. `{n}` is the count. */
  tn: (n: number, one: Message, many: Message, vars?: Vars) => string;
  /** Like `t`, but placeholders can be elements: `tr("Add {amount} more", { amount: <strong>…</strong> })`. */
  tr: (message: Message, vars: Record<string, ReactNode>) => ReactNode;
  /** Text that is only known at run time (category names, colours, form errors). Unknown text is returned as it is. */
  tx: {
    (text: string): string;
    (text: string | null | undefined): string | undefined;
  };
  /** Label of a status code from the API: `ts("OUT_FOR_DELIVERY")` → "Out for delivery". */
  ts: (code: string) => string;
}

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match)) : text);

const fillNodes = (text: string, vars: Record<string, ReactNode>): ReactNode =>
  text.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return createElement(Fragment, { key: i }, key && key in vars ? vars[key] : part);
  });

const humanize = (code: string) => code.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

// Run-time text is arbitrary (typed in the admin), so only own entries count: "constructor" must not find Object's.
// Catalogue terms win over interface sentences: a size called "Free" is a size, not a price.
const runtime: Record<string, string> = { ...ta, ...terms };
const own = (entries: Record<string, string>, key: string): string | undefined => (Object.hasOwn(entries, key) ? entries[key] : undefined);

function build(locale: Locale): I18n {
  const tamil = locale === "ta";
  const text = (message: Message): string => (tamil ? ta[message] : message);
  const t: I18n["t"] = (message, vars) => fill(text(message), vars);
  return {
    locale,
    t,
    tn: (n, one, many, vars) => t(n === 1 ? one : many, { n, ...vars }),
    tr: (message, vars) => fillNodes(text(message), vars),
    tx: ((value: string | null | undefined) => (value == null ? undefined : tamil ? (own(runtime, value) ?? value) : value)) as I18n["tx"],
    ts: (code) => (tamil ? (own(statuses, code) ?? humanize(code)) : humanize(code)),
  };
}

const translators: Record<Locale, I18n> = { en: build("en"), ta: build("ta") };

export const i18n = (locale: Locale): I18n => translators[locale];
