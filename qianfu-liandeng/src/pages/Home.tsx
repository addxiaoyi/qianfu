import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion, useScroll, useSpring } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';
import HomeFeatureCard from '@/components/HomeFeatureCard';
import HomeStatCard from '@/components/HomeStatCard';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/request';
import { useBackendHealth } from '@/hooks/useBackendHealth';

interface ServerStats {
  onlineNodes: number;
  syncLatency: string;
  avgResponseTime: string;
  availability: string;
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
    tag: 'SEC_01',
  },
  {
    titleKey: 'home.feat.auction.title',
    descKey: 'home.feat.auction.desc',
    variant: 'spark',
    tag: 'SEC_02',
  },
  {
    titleKey: 'home.feat.support.title',
    descKey: 'home.feat.support.desc',
    variant: 'terminal',
    tag: 'SEC_03',
  },
];

const sectionHeader = {
  labelClassName: 'text-[10px] font-black uppercase tracking-[0.45em] italic text-accent',
  titleClassName: 'text-4xl md:text-5xl font-black tracking-tighter uppercase italic text-black',
  descClassName: 'text-base md:text-lg text-zinc-400 font-bold italic leading-relaxed max-w-2xl',
};

const ctaButtonBase =
  'group px-8 sm:px-12 py-5 sm:py-6 rounded-[2.5rem] font-black text-[11px] sm:text-[12px] uppercase tracking-[0.35em] sm:tracking-[0.5em] flex items-center justify-center gap-4 sm:gap-6 transition-all italic';


const metricsHeader = {
  label: '站点指标',
  title: '实时状态',
  desc: '这里展示公开列表和平台链路的当前状态，方便访客快速判断是否值得继续浏览。',
  labelClassName: 'text-[10px] font-black uppercase tracking-[0.45em] italic text-zinc-500',
  titleClassName: 'text-4xl md:text-5xl font-black tracking-tighter uppercase italic text-white',
  descClassName: 'text-base md:text-lg text-zinc-500 font-bold italic leading-relaxed max-w-2xl',
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

  const [heroLead = '', ...heroRest] = t('home.hero.title').split(' ');

  const { data: statsData, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['server-stats'],
    queryFn: () => request<ServerStats>('/servers/stats', { useAuth: false }),
    staleTime: 30_000,
    retry: 2,
  });

  const showDegradedState = backendDegraded || statsError;
  const showPendingState = !showDegradedState && (backendHealthLoading || statsLoading);

  const heroBadgeStates = heroSupportBadges.map((badge) => ({
    prefix: badge.prefix,
    value: t(showDegradedState ? badge.degradedKey : showPendingState ? badge.pendingKey : badge.healthyKey),
  }));

  const stats = [
    { label: 'home.stats.nodes' as const, value: statsLoading ? '—' : String(statsData?.onlineNodes ?? '—') },
    { label: 'home.stats.latency' as const, value: statsLoading ? '—' : String(statsData?.syncLatency ?? '—') },
    { label: 'home.stats.response' as const, value: statsLoading ? '—' : String(statsData?.avgResponseTime ?? '—') },
    { label: 'home.stats.availability' as const, value: statsLoading ? '—' : String(statsData?.availability ?? '—') },
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

      <section className="w-full relative overflow-hidden pt-36 sm:pt-40 md:pt-44 pb-44 sm:pb-52 md:pb-60 px-4 sm:px-6 flex flex-col items-center text-center border-b border-zinc-50">
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
          <motion.div variants={itemVariants} className="flex items-center gap-3 sm:gap-4 mb-10 sm:mb-12 md:mb-16">
            <div className="px-4 sm:px-5 py-2 border border-zinc-100 bg-white rounded-sm text-[9px] sm:text-[10px] font-black uppercase tracking-[0.32em] sm:tracking-[0.4em] italic shadow-xs">
              {t('home.protocol')}
            </div>
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-accent" />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-[3.3rem] sm:text-6xl md:text-[9rem] font-black mb-8 sm:mb-10 md:mb-12 tracking-tighter leading-[0.88] text-black uppercase italic"
          >
            {heroLead}.<br />
            <span className="text-zinc-200">{heroRest.join(' ')}</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg md:text-2xl text-zinc-400 max-w-2xl mb-10 sm:mb-12 md:mb-16 font-bold leading-relaxed italic px-2 sm:px-0"
          >
            {t('home.hero.subtitle')}
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto px-2 sm:px-0">
            <Link to="/servers" className={`${ctaButtonBase} btn-accent text-white shadow-2xl`}>
              {t('home.hero.explore')}
              <GeometricLantern variant="network" className="w-5 h-5 group-hover:translate-x-3 transition-transform" />
            </Link>
            <Link to="/promotion" className={`${ctaButtonBase} border border-zinc-100 bg-white text-black hover:bg-zinc-50`}>
              {t('home.hero.promote')}
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
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic">Minecraft 服务器发现、发布与支持</h2>
              <p className="text-sm sm:text-base text-zinc-500 font-medium leading-7">
                千服联灯面向中文 Minecraft 玩家和服主，提供公开服务器列表、搜索、资源中心、推广展示、工单支持和移动端入口。
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

      <section className="w-full max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12 py-28 sm:py-36 md:py-40 lg:py-48">
        <div className="flex flex-col gap-6 sm:gap-8 md:gap-10 mb-12 sm:mb-14 md:mb-16 lg:mb-20">
          <div className={sectionHeader.labelClassName}>{t('home.learn_more')}</div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 sm:gap-8">
            <h2 className={sectionHeader.titleClassName}>Core Features</h2>
            <p className={sectionHeader.descClassName}>探索、展示、管理与支持都放在同一条产品路径里，入口更清晰，动作更集中。</p>
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

      <section className="w-full bg-black py-32 sm:py-36 md:py-40 lg:py-48 px-5 sm:px-8 md:px-12 overflow-hidden relative">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />
        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="flex flex-col gap-6 sm:gap-8 md:gap-10 mb-12 sm:mb-14 md:mb-16 lg:mb-20">
            <div className={metricsHeader.labelClassName}>{metricsHeader.label}</div>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 sm:gap-8">
              <h2 className={metricsHeader.titleClassName}>{metricsHeader.title}</h2>
              <p className={metricsHeader.descClassName}>{metricsHeader.desc}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-12 lg:gap-24">
            {stats.map((s) => (
              <HomeStatCard key={s.label} label={t(s.label)} value={s.value} />
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default Home;
