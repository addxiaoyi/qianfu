import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ExternalLink, MessageCircle, Send, Square, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import MarkdownIt from 'markdown-it';
import { useUIStore } from '@/store/uiStore';
import { sanitizeHtml } from '@/utils/htmlSanitizer';
import { sanitizeUrl } from '@/utils/urlValidator';
import {
  isAssistantDoneBlock,
  normalizeWikiSources,
  parseAssistantEventBlock,
  readAssistantText,
  type WikiSource,
} from './globalAssistantSse';

gsap.registerPlugin(useGSAP);

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };

type GlobalAssistantPanelProps = {
  initialOpen?: boolean;
};

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '你好，我是千服 AI 助手。可以问我本站功能、账号、审核与工单问题，也可以咨询 Minecraft 游戏知识。',
};

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });

function renderMarkdown(content: string): { __html: string } {
  return { __html: sanitizeHtml(markdown.render(content)) };
}

const GlobalAssistantPanel: React.FC<GlobalAssistantPanelProps> = React.memo(({ initialOpen = false }) => {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sources, setSources] = useState<WikiSource[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const location = useLocation();
  const locale = useUIStore((state) => state.locale);
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-code'].some((path) => location.pathname.startsWith(path));

  useGSAP(() => {
    if (!open || !rootRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeline = gsap.timeline({ defaults: { duration: reduceMotion ? 0 : 0.28, ease: 'power2.out' } });
    timeline.fromTo('.ai-overlay', { autoAlpha: 0 }, { autoAlpha: 1 })
      .fromTo('.ai-panel', { autoAlpha: 0, y: 18, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1 }, '<');
  }, { scope: rootRef, dependencies: [open], revertOnUpdate: true });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (isAuthPage) setOpen(false);
  }, [isAuthPage]);

  useEffect(() => () => {
    abortRef.current?.abort();
    void readerRef.current?.cancel();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('button, textarea')?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const history = useMemo(
    () => messages.filter((item) => item.id !== 'welcome').slice(-10).map(({ role, content }) => ({ role, content })),
    [messages],
  );

  const stop = () => {
    abortRef.current?.abort();
    void readerRef.current?.cancel();
    abortRef.current = null;
    readerRef.current = null;
    setStreaming(false);
  };

  const send = async () => {
    const message = input.trim();
    if (!message || streaming) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message };
    const assistantId = crypto.randomUUID();
    setInput('');
    setSources([]);
    setMessages((current) => [...current, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch('/api/v1/ai/chat/stream', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Qianfu-AI-Client': 'qianfu-web-v1' },
        body: JSON.stringify({
          message,
          language: locale,
          page: `${location.pathname}${location.search}`,
          history,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';
        for (const block of blocks) {
          if (isAssistantDoneBlock(block)) {
            streamDone = true;
            break;
          }
          const parsed = parseAssistantEventBlock(block);
          if (!parsed) continue;
          const text = parsed.event === 'chunk' ? readAssistantText(parsed.payload) : null;
          if (text) {
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + text } : item));
          }
          if (parsed.event === 'done') {
            const payload = parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : null;
            setSources(normalizeWikiSources(payload && 'sources' in payload ? payload.sources : []));
          }
          if (parsed.event === 'error') {
            const payload = parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : null;
            const message = payload && 'message' in payload && typeof payload.message === 'string' ? payload.message : 'AI service unavailable';
            throw new Error(message);
          }
        }
        if (streamDone) break;
        if (done) {
          const lastBlock = buffer.trim();
          if (lastBlock && !isAssistantDoneBlock(lastBlock)) {
            const parsed = parseAssistantEventBlock(lastBlock);
            const text = parsed?.event === 'chunk' ? readAssistantText(parsed.payload) : null;
            if (text) setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + text } : item));
            if (parsed?.event === 'done') {
              const payload = parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : null;
              setSources(normalizeWikiSources(payload && 'sources' in payload ? payload.sources : []));
            }
          }
          break;
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setMessages((current) => current.map((item) => item.id === assistantId && !item.content ? { ...item, content: '千服 AI 助手暂时不可用，请稍后重试，或前往工单中心联系人工客服。' } : item));
      }
    } finally {
      const reader = readerRef.current;
      if (reader) {
        readerRef.current = null;
        reader.releaseLock();
      }
      abortRef.current = null;
      setStreaming(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void send();
  };

  if (isAuthPage) return null;

  return (
    <div ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed right-4 z-[200] flex items-center justify-center bg-accent text-white shadow-2xl shadow-accent/30 sm:top-auto sm:bottom-8 sm:right-8 ${isAuthPage ? 'top-24 bottom-auto h-12 w-12 rounded-2xl' : 'bottom-40 h-14 w-14 rounded-[1.5rem]'}`}
        title="千服 AI 助手"
        aria-label="打开千服 AI 助手"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {open ? (
        <>
          <button type="button" aria-label="关闭千服 AI 助手" onClick={() => setOpen(false)} className="ai-overlay fixed inset-0 z-[210] bg-black/25 backdrop-blur-sm" />
          <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="ai-assistant-title" className="ai-panel fixed bottom-28 left-3 right-3 z-[220] flex max-h-[calc(100dvh-8rem)] flex-col overflow-hidden overscroll-contain rounded-[2rem] border border-zinc-100 bg-white shadow-2xl shadow-black/20 sm:bottom-8 sm:left-auto sm:right-8 sm:h-[min(720px,calc(100dvh-4rem))] sm:w-[420px]">
            <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white"><Bot className="h-5 w-5" /></div>
                <div><h2 id="ai-assistant-title" className="text-base font-black tracking-tight">千服 AI 助手</h2><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">本站知识库 · Minecraft Wiki</p></div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-50" aria-label="关闭"><X className="h-5 w-5" /></button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-zinc-50/60 px-4 py-5" aria-live="polite">
              {messages.map((item) => (
                <div key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] break-words rounded-3xl px-4 py-3 text-sm font-medium leading-6 [&_a]:font-bold [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-black [&_li]:ml-5 [&_li]:list-disc [&_ol]:my-2 [&_p]:my-2 [&_ul]:my-2 ${item.role === 'user' ? 'bg-black text-white' : 'border border-zinc-100 bg-white text-zinc-700 shadow-sm'}`}>
                    {item.content ? <div dangerouslySetInnerHTML={renderMarkdown(item.content)} /> : (streaming ? '正在思考…' : '')}
                  </div>
                </div>
              ))}
              {sources.length ? <div className="rounded-2xl border border-zinc-100 bg-white p-4"><div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">参考来源</div>{sources.map((source) => { const url = sanitizeUrl(source.url); return url ? <a key={source.url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-1 text-xs font-bold text-accent"><ExternalLink className="h-3 w-3" />{source.title}</a> : null; })}</div> : null}
            </div>

            <form onSubmit={onSubmit} className="border-t border-zinc-100 bg-white p-4">
              <div className="flex items-end gap-3 rounded-[1.6rem] border border-zinc-200 bg-zinc-50 p-2 pl-4 focus-within:border-zinc-400">
                <textarea aria-label="向 AI 助手提问" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} maxLength={2000} placeholder="问本站功能或 Minecraft 问题…" className="max-h-32 min-h-12 flex-1 resize-none bg-transparent py-2 text-sm outline-hidden" />
                {streaming ? <button type="button" onClick={stop} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white" aria-label="停止生成"><Square className="h-4 w-4" /></button> : <button type="submit" disabled={!input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-white disabled:opacity-30" aria-label="发送"><Send className="h-4 w-4" /></button>}
              </div>
              <p className="mt-2 text-center text-[10px] font-bold text-zinc-300">AI 可能出错，重要信息请以站内规则和原始 Wiki 页面为准</p>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
});

export default GlobalAssistantPanel;
