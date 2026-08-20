import { describe, expect, it } from 'vitest';

import {
  normalizeInboxMessage,
  normalizeInboxResponse,
  normalizeMailLibraryPayload,
} from '../../qianfu-liandeng/src/pages/admin/AdminMailConfig';

describe('AdminMailConfig response resilience', () => {
  it('drops mail history entries whose createdAt is not a string', () => {
    const payload = normalizeMailLibraryPayload({
      history: [
        { id: 'bad-null', createdAt: null },
        { id: 'bad-object', createdAt: { value: '2026-08-12' } },
        { id: 'valid', createdAt: '2026-08-12T00:00:00.000Z' },
      ],
    });

    expect(payload.history.map((item) => item.id)).toEqual(['valid']);
  });

  it('uses an empty inbox when messages is not an array', () => {
    expect(normalizeInboxResponse({ messages: { id: 'not-a-list' } }).messages).toEqual([]);
  });

  it('uses an empty sender list when inbox from is not an array', () => {
    const message = normalizeInboxMessage({
      id: '42',
      uid: 42,
      subject: 'Malformed sender',
      from: { name: 'not-a-list' },
      date: '2026-08-12T00:00:00.000Z',
      preview: 'preview',
      text: 'text',
      html: '<p>text</p>',
    });

    expect(message?.from).toEqual([]);
  });
});
