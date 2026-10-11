/**
 * Helpers for rich text typed in the admin's editor (descriptions).
 *
 * The API stores it as sanitised HTML (see src/common/utils/html.ts in trendz-api).
 * Older values, and values from places without an editor, are plain text;
 * everything here accepts both.
 */

const ALLOWED_TAGS = "p|br|strong|b|em|i|u|s|ul|ol|li|h3|h4|blockquote|a|span";
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

const hasMarkup = (value: string) => /<\/?[a-z][^>]*>/i.test(value);
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The words only, for places that cannot show formatting: table cells, meta
 * descriptions, menus, tooltips. "<p>One</p><p>Two</p>" becomes "One Two".
 */
export function plainText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<\/(p|li|h[1-6]|blockquote|div)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name]!)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * HTML that is safe to put on a page. The API already stores allow-listed
 * markup only; this is a second line of defence, and it turns plain text
 * (line breaks included) into paragraphs.
 */
export function displayHtml(value: string): string {
  if (!hasMarkup(value)) {
    return value
      .split(/\n{2,}/)
      .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }
  return (
    value
      // Elements whose content has to go with them.
      .replace(/<\s*(script|style|iframe|object|embed|template|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      // Any other tag that is not on the list (the words inside it stay).
      .replace(new RegExp(`<(?!\\/?(${ALLOWED_TAGS})\\b)[^>]*>`, "gi"), "")
      // Event handlers and script URLs on the tags that are left.
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(href|src)\s*=\s*("\s*(javascript|data|vbscript):[^"]*"|'\s*(javascript|data|vbscript):[^']*'|(javascript|data|vbscript):[^\s>]*)/gi, "")
  );
}

/** For form schemas: a limit on what was typed, not on the markup around it. `z.string().refine(withinChars(500), "…")`. */
export const withinChars = (max: number) => (value: string) => plainText(value).length <= max;
