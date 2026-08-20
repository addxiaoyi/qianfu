import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import GeometricLantern from '@/components/ui/GeometricLantern';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const snapshots = [
  {
    title: '个人控制台总览',
    description: '查看账号等级、余额、签到状态和常用入口。',
    image: '/snapshots/dashboard.webp',
    href: '/dashboard',
    alt: '千服联灯登录后个人控制台总览快照',
  },
  {
    title: '我的服务器',
    description: '查看已提交的服务器、审核进度和公开状态。',
    image: '/snapshots/servers-manage.webp',
    href: '/dashboard/servers',
    alt: '千服联灯登录后我的服务器管理页面快照',
  },
  {
    title: '个人主页',
    description: '查看账号资料、等级进度和 Minecraft 角色皮肤。',
    image: '/snapshots/profile.webp',
    href: '/me',
    alt: '千服联灯登录后个人主页快照',
  },
  {
    title: '工单中心',
    description: '提交账号问题、审核申诉或站点故障，并查看处理进度。',
    image: '/snapshots/tickets.webp',
    href: '/tickets',
    alt: '千服联灯登录后工单中心页面快照',
  },
] as const;

const journeys = [
  {
    title: '玩家找服',
    description: '按版本、玩法和标签筛选服务器，进入详情页查看地址和介绍。',
    href: '/servers',
    action: '浏览服务器',
    variant: 'network' as const,
  },
  {
    title: '服主发布',
    description: '验证邮箱后填写服务器资料，提交审核，通过后公开展示。',
    href: '/register',
    action: '创建账号',
    variant: 'data' as const,
  },
  {
    title: '问题处理',
    description: '账号、审核或展示出现问题时，可以提交工单联系管理员。',
    href: '/tickets',
    action: '进入工单',
    variant: 'terminal' as const,
  },
] as const;

const promises = [
  ['数据来源', '服务器数量、在线状态和玩家数来自站内记录与探测结果。'],
  ['内容审核', '服务器和资源通过审核后才会进入公开列表。'],
  ['处理记录', '工单、审核结果和管理操作会保留处理记录。'],
  ['故障提示', '接口异常或探测未完成时，页面会直接说明当前状态。'],
] as const;

const HomeShowcase: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      ScrollTrigger.batch('[data-home-reveal]', {
        start: 'top 86%',
        once: true,
        onEnter: (items) => {
          gsap.fromTo(
            items,
            { autoAlpha: 0, y: 28 },
            { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out', overwrite: true },
          );
        },
      });
    });
    return () => media.revert();
  }, { scope: rootRef });

  return (
    <div ref={rootRef} className="w-full">
      <section className="border-y border-zinc-200 bg-[#f5f5f2] px-5 py-20 sm:px-8 sm:py-28 md:px-12">
        <div className="mx-auto max-w-[1400px]">
          <header data-home-reveal className="max-w-3xl space-y-4">
            <p className="text-sm font-semibold text-accent">登录后页面</p>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl md:text-5xl">账号里有哪些功能</h2>
            <p className="max-w-2xl text-base font-medium leading-8 text-zinc-600 sm:text-lg">
              下面是个人控制台、服务器管理、个人主页和工单中心的实际页面截图。
            </p>
          </header>

          <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:gap-10">
            {snapshots.map((snapshot, index) => (
              <article
                key={snapshot.href}
                data-home-reveal
                className={`${index === 0 || index === 3 ? 'lg:col-span-7' : 'lg:col-span-5'} group`}
              >
                <Link to={snapshot.href} className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_55px_rgba(39,39,42,0.08)]">
                    <img
                      src={snapshot.image}
                      alt={snapshot.alt}
                      loading="lazy"
                      width={1280}
                      height={800}
                      className="aspect-[16/10] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.015]"
                    />
                  </div>
                  <div className="mt-5 flex items-start justify-between gap-5">
                    <div className="max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black tracking-tight text-zinc-950">{snapshot.title}</h3>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600">登录后可用</span>
                      </div>
                      <p className="mt-2 text-sm font-medium leading-7 text-zinc-600">{snapshot.description}</p>
                    </div>
                    <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-900 transition-colors group-hover:bg-zinc-950 group-hover:text-white">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32 md:px-12">
        <div className="mx-auto max-w-[1400px]">
          <div data-home-reveal className="grid gap-8 border-b border-zinc-200 pb-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">常用入口</h2>
            <p className="max-w-2xl text-base font-medium leading-8 text-zinc-600 lg:justify-self-end">
              找服务器、发布服务器和提交工单都可以从这里开始。
            </p>
          </div>

          <div className="grid gap-0 md:grid-cols-3">
            {journeys.map((journey) => (
              <article key={journey.title} data-home-reveal className="border-b border-zinc-200 py-9 md:border-b-0 md:border-r md:px-8 md:py-12 first:md:pl-0 last:md:border-r-0 last:md:pr-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-950 text-white">
                  <GeometricLantern variant={journey.variant} className="h-5 w-5" />
                </div>
                <h3 className="mt-8 text-2xl font-black tracking-tight text-zinc-950">{journey.title}</h3>
                <p className="mt-4 min-h-20 text-sm font-medium leading-7 text-zinc-600">{journey.description}</p>
                <Link to={journey.href} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950">
                  {journey.action}<ChevronRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white px-5 py-24 text-zinc-950 sm:px-8 sm:py-32 md:px-12">
        <div className="mx-auto grid max-w-[1400px] gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div data-home-reveal className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-sm font-semibold text-accent">站点规则</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">页面数据怎么来</h2>
            <p className="mt-6 max-w-xl text-base font-medium leading-8 text-zinc-600">
              首页只显示实际记录和探测结果。没有数据时显示 0 或暂无数据，接口异常时会给出提示。
            </p>
          </div>
          <div className="divide-y divide-zinc-200 border-y border-zinc-200">
            {promises.map(([title, description], index) => (
              <article key={title} data-home-reveal className="grid gap-4 py-8 sm:grid-cols-[4rem_1fr] sm:gap-8">
                <span className="text-sm font-bold tabular-nums text-zinc-400">0{index + 1}</span>
                <div>
                  <h3 className="text-xl font-black text-zinc-950">{title}</h3>
                  <p className="mt-3 text-sm font-medium leading-7 text-zinc-600">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32 md:px-12">
        <div data-home-reveal className="mx-auto grid max-w-[1400px] overflow-hidden rounded-2xl bg-accent text-white lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="p-8 sm:p-12 lg:p-16">
            <p className="text-sm font-semibold text-white/70">千服联灯</p>
            <h2 className="mt-4 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">浏览服务器，发布你的服务器</h2>
            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-white/80">浏览公开内容无需登录。发布服务器、管理资料和提交工单时，再创建并验证账号。</p>
          </div>
          <div className="flex flex-col gap-3 p-8 pt-0 sm:flex-row sm:p-12 sm:pt-0 lg:flex-col lg:p-16">
            <Link to="/servers" className="inline-flex min-w-48 items-center justify-between gap-5 rounded-xl bg-white px-6 py-4 text-sm font-bold text-zinc-950 transition-transform active:scale-[0.98]">
              浏览服务器<ChevronRight className="h-4 w-4" />
            </Link>
            <Link to="/register" className="inline-flex min-w-48 items-center justify-between gap-5 rounded-xl border border-white/40 px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-white/10 active:scale-[0.98]">
              注册服主账号<ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default React.memo(HomeShowcase);
