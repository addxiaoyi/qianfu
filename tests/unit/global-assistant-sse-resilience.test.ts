import { describe, expect, it } from 'vitest';
import {
  normalizeWikiSources,
  parseAssistantEventBlock,
  readAssistantText,
} from '../../qianfu-liandeng/src/components/form/globalAssistantSse.js';

describe('GlobalAssistantPanel SSE resilience', () => {
  it('ignores malformed JSON and keeps event parsing total', () => {
    expect(parseAssistantEventBlock('event: chunk\ndata: {"text":')).toBeNull();
    expect(parseAssistantEventBlock('event: chunk\ndata: [DONE]')).toBeNull();
  });

  it('accepts only text deltas from chunk payloads', () => {
    expect(readAssistantText({ text: '  hello  ' })).toBe('  hello  ');
    expect(readAssistantText({ text: { value: 'bad' } })).toBeNull();
    expect(readAssistantText({ text: 42 })).toBeNull();
    expect(readAssistantText(null)).toBeNull();
  });

  it('filters malformed sources before they reach React rendering', () => {
    expect(normalizeWikiSources([
      { title: 'Rules', url: 'https://example.com/rules' },
      { title: 42, url: 'https://example.com/bad' },
      { title: 'No URL', url: null },
      'not-an-object',
    ])).toEqual([{ title: 'Rules', url: 'https://example.com/rules' }]);
  });
});
