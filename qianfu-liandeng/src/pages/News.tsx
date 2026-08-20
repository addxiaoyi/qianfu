import React, { useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Clock3, Newspaper, Quote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { announcementApi, type Announcement, type AnnouncementTone } from '@/api/announcementApi';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { formatDateTime } from '@/utils/serverView';
import { parseAnnouncementMessage } from '@/utils/announcementContent';
import { normalizeNewsResponse } from '@/utils/frontendResponseNormalization';
import { sanitizeUrl } from '@/utils/urlValidator';

function AnnouncementImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className="my-8 border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-sm font-bold text-zinc-400">图片暂时无法加载</div>;
  }

  return (
    <figure className="my-9 overflow-hidden border-y border-zinc-200 bg-zinc-50">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="max-h-[38rem] w-full object-contain"
      />
      <figcaption className="border-t border-zinc-200 px-4 py-3 text-[11px] font-bold tracking-wide text-zinc-400">{alt}</figcaption>
    </figure>
  );
}

function AnnouncementMessage({ message, className }: { message: string; className: string }) {
  return (
    <div className={className}>
      {parseAnnouncementMessage(message).map((block, index) => block.type === 'image'
        ? <AnnouncementImage key={`${block.url}-${index}`} url={block.url} alt={block.alt} />
        : <span key={`${block.value}-${index}`} className="whitespace-pre-wrap">{block.value}</span>)}
    </div>
  );
}

function LongformMessage({ message }: { message: string }) {
  let paragraphIndex = 0;

  return (
    <div id="news-longform" data-testid="news-longform" className="text-[1.08rem] font-medium leading-[2.05] text-zinc-700 sm:text-[1.18rem]">
      {parseAnnouncementMessage(message).map((block, blockIndex) => {
        if (block.type === 'image') {
          return <AnnouncementImage key={`${block.url}-${blockIndex}`} url={block.url} alt={block.alt} />;
        }

        return block.value.split(/\n{2,}/).map((paragraph, index) => {
          const trimmed = paragraph.trim();
          if (!trimmed) return null;

          const isLeadParagraph = paragraphIndex === 0;
          paragraphIndex += 1;
          return (
            <p
              key={`${blockIndex}-${index}-${trimmed.slice(0, 20)}`}
              className={`mb-7 whitespace-pre-wrap last:mb-0 ${isLeadParagraph ? 'first-letter:mr-3 first-letter:text-7xl first-letter:font-black first-letter:leading-[0.75] first-letter:text-accent' : ''}`}
            >
              {trimmed}
            </p>
          );
        });
      })}
    </div>
  );
}

const toneLabels: Record<AnnouncementTone, string> = {
  INFO: '平台动态',
  SUCCESS: '进展更新',
  WARNING: '重要提醒',
  CRITICAL: '紧急通知',
};

const toneStyles: Record<AnnouncementTone, string> = {
  INFO: 'border-zinc-200 bg-zinc-50 text-zinc-600',
  SUCCESS: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-800',
  CRITICAL: 'border-red-200 bg-red-50 text-red-700',
};

