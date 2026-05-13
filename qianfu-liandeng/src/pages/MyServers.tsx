import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import { isImageUrlSafe, isUrlSafe } from '@/utils/urlValidator';
import StatusWrapper from '@/components/StatusWrapper';
import { Link } from 'react-router-dom';
import GeometricLantern from '@/components/icons/GeometricLantern';

import { useT } from '@/store/uiStore';

const MyServers: React.FC = () => {
  const t = useT();
  const { data: servers, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-servers'],
    queryFn: () => api.get<any[]>('/me/servers'),
  });

  return (
    <StatusWrapper isLoading={isLoading} isError={isError} isEmpty={!isLoading && !isError && servers?.length === 0} onRetry={() => refetch()}>
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
          {servers?.map((server) => (
            <div key={server.id} className="rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)] hover:border-zinc-300 transition-all">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full min-w-0">
                  <div className="w-full sm:w-40 lg:w-44 h-28 sm:h-24 lg:h-28 rounded-[1.5rem] overflow-hidden flex items-center justify-center border border-zinc-100 shrink-0 bg-zinc-50 relative">
                     {server.image ? (
                       <img src={isImageUrlSafe(server.image) ? server.image : ''} className="w-full h-full object-cover" />
                     ) : (
                       <GeometricLantern variant="network" className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-300" />
                     )}
                     <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse" />
                  </div>
                  
                  <div className="space-y-4 flex-grow min-w-0 text-left">
                    <div className="space-y-2">
                      <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900">{server.name}</h3>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em]">
                        <span className={`flex items-center gap-2 ${
                          server.status === 'APPROVED' ? 'text-green-500' : 
                          server.status === 'PENDING' ? 'text-orange-500' : 'text-red-500'
                        }`}>
                          {server.status === 'APPROVED' ? <GeometricLantern variant="spark" className="w-4 h-4" /> : 
                           server.status === 'PENDING' ? <GeometricLantern variant="activity" className="w-4 h-4" /> : <GeometricLantern variant="alert" className="w-4 h-4" />}
                          {server.status === 'APPROVED' ? t('dash.servers.status.approved') : 
                           server.status === 'PENDING' ? t('dash.servers.status.pending') : t('dash.servers.status.rejected')}
                        </span>
                        <span className="text-zinc-300 font-mono tracking-[0.28em]">NODE_ADDR: {server.id}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
                       <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <GeometricLantern variant="user" className="w-4 h-4 text-zinc-400" />
                          <div className="flex flex-col min-w-0">
                             <span className="text-[10px] font-black text-zinc-400 uppercase leading-none tracking-widest">Users</span>
                             <span className="text-sm font-semibold text-zinc-900 mt-1">{server.players || '0 / 0'}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-400" />
                          <div className="flex flex-col min-w-0">
                             <span className="text-[10px] font-black text-zinc-400 uppercase leading-none tracking-widest">Uptime</span>
                             <span className="text-sm font-semibold text-zinc-900 mt-1">{server.uptime || '0.00%'}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <GeometricLantern variant="data" className="w-4 h-4 text-zinc-400" />
                          <div className="flex flex-col min-w-0">
                             <span className="text-[10px] font-black text-zinc-400 uppercase leading-none tracking-widest">Version</span>
                             <span className="text-sm font-semibold text-zinc-900 mt-1">{server.version || 'Unknown'}</span>
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
                  <button className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-zinc-100 bg-zinc-50 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white active:scale-[0.98]">
                    <GeometricLantern variant="alert" className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </StatusWrapper>
  );
};

export default MyServers;
