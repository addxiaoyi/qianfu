import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion, useScroll, useSpring } from 'framer-motion';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';
import HomeFeatureCard from '@/components/business/HomeFeatureCard';
import HomeStatCard from '@/components/business/HomeStatCard';
import HomeShowcase from '@/components/business/HomeShowcase';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/request';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';

interface ServerStats {
  onlineNodes: number;
  syncLatency: string;
  avgResponseTime: string;
  availability: string;
  totalServers: number;
  totalUsers: number;
  totalPlayers: number;
}

const heroSupportBadges: {
  prefix: string;
  healthyKey: TranslationKey;
  pendingKey: TranslationKey;
  degradedKey: TranslationKey;
}[] = [
  {
    prefix: '平台状态',
    healthyKey: 'home.status.connected',
    pendingKey: 'home.status.probing',
    degradedKey: 'home.status.degraded',
  },
  {
    prefix: '数据同步',
    healthyKey: 'home.status.sync',
    pendingKey: 'home.status.sync_pending',
    degradedKey: 'home.status.sync_issue',
  },
];

const featureCards: { titleKey: TranslationKey; descKey: TranslationKey; variant: 'security' | 'spark' | 'terminal'; tag: string }[] = [
  {
    titleKey: 'home.feat.security.title',
    descKey: 'home.feat.security.desc',
    variant: 'security',
    tag: '账号安全',
  },
  {
    titleKey: 'home.feat.auction.title',
    descKey: 'home.feat.auction.desc',
    variant: 'spark',
    tag: '免费发布',
  },
  {
    titleKey: 'home.feat.support.title',
    descKey: 'home.feat.support.desc',
    variant: 'terminal',
    tag: '工单支持',
  },
];

const sectionHeader = {
  labelClassName: 'text-[10px] font-black uppercase tracking-[0.45em] italic text-accent',
  titleClassName: 'text-3xl md:text-4xl font-bold tracking-tight text-black',
  descClassName: 'text-base md:text-lg text-zinc-600 font-medium leading-relaxed max-w-2xl',
};

const ctaButtonBase =
  'group px-8 sm:px-12 py-5 sm:py-6 rounded-[2.5rem] font-semibold text-sm flex items-center justify-center gap-4 sm:gap-6 transition-all';


const metricsHeader = {
  title: '实时状态',
  desc: '公开列表与平台链路的当前数据，每 30 秒自动刷新。',
  titleClassName: 'text-3xl md:text-4xl font-black tracking-[-0.045em] text-zinc-950',
  descClassName: 'text-sm md:text-base text-zinc-600 font-medium leading-relaxed max-w-xl',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
};

