import DOMPurify from 'dompurify';

const RICH_TEXT_ALLOWED_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'u',
  'ul',
] as const;

const RICH_TEXT_ALLOWED_ATTRIBUTES = [
  'href',
  'title',
] as const;

const RICH_TEXT_FORBIDDEN_TAGS = [
  'base',
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'math',
  'meta',
  'object',
  'script',
  'style',
  'svg',
  'textarea',
] as const;

/**
 * Sanitize user- or model-authored rich HTML with one strict frontend policy.
 * Inline CSS, active content, DOM-clobbering ids, data attributes, and unknown
 * elements are intentionally discarded.
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...RICH_TEXT_ALLOWED_ATTRIBUTES],
    FORBID_TAGS: [...RICH_TEXT_FORBIDDEN_TAGS],
    FORBID_ATTR: ['style'],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  });
}

/** Escape plain text for the rare cases that explicitly require an HTML string. */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
