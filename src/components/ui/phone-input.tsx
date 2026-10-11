"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";
import PhoneNumberInput, { type Value } from "react-phone-number-input/input-core";
import { PHONE_COUNTRY, PHONE_METADATA, PHONE_PREFIX, toStoredPhone } from "@/lib/phone";
import { Input } from "./index";

/** The Indian flag, drawn here so no flag set is downloaded for one country. */
function IndiaFlag() {
  return (
    <svg viewBox="0 0 24 16" width="22" height="15" aria-hidden="true" className="shrink-0 rounded-[3px] ring-1 ring-black/10">
      <rect width="24" height="5.34" fill="#ff9933" />
      <rect y="5.33" width="24" height="5.34" fill="#ffffff" />
      <rect y="10.66" width="24" height="5.34" fill="#138808" />
      <circle cx="12" cy="8" r="2" fill="none" stroke="#000080" strokeWidth="0.6" />
    </svg>
  );
}

// What the field is given to show. Its own form ("+91…", also while a number is being typed) goes in
// untouched; a number saved in an older way ("98765 43210") is converted; anything else shows as empty.
const forField = (value: string | null | undefined): Value | undefined => (!value ? undefined : /^\+91\d*$/.test(value) ? (value as Value) : toStoredPhone(value));

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  /** The number in its stored form, "+919876543210"; empty, null or undefined for none. */
  value: string | null | undefined;
  /** Called with the stored form of what is typed so far, or "" once the field is cleared. */
  onChange: (value: string) => void;
  invalid?: boolean;
};

/**
 * The phone field used everywhere in the application (react-phone-number-input).
 * The country is fixed to India: the flag and "+91" are always there and cannot
 * be removed, the digits are spaced as they are typed ("+91 98765 43210"), and
 * a pasted number may come with or without the country code.
 */
export const PhoneInput = forwardRef<HTMLInputElement, Props>(function PhoneInput({ value, onChange, className, ...rest }, ref) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
        <IndiaFlag />
      </span>
      <PhoneNumberInput
        ref={ref}
        country={PHONE_COUNTRY}
        international
        withCountryCallingCode
        metadata={PHONE_METADATA}
        inputComponent={Input}
        value={forField(value)}
        onChange={(next) => {
          // A 0 in front is how a number is dialled inside India ("098765 43210", "0421 2241234"), not part of the number:
          // the field keeps showing what was typed, and the value goes out without it.
          const number = next?.replace(/^\+910+/, PHONE_PREFIX);
          onChange(number && number !== PHONE_PREFIX ? number : "");
        }}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className={clsx("pl-12", className)}
        {...rest}
      />
    </div>
  );
});
