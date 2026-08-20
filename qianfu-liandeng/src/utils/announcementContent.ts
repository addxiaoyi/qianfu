export type AnnouncementContentBlock =
  | { type: 'text'; value: string }
  | { type: 'image'; url: string; alt: string };

const IMAGE_MARKDOWN = /!\[([^\]\r\n]{0,120})\]\((https:\/\/[^)\s]+)\)/g;

export function isSafeAnnouncementImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function appendAnnouncementImage(message: string, url: string, alt = '新闻图片'): string {
  if (!isSafeAnnouncementImageUrl(url)) throw new Error('图片地址不安全');
  const prefix = message.trimEnd();
  return `${prefix}${prefix ? '\n\n' : ''}![${alt}](${url})`;
}

export function parseAnnouncementMessage(message: string): AnnouncementContentBlock[] {
  const blocks: AnnouncementContentBlock[] = [];
  let cursor = 0;
  IMAGE_MARKDOWN.lastIndex = 0;

  for (const match of message.matchAll(IMAGE_MARKDOWN)) {
    const [source, alt, url] = match;
    const start = match.index ?? 0;
    if (start > cursor) blocks.push({ type: 'text', value: message.slice(cursor, start) });
    if (isSafeAnnouncementImageUrl(url)) {
      blocks.push({ type: 'image', url, alt: alt.trim() || '新闻图片' });
    } else {
      blocks.push({ type: 'text', value: source });
    }
    cursor = start + source.length;
  }

  if (cursor < message.length) blocks.push({ type: 'text', value: message.slice(cursor) });
  IMAGE_MARKDOWN.lastIndex = 0;
  return blocks.length > 0 ? blocks : [{ type: 'text', value: message }];
}
