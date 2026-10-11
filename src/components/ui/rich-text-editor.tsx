"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { plainText } from "@/lib/rich-text";
import "react-quill-new/dist/quill.snow.css";
import "./rich-text-editor.css";

// Quill needs the browser, so the editor itself is loaded on the client only.
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false, loading: () => <div className="rte-loading" aria-hidden="true" /> });

type Variant = "full" | "compact";

/**
 * What each variant can produce. `formats` is an allow-list, so pasted colours,
 * fonts, images and tables are dropped; the API's sanitiser allows the same set.
 */
const VARIANTS: Record<Variant, { formats: string[]; modules: { toolbar: unknown[] } }> = {
  // Long descriptions (a product, a category).
  full: {
    formats: ["header", "bold", "italic", "underline", "strike", "list", "blockquote", "link"],
    modules: { toolbar: [[{ header: [3, 4, false] }], ["bold", "italic", "underline", "strike"], [{ list: "ordered" }, { list: "bullet" }], ["blockquote", "link"], ["clean"]] },
  },
  // Short ones (a line or two).
  compact: {
    formats: ["bold", "italic", "underline", "list", "link"],
    modules: { toolbar: [["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["link"], ["clean"]] },
  },
};

/** What the form keeps: Quill's HTML without its non-breaking spaces, or "" when nothing is typed. */
const toStored = (html: string) => (plainText(html) === "" ? "" : html.replace(/&nbsp;/g, " "));

export interface RichTextEditorProps {
  id?: string;
  /** Stored HTML (or older plain text). */
  value: string | null | undefined;
  /** Called with tidy HTML, or "" when the editor is empty. Only for edits made here, never for the value it was given. */
  onChange: (html: string) => void;
  onBlur?: () => void;
  variant?: Variant;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** The field's label, announced by screen readers (the editor is not a native form control). */
  "aria-label"?: string;
  className?: string;
}

/**
 * Rich text editor (React Quill) for the admin's description fields. It is a
 * controlled input like any other: give it `value` and `onChange`, for example
 * from react-hook-form's `<Controller>`.
 */
export function RichTextEditor({ id, value, onChange, onBlur, variant = "full", placeholder, invalid, disabled, className, "aria-label": ariaLabel }: RichTextEditorProps) {
  const stored = value ?? "";
  // Quill has to be handed back exactly the HTML it produced, or it resets the caret; `html` is that copy.
  const [html, setHtml] = useState(stored);
  // Follow changes from outside (the form was loaded or reset) without an effect.
  const [synced, setSynced] = useState(stored);
  if (stored !== synced) {
    setSynced(stored);
    if (toStored(html) !== stored) setHtml(stored);
  }

  const box = useRef<HTMLDivElement>(null);
  // Quill renders its own editable element; describe it for assistive technology once it exists.
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const describe = () => {
      const editor = root.querySelector(".ql-editor");
      if (!editor) return false;
      editor.setAttribute("role", "textbox");
      editor.setAttribute("aria-multiline", "true");
      if (ariaLabel) editor.setAttribute("aria-label", ariaLabel);
      if (invalid) editor.setAttribute("aria-invalid", "true");
      else editor.removeAttribute("aria-invalid");
      return true;
    };
    if (describe()) return;
    const observer = new MutationObserver(() => describe() && observer.disconnect());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ariaLabel, invalid]);

  // Clicking the field's <label htmlFor={id}> focuses the editor, as it would a native input.
  useEffect(() => {
    if (!id) return;
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (!label) return;
    const focus = () => box.current?.querySelector<HTMLElement>(".ql-editor")?.focus();
    label.addEventListener("click", focus);
    return () => label.removeEventListener("click", focus);
  }, [id]);

  return (
    <div ref={box} id={id} className={clsx("rte", className)} data-variant={variant} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      <ReactQuill
        theme="snow"
        value={html}
        onChange={(next: string, _delta: unknown, source: string) => {
          setHtml(next);
          // Quill also reports the content it was just given (source "api"); only typing and toolbar actions are edits.
          if (source === "user") onChange(toStored(next));
        }}
        onBlur={() => onBlur?.()}
        modules={VARIANTS[variant].modules}
        formats={VARIANTS[variant].formats}
        placeholder={placeholder}
        readOnly={disabled}
      />
    </div>
  );
}