function NewsLink({ announcement }: { announcement: Announcement }) {
  const linkPath = sanitizeUrl(announcement.linkPath);
  if (!linkPath || !announcement.linkLabel) return null;

  return (
    <Link
      to={linkPath}
      className="inline-flex items-center gap-2 text-sm font-black text-zinc-950 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-950"
    >
      {announcement.linkLabel}
      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function ToneBadge({ tone }: { tone: AnnouncementTone }) {
  return (
    <span className={`inline-flex border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${toneStyles[tone]}`}>
      {toneLabels[tone]}
    </span>
  );
}

function NewsDate({ value, prominent = false }: { value: string; prominent?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${prominent ? 'text-sm font-black text-zinc-950' : 'text-xs font-bold text-zinc-400'}`}>
      <CalendarDays className={prominent ? 'h-4 w-4 text-accent' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {formatDateTime(value)}
    </span>
  );
}

function estimateReadingMinutes(message: string): number {
  const text = message.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\s/g, '');
  return Math.max(1, Math.ceil(text.length / 420));
}

function Masthead({ news, featured }: { news: Announcement[]; featured: Announcement }) {
  return (
    <header data-testid="news-masthead" className="border-y-4 border-double border-zinc-950 py-5 sm:py-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.32em] text-accent">
            <Newspaper className="h-4 w-4" aria-hidden="true" />
            QIANFU DAILY / NEWSROOM
          </div>
          <h1 id="news-title" className="mt-3 font-serif text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">联灯日报</h1>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-l-2 border-accent pl-4 text-xs font-bold leading-6 text-zinc-500 sm:min-w-[18rem]">
          <span>第 01 期</span>
          <span className="text-right">共 {news.length} 篇</span>
          <span>头版 · 长文</span>
          <span className="text-right">正式发布</span>
          <span className="col-span-2 border-t border-zinc-200 pt-2 text-[10px] uppercase tracking-[0.22em] text-zinc-400">本期首发：{featured.title}</span>
        </div>
      </div>
    </header>
  );
}

const News: React.FC = () => {
  const newsQuery = useQuery({
    queryKey: ['public-news'],
    queryFn: async () => normalizeNewsResponse(await announcementApi.publicList()),
    staleTime: 30_000,
  });

  const news = [...(newsQuery.data ?? [])].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
  const featured = news[0];
  const latestUpdatedAt = featured?.updatedAt ?? '';
  const toneCount = new Set(news.map((announcement) => announcement.tone)).size;
  const readingMinutes = featured ? estimateReadingMinutes(featured.message) : 0;

  return (
    <main className="min-h-screen bg-[#f8f7f3] pb-24 text-zinc-950" aria-labelledby="news-title">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16 lg:px-12">
        <StatusWrapper
          isLoading={newsQuery.isLoading}
          isError={newsQuery.isError}
          isEmpty={!newsQuery.isLoading && !newsQuery.isError && news.length === 0}
          onRetry={() => void newsQuery.refetch()}
          emptyTitle="暂时没有新闻"
          emptyDescription="管理员发布新闻后，会在这里展示最新内容。"
        >
          {featured ? (
            <>
              <Masthead news={news} featured={featured} />

              <section className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
                <article data-testid="news-featured" className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3 border-b border-zinc-300 pb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">头版 / 首发</span>
                    <span className="h-1 w-1 bg-zinc-400" aria-hidden="true" />
                    <ToneBadge tone={featured.tone} />
                    <NewsDate value={featured.updatedAt} />
                  </div>
                  <h2 className="mt-7 max-w-5xl break-words font-serif text-3xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">{featured.title}</h2>
                  <p className="mt-7 max-w-3xl border-l-2 border-accent pl-5 font-serif text-xl font-bold leading-9 text-zinc-600 sm:text-2xl">
                    记录平台正在发生的变化，也记录每一位玩家与服主共同留下的现场。
                  </p>
                  <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-zinc-300 py-4 text-xs font-bold text-zinc-500">
                    <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-accent" aria-hidden="true" />阅读时间约 {readingMinutes} 分钟</span>
                    <NewsDate value={featured.updatedAt} prominent />
                    <NewsLink announcement={featured} />
                  </div>

                  <div className="mt-10 max-w-3xl">
                    <LongformMessage message={featured.message} />
                  </div>
                </article>

                <aside data-testid="news-contents" className="self-start border-t-4 border-zinc-950 pt-4 lg:sticky lg:top-8">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-serif text-2xl font-black">本期目录</h2>
                    <BookOpen className="h-5 w-5 text-accent" aria-hidden="true" />
                  </div>
                  <nav aria-label="新闻目录" className="mt-5 divide-y divide-zinc-300 border-y border-zinc-300">
                    <a href="#news-longform" className="block py-4 transition-colors hover:text-accent">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-accent">01 / 头版主文</span>
                      <span className="mt-2 block font-serif text-lg font-black leading-6">{featured.title}</span>
                    </a>
                    {news.slice(1).map((announcement, index) => (
                      <a key={announcement.id} href={`#news-brief-${announcement.id}`} className="block py-4 transition-colors hover:text-accent">
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">{String(index + 2).padStart(2, '0')} / 短讯</span>
                        <span className="mt-2 block font-serif text-lg font-black leading-6">{announcement.title}</span>
                      </a>
                    ))}
                  </nav>
                  <div className="mt-6 border-l-2 border-accent pl-4 text-sm font-medium leading-7 text-zinc-500">
                    <Quote className="mb-2 h-5 w-5 text-accent" aria-hidden="true" />
                    一份公开记录，应该让人读得懂，也值得慢慢读完。
                  </div>
                </aside>
              </section>

              <section data-testid="news-metrics" className="mt-14 grid border-y border-zinc-300 sm:grid-cols-3">
                <div className="border-b border-zinc-300 py-5 sm:border-b-0 sm:border-r sm:pr-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">TOTAL STORIES</p>
                  <p className="mt-2 font-serif text-3xl font-black tracking-tight">共 {news.length} 条</p>
                </div>
                <div className="border-b border-zinc-300 py-5 sm:border-b-0 sm:border-r sm:px-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">最新更新 / LATEST UPDATE</p>
                  <p className="mt-2 text-lg font-black tracking-tight">{formatDateTime(latestUpdatedAt)}</p>
                </div>
                <div className="py-5 sm:pl-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">NEWS TYPES</p>
                  <p className="mt-2 font-serif text-3xl font-black tracking-tight">{toneCount} 类</p>
                </div>
              </section>

              <section data-testid="news-feed" aria-labelledby="news-feed-title" className="mt-16">
                <div className="flex flex-col gap-3 border-b-4 border-double border-zinc-950 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">THE BRIEFS</p>
                    <h2 id="news-feed-title" className="mt-2 font-serif text-3xl font-black tracking-tight sm:text-4xl">报纸短讯</h2>
                  </div>
                  <p className="text-xs font-bold text-zinc-400">从最新发布开始浏览</p>
                </div>
                <div className="divide-y divide-zinc-300">
                  {news.slice(1).map((announcement, index) => (
                    <article id={`news-brief-${announcement.id}`} key={announcement.id} className="group grid gap-4 py-8 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-start sm:gap-8">
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">
                        <span className="text-accent">{String(index + 2).padStart(2, '0')}</span>
                        <span className="hidden h-px w-5 bg-zinc-300 sm:block" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <ToneBadge tone={announcement.tone} />
                          <NewsDate value={announcement.updatedAt} />
                        </div>
                        <h3 className="break-words font-serif text-2xl font-black tracking-tight transition-colors group-hover:text-accent">{announcement.title}</h3>
                        <AnnouncementMessage message={announcement.message} className="mt-3 max-w-3xl break-words text-sm font-medium leading-7 text-zinc-500" />
                      </div>
                      <div className="sm:pt-1"><NewsLink announcement={announcement} /></div>
                    </article>
                  ))}
                  {news.length === 1 ? <p className="py-8 text-sm font-bold text-zinc-400">本期暂无其他短讯。</p> : null}
                </div>
              </section>
            </>
          ) : null}
        </StatusWrapper>
      </div>
    </main>
  );
};

export default News;
