import { describe, expect, it } from 'vitest';

import { normalizeTagListResponse } from '../../qianfu-liandeng/src/utils/tagResponse';
import { normalizeUserTagResponse } from '../../qianfu-liandeng/src/utils/userTagResponse';

describe('tag list response normalization', () => {
  it('drops malformed collections and normalizes tag text before rendering', () => {
    const normalized = normalizeTagListResponse({
      items: [
        { id: 'survival', name: '生存', category: 'interest' },
        { id: 'broken', name: { text: '坏数据' }, category: 'interest' },
        null,
      ],
      categories: { interest: '兴趣' },
    });

    expect(normalized.items).toEqual([
      { id: 'survival', name: '生存', category: 'interest' },
    ]);
    expect(normalized.categories).toEqual([]);
  });

  it.each([
    ['object', { tags: { id: 'not-a-list' } }],
    ['string', { tags: 'not-a-list' }],
    ['null', { tags: null }],
  ])('treats a %s user tag collection as empty', (_label, response) => {
    expect(normalizeUserTagResponse(response).tags).toEqual([]);
  });

  it('drops user tags whose nested tag fields have invalid types', () => {
    const normalized = normalizeUserTagResponse({
      tags: [
        {
          userId: '47',
          tag: { id: 'verified', name: '已认证', category: 'basic' },
          score: 80,
          createdAt: '2026-08-12T00:00:00.000Z',
        },
        {
          userId: '47',
          tag: { id: 'broken-name', name: { text: '坏数据' }, category: 'basic' },
        },
        {
          userId: '47',
          tag: { id: 'broken-category', name: '坏分类', category: null },
        },
        {
          userId: 47,
          tag: { id: 'broken-user', name: '坏用户', category: 'basic' },
        },
      ],
    });

    expect(normalized.tags).toEqual([
      expect.objectContaining({
        userId: '47',
        tag: { id: 'verified', name: '已认证', category: 'basic' },
        score: 80,
      }),
    ]);
  });
});
