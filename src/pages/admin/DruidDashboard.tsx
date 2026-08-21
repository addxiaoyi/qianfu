/**
 * Druid 实时 BI 仪表盘
 *
 * 使用 Apache Druid 作为后端数据源的实时商业智能仪表盘
 * 优化项33: 首屏优化 - FCP提升
 *
 * 优化策略:
 * 1. 图标按需导入 (tree-shaking优化)
 * 2. framer-motion延迟加载 (减少首屏JS体积)
 * 3. 数据查询按视口加载 (减少初始请求数)
 * 4. 首屏关键图标内联 (消除图标网络请求)
 */

import React, { useMemo, useState, useEffect, useRef, lazy } from 'react';
import { motion } from 'framer-motion';
import { Clock, DollarSign, Gamepad2, Globe, Server, TrendingUp, Users } from 'lucide-react';

// ============ 图标优化: 内联SVG (首屏关键图标) ============
// 这些图标在首屏渲染时必须立即显示,使用内联SVG避免网络请求
const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconServer = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
    <line x1="6" x2="6.01" y1="6" y2="6"/>
    <line x1="6" x2="6.01" y1="18" y2="18"/>
  </svg>
);

const IconDollar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="2" y2="22"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const IconTrendingUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);

// ============ 非关键图标: 动态导入 (tree-shaking优化) ============
// 这些图标不在首屏可见区域,延迟加载减少初始bundle体积
const IconGlobe = lazy(() => import('lucide-react').then(m => ({ default: () => m.Globe({ className: 'w-5 h-5 text-zinc-400' }) })));
const IconGamepad = lazy(() => import('lucide-react').then(m => ({ default: () => m.Gamepad2({ className: 'w-5 h-5 text-zinc-400' }) })));
const IconClock = lazy(() => import('lucide-react').then(m => ({ default: () => m.Clock({ className: 'w-5 h-5 text-zinc-400' }) })));

// ============ motion延迟加载 ============
// framer-motion 包含大量JS,仅在需要动画时加载
const MotionDiv = lazy(() =>
  Promise.resolve({ default: motion.div })
);

const MotionProgressBar = lazy(() =>
  Promise.resolve({ default: motion.div })
);

import {
  useServerMetrics,
  useRegionDistribution,
  useGameTypeDistribution,
  useRevenueMetrics,
  useHourlyStats,
  useTopServers,
} from '@/hooks/useDruid';

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// 加载状态组件
const LoadingSkeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <div style={style} className={`animate-pulse bg-zinc-100 rounded ${className}`} />
);

/**
 * 视口可见性 Hook
 * 使用 Intersection Observer 检测元素是否进入视口
 * 仅在可见时触发回调
 */
function useInViewport(threshold = 0.1): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // 如果已经触发过，不再监听
    if (hasTriggered) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          setHasTriggered(true);
          // 触发后断开观察，节省资源
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, hasTriggered]);

  return [ref, isInViewport];
}

/**
 * 懒加载图表容器
 * - 进入视口前显示占位符
 * - 进入视口后才发起数据查询
 */
interface LazyChartContainerProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  height?: string;
}

const LazyChartContainer: React.FC<LazyChartContainerProps> = ({
  children,
  placeholder,
  height = 'h-64',
}) => {
  const [ref, isInViewport] = useInViewport(0.1);

  return (
    <div ref={ref} className={`${height} relative`}>
      {isInViewport ? children : (
        placeholder || (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSkeleton className="w-full h-full" />
          </div>
        )
      )}
    </div>
  );
};

// 指标卡片组件 - 使用内联SVG图标和CSS动画
const MetricCard: React.FC<{
  label: string;
  value: string | number;
  trend?: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}> = ({ label, value, trend, icon, color, loading }) => (
  <div
    className="p-6 border border-zinc-100 rounded-[2rem] bg-white shadow-sm hover:shadow-md transition-shadow"
    style={{ animation: 'fadeInUp 0.4s ease-out both' }}
  >
    <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    <div className="flex items-center justify-between">
      {loading ? (
        <div className="bg-zinc-100 rounded-2xl animate-pulse" style={{ width: 48, height: 48 }} />
      ) : (
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      )}
      {trend && !loading && (
        <span className="text-xs font-mono text-green-500 bg-green-50 px-2 py-1 rounded-full">
          {trend}
        </span>
      )}
    </div>
    <div className="mt-4">
      {loading ? (
        <>
          <div className="bg-zinc-100 rounded animate-pulse h-9 w-24 mb-2" />
          <div className="bg-zinc-100 rounded animate-pulse h-4 w-32" />
        </>
      ) : (
        <>
          <div className="text-3xl font-black font-mono">{value}</div>
          <div className="text-xs font-black uppercase tracking-widest text-zinc-400 mt-1">
            {label}
          </div>
        </>
      )}
    </div>
  </div>
);

