import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import { isImageUrlSafe } from '@/utils/urlValidator';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { Link } from 'react-router-dom';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatListingPlanLabel, getListingStatus, getServerPlayersMax, getServerPlayersOnline, getServerThumbnail, getServerVersionLabel } from '@/utils/serverView';

import { useT } from '@/store/uiStore';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';

const getReviewTone = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'APPROVED') {
    return {
      text: 'text-green-500',
      label: 'APPROVED',
      icon: 'spark' as const,
    };
  }
  if (normalized === 'PENDING') {
    return {
      text: 'text-orange-500',
      label: 'PENDING',
      icon: 'activity' as const,
    };
  }
  return {
    text: 'text-red-500',
    label: normalized || 'UNKNOWN',
    icon: 'alert' as const,
  };
};

const MyServers: React.FC = () => {
  const t = useT();
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const { data: servers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my-servers'],
    queryFn: async () => {
      const useRustV2 = isRustV2Enabled();
      const response = await api.get<{ data?: any[]; meta?: Record<string, unknown> } | any[]>(
        useRustV2 ? rustV2Path('/servers/mine') : '/servers',
        undefined,
        useRustV2 ? rustV2RequestOptions : undefined,
      );
      const payload = response as { data?: unknown };
      return Array.isArray(response) ? response : Array.isArray(payload.data) ? payload.data : [];
    },
  });

  const removeServer = async (serverId: string | number) => {
    if (!window.confirm('确定删除这台服务器？删除后公开页面和关联域名解析都会移除。')) return;
    setDeletingId(serverId);
    try {
      const useRustV2 = isRustV2Enabled();
      await api.delete(
        useRustV2 ? rustV2Path(`/servers/${serverId}`) : `/servers/${serverId}`,
        useRustV2 ? rustV2RequestOptions : undefined,
      );
      await refetch();
      toast({ title: '服务器已删除', description: '关联的免费域名解析已进入清理队列。' });
    } catch (error) {
      toast({ variant: 'destructive', title: '删除失败', description: error instanceof Error ? error.message : '请稍后重试。' });
    } finally {
      setDeletingId(null);
    }
  };

  const emptyAction = (
    <div className="w-full max-w-3xl space-y-7">
      <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {[
          ['准备资料', '名称、地址、版本、玩法、简介与展示图片。'],
          ['提交审核', '平台检查内容真实性、安全性和合规情况。'],
          ['公开展示', '审核通过后长期进入服务器列表，推广套餐只影响推荐权重。'],
        ].map(([title, text], index) => (
          <div key={title} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-xs font-bold tabular-nums text-zinc-400">0{index + 1}</div>
            <div className="mt-3 text-sm font-bold text-zinc-900">{title}</div>
            <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">{text}</p>
          </div>
        ))}
      </div>
      <Link to="/editor" className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <GeometricLantern variant="spark" className="h-4 w-4" /> 发布第一台服务器
      </Link>
    </div>
  );

  return (
    <StatusWrapper
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && servers?.length === 0}
      onRetry={() => refetch()}
      emptyTitle="还没有发布服务器"
      emptyDescription="准备真实服务器资料并提交审核，通过后会进入公开列表。"
      emptyAction={emptyAction}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 bg-white space-y-8 sm:space-y-10">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-5 sm:gap-8">
          <div className="space-y-2">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight uppercase">{t('dash.servers.title')}</h2>
            <p className="text-zinc-500 text-sm sm:text-base max-w-2xl leading-7">Manage your node cluster / INFRA_CONTROL</p>
          </div>
          <Link 
            to="/editor" 
            className="w-full sm:w-auto px-6 sm:px-8 py-4 rounded-2xl bg-black text-white font-semibold text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] active:scale-[0.98]"
          >
            <GeometricLantern variant="spark" className="w-5 h-5" /> {t('dash.servers.broadcast')}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {servers.map((server: any) => (
            <div key={server.id} className="rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)] hover:border-zinc-300 transition-all">
              {(() => {
                const thumbnail = getServerThumbnail(server);
                const playersOnline = getServerPlayersOnline(server);
                const playersMax = getServerPlayersMax(server);
                const versionLabel = getServerVersionLabel(server);
                const review = getReviewTone(server.review_status || server.status);
                const reviewNotes = String(server.review_notes || '').trim();
                const listingPlan = formatListingPlanLabel(server.listing_plan);
                const listingStatus = getListingStatus(server);
                return (
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full min-w-0">
                  <div className="w-full sm:w-40 lg:w-44 h-28 sm:h-24 lg:h-28 rounded-[1.5rem] overflow-hidden flex items-center justify-center border border-zinc-100 shrink-0 bg-zinc-50 relative">
                     {thumbnail ? (
                       <img src={isImageUrlSafe(thumbnail) ? thumbnail : ''} alt={`${server.name || '服务器'} 展示图`} width={176} height={112} className="w-full h-full object-cover" />
                     ) : (
                       <GeometricLantern variant="network" className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-300" />
                     )}
                     <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse ${review.label === 'APPROVED' ? 'bg-green-500' : review.label === 'PENDING' ? 'bg-orange-400' : 'bg-red-400'}`} />
                  </div>
                  
                  <div className="space-y-4 flex-grow min-w-0 text-left">
                    <div className="space-y-2">
                      <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900">{server.name}</h3>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em]">
                        <span className={`flex items-center gap-2 ${review.text}`}>
                          <GeometricLantern variant={review.icon} className="w-4 h-4" />
                          {review.label === 'APPROVED'
                            ? t('dash.servers.status.approved')
                            : review.label === 'PENDING'
                              ? t('dash.servers.status.pending')
                              : t('dash.servers.status.rejected')}
                        </span>
                        <span className="text-zinc-300 font-mono tracking-[0.28em]">NODE_ADDR: {server.id}</span>
                        {server.ip || server.host ? <span className="text-zinc-300 font-mono tracking-[0.2em]">HOST: {server.ip || server.host}</span> : null}
                        <span className="text-zinc-300 font-mono tracking-[0.2em]">PLAN: {listingPlan}</span>
                      </div>
                      {reviewNotes ? (
                        <p className="text-xs font-semibold text-zinc-400 leading-6 max-w-3xl">REVIEW_NOTE: {reviewNotes}</p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
                       <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <GeometricLantern variant="user" className="w-4 h-4 text-zinc-400" />
                          <div className="flex flex-col min-w-0">
                             <span className="text-[10px] font-black text-zinc-400 uppercase leading-none tracking-widest">Users</span>
                             <span className="text-sm font-semibold text-zinc-900 mt-1">{playersMax ? `${playersOnline} / ${playersMax}` : String(playersOnline)}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-400" />
                          <div className="flex flex-col min-w-0">
                           <span className="text-[10px] font-black text-zinc-400 uppercase leading-none tracking-widest">推广状态</span>
                             <span className={`text-sm font-semibold mt-1 ${listingStatus.expired ? 'text-red-500' : 'text-zinc-900'}`}>{listingStatus.label}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <GeometricLantern variant="data" className="w-4 h-4 text-zinc-400" />
                          <div className="flex flex-col min-w-0">
                             <span className="text-[10px] font-black text-zinc-400 uppercase leading-none tracking-widest">Version</span>
                             <span className="text-sm font-semibold text-zinc-900 mt-1">{versionLabel}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex w-full lg:w-auto gap-3 sm:gap-4">
                  <Link 
                    to={`/editor?id=${server.id}`} 
                    className="flex-1 lg:flex-none px-5 sm:px-6 py-4 rounded-2xl bg-black text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">{t('common.edit')}</span>
                     <GeometricLantern variant="settings" className="w-5 h-5" />
                   </Link>
                   <button
                     type="button"
                     onClick={() => void removeServer(server.id)}
                     disabled={deletingId === server.id}
                     aria-label={`删除服务器 ${server.name || server.id}`}
                     className="inline-flex min-h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-100 text-red-500 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                   >
                     <Trash2 className="h-5 w-5" aria-hidden="true" />
                   </button>
                 </div>
              </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </StatusWrapper>
  );
};

export default MyServers;
