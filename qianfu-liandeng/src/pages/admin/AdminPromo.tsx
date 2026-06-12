import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminStatCard from '@/components/AdminStatCard';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const AdminPromo: React.FC = () => {
  const t = useT();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-promo-summary'],
    queryFn: () => api.get<any>('/promo/admin/summary'),
  });

  const metrics: { labelKey: TranslationKey; value: string; variant: any; color: string; trend: string; tag: string }[] = [
    { labelKey: 'admin.dash.metrics.users', value: String(data?.bindings ?? 0), variant: 'user', color: 'text-blue-500', trend: '平台绑定账号', tag: 'PROMO_01' },
    { labelKey: 'admin.dash.metrics.servers', value: String(data?.tasks ?? 0), variant: 'network', color: 'text-green-500', trend: '任务总数', tag: 'PROMO_02' },
    { labelKey: 'admin.dash.metrics.review', value: String(data?.pending ?? 0), variant: 'security', color: 'text-orange-500', trend: '待审核领取', tag: 'PROMO_03' },
    { labelKey: 'admin.dash.metrics.tickets', value: String(data?.rewarded ?? 0), variant: 'activity', color: 'text-accent', trend: '已发放奖励', tag: 'PROMO_04' },
  ];

  return (
    <div className="space-y-16 pb-32 bg-white selection:bg-accent selection:text-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <AdminPageHeader
          badge="PROMO_CENTER / REWARD MATRIX"
          title="推广激励中心"
          description="管理 B 站三连、点赞、关注等推广任务。管理员可配置任务规则，用户绑定账号后自动校验并发放余额奖励。"
          statusLabel="Reward Engine: ONLINE"
          rightSlot={(
            <>
              <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[220px] space-y-2 shadow-xs group hover:bg-white hover:border-accent transition-all duration-700">
                <div className="flex items-center gap-3">
                  <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-200 group-hover:text-accent transition-colors" />
                  <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic group-hover:text-accent transition-colors">奖励引擎</div>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-5xl font-black font-mono italic tracking-tighter break-words">{data?.tasks ?? 0}<span className="text-xs text-zinc-300 ml-2">tasks</span></div>
              </div>
              <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[220px] space-y-2 shadow-xs group hover:bg-white hover:border-accent transition-all duration-700">
                <div className="flex items-center gap-3">
                  <GeometricLantern variant="spark" className="w-4 h-4 text-zinc-200 group-hover:text-accent transition-colors" />
                  <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic group-hover:text-accent transition-colors">发放成功</div>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-5xl font-black font-mono text-green-600 tracking-tighter italic break-words">{data?.rewarded ?? 0}</div>
              </div>
            </>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-10">
          {metrics.map((stat, idx) => (
            <AdminStatCard
              key={stat.tag}
              tag={stat.tag}
              value={stat.value}
              label={t(stat.labelKey)}
              variant={stat.variant}
              colorClassName={stat.color}
              trend={stat.trend}
              delay={idx * 0.08}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-16">
          <section className="xl:col-span-8 space-y-12">
            <div className="flex items-center justify-between border-b border-zinc-50 pb-6">
              <h3 className="text-[12px] font-black font-mono uppercase tracking-[0.5em] text-zinc-300 flex items-center gap-4 italic">
                <div className="w-3 h-3 rounded-full bg-accent animate-pulse shadow-accent/20" />
                推广任务操作建议
              </h3>
              <button type="button" className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] hover:text-accent transition-all flex items-center gap-3 italic">
                查看接口 <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-zinc-50 rounded-[4rem] overflow-hidden bg-white divide-y divide-zinc-50 shadow-xs">
              {[
                {
                  title: '创建任务',
                  desc: '配置目标视频、奖励金额、动作规则、领取限制和有效期。',
                  action: 'POST /api/v1/promo/tasks',
                  variant: 'spark',
                },
                {
                  title: '绑定账号',
                  desc: '用户绑定 B 站 UID 后，系统才能校验真实行为。',
                  action: 'POST /api/v1/promo/bindings',
                  variant: 'user',
                },
                {
                  title: '领取并校验',
                  desc: '提交领取后，按任务规则自动判断是否通过并发放余额。',
                  action: 'POST /api/v1/promo/claims',
                  variant: 'security',
                },
                {
                  title: '审核发放',
                  desc: '需要人工审核的任务可由管理员审批后补发奖励。',
                  action: 'POST /api/v1/promo/claims/:id/approve',
                  variant: 'activity',
                },
              ].map((item, index) => (
                <div key={item.title} className="px-12 py-10 flex items-center justify-between gap-10 hover:bg-zinc-50/60 transition-all duration-500">
                  <div className="flex items-center gap-8">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-zinc-50 flex items-center justify-center shadow-sm border border-zinc-100">
                      <GeometricLantern variant={item.variant as any} className="w-7 h-7 text-zinc-300" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-[15px] font-black text-zinc-500 uppercase italic tracking-tight leading-tight">{item.title}</div>
                      <div className="text-[11px] font-medium text-zinc-400 leading-6 max-w-2xl">{item.desc}</div>
                    </div>
                  </div>
                  <div className="shrink-0 px-5 py-2 bg-zinc-100 rounded-sm text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">
                    {item.action}
                  </div>
                  {index === 0 && <motion.div layoutId="promo-guide" className="hidden" />}
                </div>
              ))}
            </div>
          </section>

          <aside className="xl:col-span-4 space-y-12">
            <div className="p-12 border border-zinc-50 rounded-[4rem] bg-zinc-50/20 space-y-12 group hover:border-accent hover:bg-white hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-6">
                <h4 className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">状态概览</h4>
                <GeometricLantern variant="security" className="w-5 h-5 text-zinc-200 group-hover:text-accent transition-colors" />
              </div>
              <div className="space-y-6">
                <div className="flex justify-between items-center px-4 py-6 bg-white rounded-[2rem] shadow-xs border border-zinc-100/50">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">待审核</span>
                  <span className="text-[10px] font-black font-mono text-orange-500 italic">{data?.pending ?? 0}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-6 bg-white rounded-[2rem] shadow-xs border border-zinc-100/50">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">已拒绝</span>
                  <span className="text-[10px] font-black font-mono text-zinc-400 italic">{data?.rejected ?? 0}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-6 bg-white rounded-[2rem] shadow-xs border border-zinc-100/50">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">任务总数</span>
                  <span className="text-[10px] font-black font-mono text-blue-500 italic">{data?.tasks ?? 0}</span>
                </div>
              </div>
              <button type="button" className="w-full py-8 btn-accent rounded-[3rem] text-[10px] font-black uppercase tracking-[0.4em] italic shadow-2xl shadow-accent/20 transition-all duration-500 active:scale-95">
                新建推广任务
              </button>
            </div>

            <div className="p-12 border border-zinc-50 rounded-[4rem] bg-accent text-white space-y-12 relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 opacity-10 group-hover:rotate-45 transition-transform duration-1000">
                <GeometricLantern variant="spark" className="w-48 h-48" />
              </div>
              <div className="space-y-4 relative z-10">
                <h4 className="text-[11px] font-black uppercase tracking-[0.4em] italic text-white/50">建议流程</h4>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase italic tracking-tighter leading-none break-words">绑定账号 → 校验行为 → 自动发奖</div>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden relative z-10">
                <motion.div initial={{ width: 0 }} animate={{ width: '70%' }} transition={{ duration: 2, delay: 0.5 }} className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest italic text-white/40 leading-relaxed relative z-10 break-words">
                当前页面是推广激励中心的总览页，后续可继续拆分任务列表、审核列表和创建表单。
              </p>
            </div>
          </aside>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminPromo;
