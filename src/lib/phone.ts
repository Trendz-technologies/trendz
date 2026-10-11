import { formatPhoneNumberIntl, parsePhoneNumber, type Value } from "react-phone-number-input/input-core";
import india from "./phone-metadata.in.json";

/*
 * Phone numbers in the application are Indian: every phone field is fixed to
 * +91 (components/ui/phone-input.tsx) and a number is kept in one form,
 * "+919876543210". These helpers read and show that form. They load the
 * phone number library, so they are for the forms; pages that only print a
 * number use displayPhone in lib/cms.ts.
 */

/** The one country phone numbers belong to. */
export const PHONE_COUNTRY = "IN";
/** What an empty phone field holds: the country code and nothing after it. */
export const PHONE_PREFIX = "+91";

type Metadata = Parameters<typeof formatPhoneNumberIntl>[1];
// The numbering rules for India only (scripts/phone-metadata.mjs). A JSON import is typed as loose arrays; the library wants its own shape.
export const PHONE_METADATA = india as unknown as Metadata;

/**
 * The stored form of a number written in any usual way ("98765 43210",
 * "09876543210", "+91 98765 43210", "0421 2241234"), or undefined when it is
 * not an Indian number.
 */
export function toStoredPhone(text: string | null | undefined): Value | undefined {
  if (!text?.trim()) return undefined;
  try {
    return parsePhoneNumber(text, PHONE_COUNTRY, PHONE_METADATA)?.number;
  } catch {
    return undefined;
  }
}

/** Whether text is a complete Indian mobile number, in any usual way of writing it (what sign-in, SMS and delivery need). */
export const isMobileNumber = (text: string | null | undefined) => /^\+91[6-9]\d{9}$/.test(toStoredPhone(text) ?? "");

/** Whether text is a complete Indian phone number, mobile or landline. */
export function isPhoneNumber(text: string | null | undefined) {
  try {
    return !!text && !!parsePhoneNumber(text, PHONE_COUNTRY, PHONE_METADATA)?.isValid();
  } catch {
    return false;
  }
}
