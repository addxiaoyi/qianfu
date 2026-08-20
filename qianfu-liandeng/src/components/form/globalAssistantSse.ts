export type WikiSource = { title: string; url?: string };
export type AssistantEvent = { event: string; payload: unknown };

export function parseAssistantEventBlock(block: string): AssistantEvent | null {
  const lines = block.split(/\r?\n/);
  const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message';
  const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
  if (!data || data === '[DONE]') return null;
  try {
    return { event, payload: JSON.parse(data) as unknown };
  } catch (error) {
    console.error('[GlobalAssistantPanel] Ignoring malformed SSE payload', error);
    return null;
  }
}

export function isAssistantDoneBlock(block: string): boolean {
  const data = block.split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');
  return data === '[DONE]';
}

export function readAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('text' in payload)) return null;
  const text = payload.text;
  return typeof text === 'string' ? text : null;
}

export function normalizeWikiSources(input: unknown): WikiSource[] {
  if (!Array.isArray(input)) return [];

  return input.filter((source): source is WikiSource => {
    if (!source || typeof source !== 'object') return false;
    const candidate = source as { title?: unknown; url?: unknown };
    return typeof candidate.title === 'string' && candidate.title.trim().length > 0
      && (candidate.url === undefined || typeof candidate.url === 'string');
  }).map((source) => ({ title: source.title.trim(), ...(source.url ? { url: source.url } : {}) }));
}
