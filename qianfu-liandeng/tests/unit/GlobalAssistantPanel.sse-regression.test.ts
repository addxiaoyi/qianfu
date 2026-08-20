// @vitest-environment jsdom

import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalAssistantPanel from '../../src/components/form/GlobalAssistantPanel';

vi.mock('gsap', () => ({
  gsap: {
    registerPlugin: vi.fn(),
    timeline: () => ({
      fromTo() {
        return this;
      },
    }),
  },
}));

vi.mock('@gsap/react', () => ({
  useGSAP: (callback: () => void) => callback(),
}));

vi.mock('@/store/uiStore', () => ({
  useUIStore: (selector: (state: { locale: string }) => string) => selector({ locale: 'zh' }),
}), { virtual: true });

vi.mock('@/utils/htmlSanitizer', () => ({
  sanitizeHtml: (html: string) => html,
}), { virtual: true });

type Reader = {
  read: () => Promise<{ value?: Uint8Array; done: boolean }>;
  cancel: ReturnType<typeof vi.fn>;
  releaseLock: ReturnType<typeof vi.fn>;
};

const encoder = new TextEncoder();

function createResponse(chunks: string[]) {
  let index = 0;
  const reader: Reader = {
    read: vi.fn(async () => {
      if (index >= chunks.length) return { done: true };
      return { value: encoder.encode(chunks[index++]), done: false };
    }),
    cancel: vi.fn(async () => undefined),
    releaseLock: vi.fn(),
  };
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: { getReader: () => reader },
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, reader };
}

function mountPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(MemoryRouter, null, createElement(GlobalAssistantPanel, { initialOpen: true })));
  });
  return {
    container,
    unmount: () => act(() => root.unmount()),
  };
}

async function waitForAssertion(assertion: () => void) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  assertion();
}

async function submitQuestion(container: HTMLElement) {
  const input = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="向 AI 助手提问"]');
  const submit = Array.from(container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === '发送');
  if (!input || !submit) throw new Error('Assistant form controls not found');
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setValue?.call(input, '如何投稿？');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  act(() => submit.click());
  await waitForAssertion(() => expect(global.fetch).toHaveBeenCalledTimes(1));
}

describe('GlobalAssistantPanel SSE regressions', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-id') });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores invalid chunk text, logs malformed JSON, and rejects non-array sources', async () => {
    const { reader } = createResponse([
      'event: chunk\ndata: {"text":{"unsafe":true}}\n\n',
      'event: chunk\ndata: {not-json}\n\n',
      'event: chunk\ndata: {"text":"稳定输出"}\n\n',
      'event: done\ndata: {"sources":{"title":"不是数组"}}\n\n',
    ]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { container, unmount } = mountPanel();
    await submitQuestion(container);

    await waitForAssertion(() => expect(reader.releaseLock).toHaveBeenCalledTimes(1));
    expect(container.textContent).toContain('稳定输出');
    expect(container.textContent).not.toContain('[object Object]');
    expect(container.textContent).not.toContain('参考来源');
    expect(errorSpy).toHaveBeenCalledWith(
      '[GlobalAssistantPanel] Ignoring malformed SSE payload',
      expect.any(SyntaxError),
    );
    unmount();
  });

  it('stops consuming the stream after data: [DONE]', async () => {
    const { reader } = createResponse([
      'data: [DONE]\n\n',
      'event: chunk\ndata: {"text":"不应显示"}\n\n',
    ]);

    const { container, unmount } = mountPanel();
    await submitQuestion(container);

    await waitForAssertion(() => expect(reader.releaseLock).toHaveBeenCalledTimes(1));
    expect(container.textContent).not.toContain('不应显示');
    expect(reader.read).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('cancels the reader when the panel unmounts during an active stream', async () => {
    let resolveRead: ((value: { done: boolean }) => void) | undefined;
    const reader: Reader = {
      read: vi.fn(() => new Promise((resolve) => { resolveRead = resolve; })),
      cancel: vi.fn(async () => {
        resolveRead?.({ done: true });
      }),
      releaseLock: vi.fn(),
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => reader },
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = mountPanel();
    await submitQuestion(view.container);
    view.unmount();

    await waitForAssertion(() => expect(reader.cancel).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
