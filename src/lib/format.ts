const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Amounts from the API are integer paise. */
export const money = (paise: number | null | undefined) => (paise == null ? "—" : inr.format(paise / 100));
export const moneyExact = (paise: number | null | undefined) => (paise == null ? "—" : inrExact.format(paise / 100));

/** Rupees typed in a form → paise for the API. */
export const toPaise = (rupees: number | string) => Math.round(Number(rupees) * 100);
export const toRupees = (paise: number | null | undefined) => (paise == null ? "" : (paise / 100).toString());

export const percent = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

const formatters = (options: Intl.DateTimeFormatOptions) => ({
  en: new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "Asia/Kolkata" }),
  ta: new Intl.DateTimeFormat("ta-IN", { ...options, timeZone: "Asia/Kolkata" }),
});
const dateFmt = formatters({ day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = formatters({ day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const timeFmt = formatters({ hour: "numeric", minute: "2-digit" });

type DateLocale = keyof typeof dateFmt;

/** Dates are English unless the storefront passes its language (`useI18n().locale`). */
export const date = (v: string | Date | null | undefined, locale: DateLocale = "en") => (v ? dateFmt[locale].format(new Date(v)) : "—");
export const dateTime = (v: string | Date | null | undefined, locale: DateLocale = "en") => (v ? dateTimeFmt[locale].format(new Date(v)) : "—");
export const time = (v: string | Date | null | undefined, locale: DateLocale = "en") => (v ? timeFmt[locale].format(new Date(v)) : "—");

export const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
