// HTML 清理工具，用于防止 XSS 攻击
// 基于 DOMPurify 的思想，提供轻量级实现

/**
 * 清理 HTML 字符串，移除危险的标签和属性
 * @param html - 需要清理的 HTML 字符串
 * @returns 清理后的安全 HTML 字符串
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  
  let sanitized = html;
  
  // 移除 script 标签及其内容
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<script[\s\S]*>/gi, '');
  
  // 移除 style 标签及其内容
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/<style[\s\S]*>/gi, '');
  
  // 移除 event handler 属性 (onclick, onerror, onload, onmouseover, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
  
  // 移除 javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']?javascript:[^"']*["']/gi, 'href=""');
  sanitized = sanitized.replace(/src\s*=\s*["']?javascript:[^"']*["']/gi, 'src=""');
  
  // 移除 iframe, object, embed, form, base 标签
  sanitized = sanitized.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*>/gi, '');
  sanitized = sanitized.replace(/<object[\s\S]*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*>/gi, '');
  sanitized = sanitized.replace(/<form[\s\S]*?<\/form>/gi, '');
  sanitized = sanitized.replace(/<form[^>]*>/gi, '');
  sanitized = sanitized.replace(/<base[^>]*>/gi, '');
  
  // 移除 comment 标签中的脚本
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
  
  return sanitized;
}

/**
 * 清理并转义文本，防止 XSS
 * @param text - 需要清理的文本
 * @returns 转义后的安全文本
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
