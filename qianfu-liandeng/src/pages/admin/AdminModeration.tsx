import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { formatDateTime } from '@/utils/serverView';

type ModerationLog = {
  id: number;
  action: string;
  content_type: string;
  content?: string | null;
  reason?: string | null;
  created_at?: string;
  user?: {
    username?: string | null;
  } | null;
};

type ModerationSettingsResponse = {
  configs: Array<{
    key: string;
    value: string;
    description?: string | null;
    updatedAt?: string;
  }>;
  stats: {
    total: number;
    rejected: number;
    last24h: number;
    passRate: string;
  };
};

const moderationBadge = 'CONTENT_SENTINEL / V2.0';
const adminShellClass = 'space-y-16 pb-32 bg-white';

const AdminModeration: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data: logs = [], isLoading: logsLoading, isError, refetch } = useQuery({
    queryKey: ['admin-moderation-logs'],
    queryFn: () => api.get<ModerationLog[]>('/admin/moderation/logs', { limit: 100 }),
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin-moderation-settings'],
    queryFn: () => api.get<ModerationSettingsResponse>('/admin/moderation/settings'),
  });

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((item) =>
      [item.action, item.content_type, item.content, item.reason, item.user?.username]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [logs, search]);

  const isLoading = logsLoading || settingsLoading;
  const moderationStats = settings?.stats;

  return (
    <div className={adminShellClass}>
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <AdminPageHeader
          badge={moderationBadge}
          title="Guard."
          description="内容审核页已切到真实日志与配置接口。现在展示真实审核记录、24 小时统计和当前配置项。"
          statusLabel={`24H ${moderationStats?.last24h ?? 0} / TOTAL ${moderationStats?.total ?? 0}`}
          statusTone={(moderationStats?.rejected ?? 0) > 0 ? 'warning' : 'success'}
          rightSlot={(
            <div className="flex gap-6">
              <div className="p-10 bg-zinc-50 border border-zinc-100 rounded-[3rem] flex items-center gap-8 shadow-xs">
                <div className="w-16 h-16 bg-white rounded-[2rem] flex items-center justify-center shadow-xs border border-zinc-100">
                  <GeometricLantern variant="activity" className="w-8 h-8 text-zinc-300" />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 italic">Pass Rate</div>
                  <div className="text-4xl font-black font-mono tracking-tighter italic">{moderationStats?.passRate ?? '—'}</div>
                </div>
              </div>
              <div className="p-10 bg-zinc-50 border border-zinc-100 rounded-[3rem] flex items-center gap-8 shadow-xs">
                <div className="w-16 h-16 bg-white rounded-[2rem] flex items-center justify-center shadow-xs border border-zinc-100">
                  <GeometricLantern variant="alert" className="w-8 h-8 text-zinc-300" />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 italic">Rejected</div>
                  <div className="text-4xl font-black font-mono tracking-tighter italic">{moderationStats?.rejected ?? 0}</div>
                </div>
              </div>
            </div>
          )}
        />

        <div className="flex flex-col md:flex-row items-center justify-between gap-10 pt-12 border-t border-zinc-50">
          <div className="space-y-2">
            <div className="text-[12px] font-black uppercase tracking-[0.4em] italic">Audit Queue</div>
            <div className="text-[9px] font-black font-mono tracking-widest text-zinc-400">REAL_LOGS / {filteredLogs.length}</div>
          </div>
          <div className="relative w-full md:w-[28rem] group">
            <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-accent transition-colors duration-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索动作、内容类型、原因或用户"
              className="w-full pl-20 pr-8 py-6 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] outline-hidden text-lg font-black italic transition-all duration-500 shadow-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {filteredLogs.length === 0 ? (
            <div className="py-36 border border-zinc-50 rounded-[5rem] bg-zinc-50/20 text-center border-dashed space-y-8">
              <GeometricLantern variant="security" className="w-14 h-14 text-zinc-300 mx-auto" />
              <div className="space-y-3">
                <p className="text-[12px] font-black text-zinc-400 uppercase tracking-[0.6em] italic">No Moderation Logs</p>
                <p className="text-sm font-bold text-zinc-400">当前没有匹配条件的真实审核日志。</p>
              </div>
            </div>
          ) : (
            filteredLogs.map((item, idx) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04, duration: 0.4 }} className="p-12 border border-zinc-50 rounded-[4rem] bg-white shadow-xs">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                  <div className="space-y-4 flex-grow">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="px-5 py-2 bg-zinc-50 rounded-sm text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 italic border border-zinc-100 shadow-xs">{item.action}</div>
                      <div className="px-5 py-2 bg-zinc-50 rounded-sm text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 italic border border-zinc-100 shadow-xs">{item.content_type}</div>
                    </div>
                    <div className="text-2xl font-black tracking-tight italic text-accent break-words">{item.content || '该日志未记录原始内容。'}</div>
                    <div className="text-sm font-bold text-zinc-500 leading-7">{item.reason || '无附加原因说明。'}</div>
                    <div className="flex flex-wrap items-center gap-8 text-[10px] font-black font-mono text-zinc-300 uppercase tracking-[0.3em] italic">
                      <span>USER: {item.user?.username || 'SYSTEM'}</span>
                      <span>TIME: {formatDateTime(item.created_at)}</span>
                      <span>LOG_ID: {item.id}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="p-12 border border-zinc-50 rounded-[4rem] bg-zinc-50/20 space-y-8 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-black uppercase tracking-[0.4em] italic">Current Config</h3>
            <div className="text-[9px] font-black font-mono tracking-widest text-zinc-400">{settings?.configs?.length ?? 0} ITEMS</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(settings?.configs ?? []).map((config) => (
              <div key={config.key} className="rounded-[2rem] bg-white border border-zinc-100 p-6 shadow-xs">
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400">{config.key}</div>
                <div className="mt-3 text-sm font-bold text-zinc-700 break-all">{config.value}</div>
                <div className="mt-2 text-xs text-zinc-400">{config.description || 'No description'}</div>
                <div className="mt-3 text-[10px] font-mono text-zinc-300">UPDATED {formatDateTime(config.updatedAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminModeration;