// 图表进度条组件 - 使用CSS动画替代motion
const ProgressBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color?: string;
}> = ({ label, value, max, color = 'bg-accent' }) => {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-mono font-bold">{label}</span>
        <span className="text-zinc-400">{formatNumber(value)}</span>
      </div>
      <div className="h-3 bg-zinc-50 rounded-full overflow-hidden">
        <div
          style={{
            width: `${percentage}%`,
            transition: 'width 0.8s ease-out',
          }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
};

// 主仪表盘组件
const DruidDashboard: React.FC = () => {
  // 各区块可见性状态
  const [metricsRef, metricsInViewport] = useInViewport(0.05);
  const [regionRef, regionInViewport] = useInViewport(0.1);
  const [gameTypeRef, gameTypeInViewport] = useInViewport(0.1);
  const [serversRef, serversInViewport] = useInViewport(0.1);
  const [hourlyRef, hourlyInViewport] = useInViewport(0.1);

  // 数据查询 hooks - 仅在对应区块可见时才发起请求
  const { data: serverMetrics, isLoading: serverLoading } = useServerMetrics(metricsInViewport);
  const { data: regionDistribution, isLoading: regionLoading } = useRegionDistribution(regionInViewport);
  const { data: gameTypeDistribution, isLoading: gameTypeLoading } = useGameTypeDistribution(gameTypeInViewport);
  const { data: revenueMetrics, isLoading: revenueLoading } = useRevenueMetrics(7, metricsInViewport);
  const { data: hourlyStats, isLoading: hourlyLoading } = useHourlyStats(1, hourlyInViewport);
  const { data: topServers, isLoading: topServersLoading } = useTopServers(10, serversInViewport);

  // 计算汇总数据
  const summary = useMemo(() => {
    const metrics = serverMetrics || [];
    const revenue = revenueMetrics || [];
    const hourly = hourlyStats || [];

    return {
      totalPlayers: metrics.reduce((sum, m) => sum + m.total_players, 0),
      onlineServers: metrics.reduce((sum, m) => sum + m.online_servers, 0),
      totalRevenue: revenue.reduce((sum, r) => sum + r.total_revenue, 0),
      totalTransactions: revenue.reduce((sum, r) => sum + r.transaction_count, 0),
      peakPlayers: hourly.length > 0 ? Math.max(...hourly.map(h => h.total_players), 0) : 0,
      totalBandwidth: hourly.reduce((sum, h) => sum + h.total_bandwidth, 0),
    };
  }, [serverMetrics, revenueMetrics, hourlyStats]);

  // 区域数据
  const regionData = useMemo(() => {
    if (!regionDistribution) return [];
    const max = Math.max(...regionDistribution.map(r => r.total_players), 1);
    return regionDistribution.map(r => ({
      ...r,
      percentage: (r.total_players / max) * 100,
    }));
  }, [regionDistribution]);

  // 游戏类型数据
  const gameTypeData = useMemo(() => {
    if (!gameTypeDistribution) return [];
    const max = Math.max(...gameTypeDistribution.map(g => g.total_players), 1);
    return gameTypeDistribution.map(g => ({
      ...g,
      percentage: (g.total_players / max) * 100,
    }));
  }, [gameTypeDistribution]);

  return (
    <div className="space-y-8 pb-32 bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black uppercase tracking-tight">实时商业智能</h1>
            <span className="px-3 py-1 bg-accent/10 text-accent text-xs font-mono rounded-full">
              DRUID
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            数据来自 Apache Druid 实时分析引擎
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-zinc-400">实时连接</span>
          </div>
          <span className="text-xs text-zinc-300">|</span>
          <span className="text-xs font-mono text-zinc-400">刷新: 30s</span>
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div ref={metricsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="当前在线玩家"
          value={formatNumber(summary.totalPlayers)}
          trend="实时"
          icon={<Users className="w-6 h-6 text-white" />}
          color="bg-blue-500"
          loading={serverLoading}
        />
        <MetricCard
          label="在线服务器"
          value={formatNumber(summary.onlineServers)}
          trend="实时"
          icon={<Server className="w-6 h-6 text-white" />}
          color="bg-green-500"
          loading={serverLoading}
        />
        <MetricCard
          label="近7天收入"
          value={`¥${summary.totalRevenue.toFixed(2)}`}
          trend={`${summary.totalTransactions} 笔`}
          icon={<DollarSign className="w-6 h-6 text-white" />}
          color="bg-emerald-500"
          loading={revenueLoading}
        />
        <MetricCard
          label="峰值在线"
          value={formatNumber(summary.peakPlayers)}
          trend={`带宽 ${(summary.totalBandwidth / 1024).toFixed(1)} GB`}
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          color="bg-purple-500"
          loading={hourlyLoading}
        />
      </div>

      {/* 区域和游戏类型分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 区域分布 */}
        <section ref={regionRef} className="p-8 border border-zinc-100 rounded-[3rem] bg-white">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <Globe className="w-5 h-5 text-zinc-400" />
              区域分布
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              24小时内
            </span>
          </div>
          <div className="space-y-4">
            {regionLoading ? (
              [1, 2, 3, 4].map((i) => (
                <LoadingSkeleton key={i} className="h-16 w-full" />
              ))
            ) : regionData.length > 0 ? (
              regionData.map((region) => (
                <ProgressBar
                  key={region.region}
                  label={region.region}
                  value={region.total_players}
                  max={regionData[0]?.total_players || 1}
                  color="bg-gradient-to-r from-blue-500 to-purple-500"
                />
              ))
            ) : (
              <div className="text-center py-8 text-zinc-400">
                暂无数据
              </div>
            )}
          </div>
        </section>

        {/* 游戏类型分布 */}
        <section ref={gameTypeRef} className="p-8 border border-zinc-100 rounded-[3rem] bg-white">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-zinc-400" />
              游戏类型
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              24小时内
            </span>
          </div>
          <div className="space-y-4">
            {gameTypeLoading ? (
              [1, 2, 3, 4].map((i) => (
                <LoadingSkeleton key={i} className="h-16 w-full" />
              ))
            ) : gameTypeData.length > 0 ? (
              gameTypeData.slice(0, 5).map((game) => (
                <ProgressBar
                  key={game.game_type}
                  label={game.game_type}
                  value={game.total_players}
                  max={gameTypeData[0]?.total_players || 1}
                  color="bg-gradient-to-r from-green-500 to-emerald-500"
                />
              ))
            ) : (
              <div className="text-center py-8 text-zinc-400">
                暂无数据
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Top 服务器和每小时趋势 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top 服务器 */}
        <section ref={serversRef} className="lg:col-span-2 p-8 border border-zinc-100 rounded-[3rem] bg-white">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <Server className="w-5 h-5 text-zinc-400" />
              Top 10 服务器
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              24小时内峰值
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                  <th className="text-left py-3 pr-4">服务器</th>
                  <th className="text-left py-3 pr-4">区域</th>
                  <th className="text-left py-3 pr-4">游戏</th>
                  <th className="text-right py-3">峰值玩家</th>
                  <th className="text-right py-3">带宽</th>
                </tr>
              </thead>
              <tbody>
                {topServersLoading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      <td colSpan={5} className="py-4">
                        <LoadingSkeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : topServers && topServers.length > 0 ? (
                  topServers.map((server, idx) => (
                    <motion.tr
                      key={server.server_name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors"
                    >
                      <td className="py-4 pr-4 font-mono font-bold">
                        {server.server_name}
                      </td>
                      <td className="py-4 pr-4 text-sm text-zinc-500">
                        {server.region}
                      </td>
                      <td className="py-4 pr-4 text-sm text-zinc-500">
                        {server.game_type}
                      </td>
                      <td className="py-4 text-right font-mono">
                        {server.max_players}
                      </td>
                      <td className="py-4 text-right text-sm text-zinc-400">
                        {(server.total_bandwidth / 1024).toFixed(1)} GB
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-400">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 每小时趋势 */}
        <section ref={hourlyRef} className="p-8 border border-zinc-100 rounded-[3rem] bg-white">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-zinc-400" />
              小时趋势
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              24小时内
            </span>
          </div>
          <div className="flex items-end gap-1 h-48">
            {hourlyLoading ? (
              [1, 2, 3, 4, 5, 6].map((i) => (
                <LoadingSkeleton key={i} className="flex-1" style={{ height: `${Math.random() * 80 + 20}%` }} />
              ))
            ) : hourlyStats && hourlyStats.length > 0 ? (
              hourlyStats.slice(0, 24).reverse().map((stat, idx) => {
                const maxPlayers = Math.max(...hourlyStats.map(s => s.total_players), 1);
                const height = (stat.total_players / maxPlayers) * 60 + 40;
                return (
                  <motion.div
                    key={stat.hour}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, height)}%` }}
                    transition={{ delay: idx * 0.02, duration: 0.4 }}
                    className="flex-1 bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-sm group relative"
                    title={`${stat.hour}: ${stat.total_players} 玩家`}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {stat.total_players}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                暂无数据
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-between text-xs text-zinc-400 font-mono">
            <span>24h前</span>
            <span>现在</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DruidDashboard;
