import DOMPurify from "dompurify";

/** Escape text for safe insertion into HTML (text and quoted attributes). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strip scripts, event handlers and javascript: URLs from HTML fragments that
 * contain user-saved content before writing them into a print window.
 * Formatting tags and inline styles are kept.
 */
export function sanitizePrintHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["style", "target"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
  });
}
