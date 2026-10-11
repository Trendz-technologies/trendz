import { clsx } from "clsx";
import { displayHtml } from "@/lib/rich-text";
import "./rich-text.css";

/**
 * Shows rich text typed in the admin (a description) with its formatting:
 * paragraphs, bold, lists, headings, quotes and links. Works in server and
 * client components. Use `plainText()` from lib/rich-text where only the
 * words fit (table cells, menus, meta tags).
 */
export function RichText({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html) return null;
  return <div className={clsx("rich-text", className)} dangerouslySetInnerHTML={{ __html: displayHtml(html) }} />;
}
