/**
 * URL 安全验证工具
 * 防止 javascript: / data: 等危险协议的 URL 注入
 */

const SAFE_PROTOCOLS = ['https:', 'http:', 'ftp:'];
const MAX_URL_LENGTH = 2048;

/**
 * 验证 URL 协议是否安全
 */
export function isUrlSafe(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.length > MAX_URL_LENGTH) return false;
  if (!url.trim()) return false;

  // 阻止常见绕过手法
  const trimmed = url.trim().replace(/\s+/g, '');

  // 阻止 javascript: / data: / vbscript: 等（忽略大小写 + 空白符）
  const dangerous = /^(javascript|data|vbscript|file):/i.test(trimmed.replace(/[\s\n\r\t]/g, ''));
  if (dangerous) return false;

  // 阻止以 < 开头的 HTML 注入
  if (trimmed.startsWith('<')) return false;

  try {
    const urlObj = new URL(trimmed);
    return SAFE_PROTOCOLS.includes(urlObj.protocol);
  } catch {
    // 非完整 URL（如相对路径）放行
    if (!trimmed.includes('://')) return true;
    return false;
  }
}

/**
 * 安全地返回 URL，如果无效则返回默认值
 */
export function sanitizeUrl(
  url: string | null | undefined,
  fallback: string = ''
): string {
  if (!url || typeof url !== 'string') return fallback;
  return isUrlSafe(url) ? url.trim() : fallback;
}

/**
 * 允许的图片扩展名白名单
 */
const SAFE_IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.ico',
]);

/**
 * 图片 URL 专用验证（额外阻止非白名单扩展名）
 */
export function isImageUrlSafe(url: string): boolean {
  if (!isUrlSafe(url)) return false;
  // 必须匹配白名单扩展名
  const lower = url.toLowerCase().split('?')[0].split('#')[0];
  let hasSafeExt = false;
  for (const ext of SAFE_IMAGE_EXTENSIONS) {
    if (lower.endsWith(ext)) { hasSafeExt = true; break; }
  }
  // 没有已知扩展名的图片 URL 视为不安全
  if (!hasSafeExt) return false;
  return true;
}
