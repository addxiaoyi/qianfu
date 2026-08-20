import { describe, expect, it } from 'vitest';
import {
  buildMinecraftWikiUrl,
  normalizeWikiResults,
  parseOpenAiSseEvent,
  normalizeWikiQuery,
} from '../../server/services/aiCustomerServiceService';
import { AI_PRODUCT_STATIC } from '../../server/config/aiProductKnowledge';

describe('AI customer service knowledge retrieval', () => {
  it('removes conversational suffixes before wiki search', () => {
    expect(normalizeWikiQuery('请问红石中继器有什么作用？')).toBe('红石中继器');
  });

  it('anchors high-frequency site support answers to real routes', () => {
    expect(AI_PRODUCT_STATIC).toContain('投稿入口：/editor');
    expect(AI_PRODUCT_STATIC).toContain('工单入口：/tickets');
    expect(AI_PRODUCT_STATIC).toContain('卖家中心：/seller/marketplace');
  });

  it('builds a fixed-origin MediaWiki search URL', () => {
    const url = new URL(buildMinecraftWikiUrl('红石 中继器', 'zh'));

    expect(url.origin).toBe('https://zh.minecraft.wiki');
    expect(url.pathname).toBe('/api.php');
    expect(url.searchParams.get('gsrsearch')).toBe('红石 中继器');
    expect(url.searchParams.get('gsrlimit')).toBe('3');
  });

  it('normalizes and bounds wiki excerpts', () => {
    const results = normalizeWikiResults({
      query: {
        pages: {
          '2': { title: '红石火把', extract: `  ${'内容'.repeat(900)}  `, fullurl: 'https://zh.minecraft.wiki/w/红石火把' },
          '1': { title: '红石', extract: '基础元件', fullurl: 'https://evil.example/phish' },
        },
      },
    });

    expect(results).toHaveLength(2);
    expect(results.find((item) => item.title === '红石火把')?.excerpt.length).toBeLessThanOrEqual(1200);
    expect(results.find((item) => item.title === '红石')?.url).toBeUndefined();
  });

  it('extracts text deltas without evaluating upstream SSE data', () => {
    expect(parseOpenAiSseEvent('data: {"choices":[{"delta":{"content":"你好"}}]}')).toEqual({ text: '你好', done: false });
    expect(parseOpenAiSseEvent('data: [DONE]')).toEqual({ text: '', done: true });
    expect(parseOpenAiSseEvent('event: ping')).toEqual({ text: '', done: false });
  });
});