const Home: React.FC = () => {
  const t = useT();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const { backendDegraded, isLoading: backendHealthLoading } = useBackendHealth();

  const { data: statsData, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['server-stats'],
    queryFn: () => request<ServerStats>(isRustV2Enabled() ? rustV2Path('/public/stats') : '/servers/stats', {
      useAuth: false,
      ...(isRustV2Enabled() ? rustV2RequestOptions : {}),
    }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 2,
  });

  const showDegradedState = backendDegraded || statsError;
  const showPendingState = !showDegradedState && (backendHealthLoading || statsLoading);

  const heroBadgeStates = heroSupportBadges.map((badge) => ({
    prefix: badge.prefix,
    value: t(showDegradedState ? badge.degradedKey : showPendingState ? badge.pendingKey : badge.healthyKey),
  }));

  const stats = [
    { label: 'home.stats.users' as const, value: statsLoading ? '加载中' : String(statsData?.totalUsers ?? '暂无') },
    { label: 'home.stats.servers' as const, value: statsLoading ? '加载中' : String(statsData?.totalServers ?? '暂无') },
    { label: 'home.stats.nodes' as const, value: statsLoading ? '加载中' : String(statsData?.onlineNodes ?? '暂无') },
    { label: 'home.stats.players' as const, value: statsLoading ? '加载中' : String(statsData?.totalPlayers ?? '暂无') },
    { label: 'home.stats.latency' as const, value: statsLoading ? '加载中' : String(statsData?.syncLatency ?? '暂无') },
    { label: 'home.stats.response' as const, value: statsLoading ? '加载中' : String(statsData?.avgResponseTime ?? '暂无') },
    { label: 'home.stats.availability' as const, value: statsLoading ? '加载中' : String(statsData?.availability ?? '暂无数据') },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="flex flex-col items-center bg-white selection:bg-accent selection:text-white"
    >
      <motion.div
        className="fixed top-0 left-0 right-0 h-1.5 bg-accent origin-left z-[200] shadow-accent"
        style={{ scaleX }}
      />

      <section className="w-full relative overflow-hidden px-4 pb-24 pt-20 sm:px-6 sm:pb-28 sm:pt-24 md:pb-32 flex flex-col items-center text-center border-b border-zinc-100">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] sm:w-[1200px] h-[420px] sm:h-[600px] bg-accent-subtle blur-[100px] sm:blur-[120px] rounded-full pointer-events-none -z-10" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none -z-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="max-w-6xl mx-auto flex flex-col items-center relative z-10">
          <motion.div variants={itemVariants} className="mb-8 flex items-center gap-3 sm:mb-10 sm:gap-4">
            <div className="px-4 sm:px-5 py-2 border border-zinc-100 bg-white rounded-sm text-[9px] sm:text-[10px] font-black uppercase tracking-[0.32em] sm:tracking-[0.4em] italic shadow-xs">
              {t('home.protocol')}
            </div>
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-accent" />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="mb-7 text-[2.75rem] font-bold leading-tight tracking-tight text-black sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {t('home.hero.title')}
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mb-9 max-w-2xl px-2 text-base font-medium leading-relaxed text-zinc-600 sm:px-0 sm:text-lg md:text-xl"
          >
            {t('home.hero.subtitle')}
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto px-2 sm:px-0">
            <Link to="/servers" className={`${ctaButtonBase} btn-accent text-white shadow-2xl`}>
              {t('home.hero.explore')}
              <GeometricLantern variant="network" className="w-5 h-5 group-hover:translate-x-3 transition-transform" />
            </Link>
            <Link to="/news" className={`${ctaButtonBase} border border-zinc-100 bg-white text-black hover:bg-zinc-50`}>
              查看站点新闻
              <ChevronRight className="w-5 h-5 group-hover:translate-x-2 transition-transform opacity-50" />
            </Link>
          </motion.div>

          {showDegradedState ? (
            <motion.div
              variants={itemVariants}
              className="mt-8 max-w-2xl rounded-[1.75rem] border border-amber-200 bg-amber-50 px-6 py-4 text-left shadow-sm"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.35em] italic text-amber-700">
                {t('home.status.banner_label')}
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
                {t('home.status.banner_desc')}
              </p>
            </motion.div>
          ) : null}
        </div>

        <div className="absolute bottom-12 left-12 opacity-10 lg:block hidden">
          <div className="flex flex-col items-start gap-2">
            <GeometricLantern variant="terminal" className="w-8 h-8" />
            <span className="text-[10px] font-black uppercase tracking-widest italic">{heroBadgeStates[0].prefix} {heroBadgeStates[0].value}</span>
          </div>
        </div>
        <div className="absolute bottom-12 right-12 opacity-10 lg:block hidden">
          <div className="flex flex-col items-end gap-2">
            <GeometricLantern variant="network" className="w-8 h-8" />
            <span className="text-[10px] font-black uppercase tracking-widest italic">{heroBadgeStates[1].prefix} {heroBadgeStates[1].value}</span>
          </div>
        </div>
      </section>

      <section className="w-full max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12 py-12 sm:py-14">
        <div className="rounded-[2rem] border border-zinc-100 bg-zinc-50/80 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 sm:gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="text-[10px] font-black uppercase tracking-[0.45em] italic text-zinc-400">站点摘要</div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Minecraft 服务器发现、发布与支持</h2>
              <p className="text-sm sm:text-base text-zinc-500 font-medium leading-7">
                千服联灯面向中文 Minecraft 玩家和服主，提供公开服务器列表、搜索、资料发布、新闻公告和工单支持。
                访客可以直接浏览服务器信息，服主可以提交资料并管理展示内容。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full lg:w-[420px]">
              {[
                '公开服务器列表',
                '玩家资源中心',
                '工单与通知支持',
                '移动端优先体验',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white bg-white px-4 py-4 text-sm font-bold text-zinc-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full max-w-[1400px] mx-auto px-5 py-20 sm:px-8 sm:py-24 md:px-12 md:py-28">
        <div className="flex flex-col gap-6 sm:gap-8 md:gap-10 mb-12 sm:mb-14 md:mb-16 lg:mb-20">
          <div className={sectionHeader.labelClassName}>{t('home.learn_more')}</div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 sm:gap-8">
            <h2 className={sectionHeader.titleClassName}>核心功能</h2>
            <p className={sectionHeader.descClassName}>浏览服务器无需登录。发布资料、管理服务器和提交工单需要账号。</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 md:gap-12 lg:gap-16">
          {featureCards.map((f) => (
            <HomeFeatureCard
              key={f.tag}
              tag={f.tag}
              title={t(f.titleKey)}
              description={t(f.descKey)}
              variant={f.variant}
            />
          ))}
        </div>
      </section>

      <section className="w-full border-y border-zinc-200 bg-[#f5f5f2] px-5 py-20 sm:px-8 sm:py-24 md:px-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-10 max-w-2xl space-y-3 sm:mb-12">
            <h2 className={metricsHeader.titleClassName}>{metricsHeader.title}</h2>
            <p className={metricsHeader.descClassName}>{metricsHeader.desc}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-12 md:gap-x-8">
            {stats.map((s, index) => (
              <HomeStatCard
                key={s.label}
                label={t(s.label)}
                value={s.value}
                className={`${index < 4 ? 'md:col-span-3' : 'md:col-span-4'} ${index === stats.length - 1 ? 'col-span-2 md:col-span-4' : ''}`}
              />
            ))}
          </div>
        </div>
      </section>

      <HomeShowcase />
    </motion.div>
  );
};

export default Home;
