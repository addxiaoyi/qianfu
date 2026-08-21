import { safeJsonParse } from '@/utils/json';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/ui/StatusWrapper';
import AdminPageHeader from '@/components/ui/AdminPageHeader';

import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { formatLogTime, formatLogTimestamp } from './adminLogTime';

const logsBadge = 'SYSTEM_IMMUTABLE_LEDGER';
const adminShellClass = 'space-y-16 pb-32 bg-white';
const normalizeLogs = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.logs)) return value.logs;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

const getLogTime = (log: any) => log.timestamp || log.time || log.created_at || log.createdAt;
const getLogAction = (log: any) => String(log.action || 'UNKNOWN');
const getLogActor = (log: any) => log.admin?.username || log.username || log.user?.username || 'SYSTEM';
const getLogIp = (log: any) => log.ip || log.ipAddress || log.ip_address || '--';
const getLogPayload = (log: any) => log.details ?? {
  path: log.path,
  method: log.method,
  statusCode: log.statusCode,
  errorMessage: log.errorMessage,
  sessionId: log.sessionId,
};

// Sensitive field names that must be redacted in log output
const SENSITIVE_KEYS = new Set([
  'password', 'passwd', 'secret', 'key', 'token', 'api_key', 'apikey',
  'private_key', 'privatekey', 'access_key', 'accessToken', 'refreshToken',
  'authorization', 'cookie', 'credit_card', 'cc_number', 'ssn', 'secret_key',
]);

function redactDetails(details: any): string {
  if (!details) return '';
  try {
    const obj = typeof details === 'string' ? safeJsonParse(details, {}) : details;
    if (Array.isArray(obj)) {
      return JSON.stringify(obj.map(item => redactObject(item)), null, 2);
    }
    if (obj && typeof obj === 'object') {
      return JSON.stringify(redactObject(obj), null, 2);
    }
    return String(details);
  } catch {
    return String(details);
  }
}

function redactObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('password')) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const AdminLogs: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [dangerOnly, setDangerOnly] = React.useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => api.get<any>('/port5555/logs'),
  });

  const logs = React.useMemo(() => normalizeLogs(data), [data]);
  const logCount = logs?.length ?? 0;
  const filteredLogs = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (logs ?? []).filter((log: any) => {
      const action = getLogAction(log);
      const isDanger = action.includes('DELETE') || action.includes('REJECT') || action.includes('BANNED') || action.includes('DENIED') || action.includes('FAILED');
      if (dangerOnly && !isDanger) return false;
      if (!keyword) return true;
      const searchable = [
        getLogActor(log),
        action,
        getLogIp(log),
        log.path,
        log.method,
        redactDetails(getLogPayload(log)),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [dangerOnly, logs, search]);
  const visibleCount = filteredLogs.length;
  const statusLabel = isLoading ? '审计记录加载中' : `已加载 ${logCount} 条记录`;

  return (
    <div className={adminShellClass}>
      <AdminPageHeader
        badge={logsBadge}
        title="审计。"
        description="全量操作留痕，按管理员、来源地址、动作和载荷快速检索后台访问记录。"
        statusLabel={statusLabel}
        statusTone={isError ? 'danger' : 'success'}
        rightSlot={(
          <div className="p-10 bg-accent text-white rounded-[3rem] flex items-center gap-10 shadow-2xl shadow-accent/20 transition-all duration-700 group cursor-default">
            <div className="w-20 h-20 bg-accent-medium/30 rounded-[2rem] flex items-center justify-center border border-white/10 shadow-inner group-hover:rotate-12 transition-transform duration-700">
               <GeometricLantern variant="security" className="w-10 h-10 text-green-500" />
            </div>
            <div className="space-y-2">
               <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500 italic">记录数量</div>
               <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tighter uppercase italic leading-none break-words">{visibleCount}</div>
            </div>
          </div>
        )}
      />

      {/* Audit control tools */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-10 pt-12 border-t border-zinc-50">
         <div className="flex gap-4 w-full xl:w-auto">
            <div className="px-8 py-4 bg-zinc-50/50 rounded-full border border-zinc-50 flex items-center gap-4 shadow-xs">
               <GeometricLantern variant="data" className="w-4 h-4 text-zinc-300" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 italic">归档区：v2.4</span>
            </div>
            <div className="px-8 py-4 bg-zinc-50/50 rounded-full border border-zinc-50 flex items-center gap-4 shadow-xs">
               <GeometricLantern variant="activity" className="w-4 h-4 text-green-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 italic">{isLoading ? '加载中' : '数据已加载'}</span>
            </div>
            <button type="button" onClick={() => setDangerOnly((value) => !value)} className={`px-8 py-4 bg-white hover:bg-zinc-50 rounded-full border flex items-center gap-4 shadow-xs transition-all italic active:scale-95 group ${dangerOnly ? 'border-accent text-accent' : 'border-zinc-100'}`}>
               <GeometricLantern variant="settings" className="w-4 h-4 text-zinc-500 group-hover:text-accent transition-colors" />
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 group-hover:text-accent transition-colors">{dangerOnly ? '仅风险' : '筛选'}</span>
            </button>
         </div>

         <div className="relative w-full xl:w-[40rem] group">
             <GeometricLantern variant="terminal" className="absolute left-10 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 group-focus-within:text-accent transition-all duration-500" />
            <input 
               type="text" 
               aria-label="搜索审计日志"
               placeholder="按管理员、IP 或操作类型搜索" 
               value={search}
               onChange={(event) => setSearch(event.target.value)}
               className="w-full pl-24 pr-10 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] outline-hidden text-lg font-black italic transition-all duration-500 shadow-xs" 
            />
         </div>
      </div>

      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="border border-zinc-50 rounded-[5rem] overflow-hidden bg-white shadow-xs group/table hover:border-zinc-100 transition-all duration-1000">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                   <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 italic">时间</th>
                   <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 italic">操作人</th>
                   <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 italic">动作</th>
                   <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 italic">来源 IP</th>
                   <th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 italic">数据载荷</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                <AnimatePresence mode="popLayout">
                  {filteredLogs.map((log: any, idx: number) => (
                    <motion.tr 
                      key={log.id} 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.5 }}
                      className="group hover:bg-zinc-50/50 transition-all duration-500"
                    >
                      <td className="px-16 py-10 whitespace-nowrap">
                         <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <GeometricLantern variant="terminal" className="w-3.5 h-3.5 text-zinc-500 group-hover:text-accent transition-colors" />
                                <p className="text-xs font-black italic text-zinc-700 group-hover:text-accent transition-colors">{formatLogTime(getLogTime(log))}</p>
                            </div>
                             <p className="text-[9px] text-zinc-500 font-black font-mono tracking-tighter pl-6"># {formatLogTimestamp(getLogTime(log))}</p>
                         </div>
                      </td>
                      <td className="px-16 py-10">
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-[1rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-200 group-hover:bg-accent group-hover:text-white group-hover:rotate-6 transition-all duration-700 shadow-xs">
                               <GeometricLantern variant="user" className="w-6 h-6" />
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic leading-none block">管理员账号</span>
                               <span className="text-sm font-black uppercase tracking-tight italic group-hover:translate-x-1 transition-transform inline-block">{getLogActor(log)}</span>
                            </div>
                         </div>
                      </td>
                      <td className="px-16 py-10">
                         <div className="flex items-center gap-4">
                            <span className={`inline-block px-5 py-2 rounded-sm text-[10px] font-black uppercase tracking-[0.3em] italic border transition-all duration-700 ${
                               getLogAction(log).includes('DELETE') || getLogAction(log).includes('REJECT') || getLogAction(log).includes('BANNED')
                               ? 'bg-red-500 text-white border-red-500 shadow-2xl shadow-red-500/20' 
                               : 'bg-accent text-white border-accent shadow-accent/10 group-hover:bg-accent-medium'
                            }`}>
                               {getLogAction(log)}
                            </span>
                         </div>
                      </td>
                      <td className="px-16 py-10">
                          <div className="flex items-center gap-4 text-xs font-black font-mono text-zinc-700 uppercase tracking-tighter group-hover:text-zinc-900 transition-colors italic">
                            <GeometricLantern variant="network" className="w-4 h-4 opacity-50 group-hover:text-accent transition-colors" /> {getLogIp(log)}
                         </div>
                      </td>
                      <td className="px-16 py-10 max-w-sm">
                         <div className="p-5 bg-zinc-50/50 rounded-[1.5rem] border border-transparent group-hover:border-zinc-100 group-hover:bg-white transition-all duration-700 shadow-xs relative overflow-hidden">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                               <GeometricLantern variant="terminal" className="w-4 h-4 text-zinc-300" />
                            </div>
                             <code className="text-[11px] text-zinc-700 group-hover:text-zinc-900 line-clamp-2 break-all font-mono leading-relaxed italic block pr-6">
                              {redactDetails(getLogPayload(log))}
                            </code>
                         </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          
          {(filteredLogs.length === 0 || !logs) && !isLoading && (
             <div className="py-48 text-center space-y-10 group/empty">
                <div className="relative inline-block">
                   <GeometricLantern variant="data" className="w-24 h-24 text-zinc-50 mx-auto transition-all duration-1000 group-hover/empty:scale-110 group-hover/empty:text-accent" />
                   <div className="absolute inset-0 w-24 h-24 text-zinc-100 opacity-20 animate-ping border border-current rounded-full" />
                </div>
                <div className="space-y-4">
                    <p className="text-[12px] font-black text-zinc-600 uppercase tracking-[0.6em] italic leading-none group-hover/empty:text-accent transition-colors">当前没有匹配记录</p>
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">调整搜索关键词或关闭风险筛选后重试</p>
                </div>
             </div>
          )}
        </div>
      </StatusWrapper>

      {/* Floating Audit Status */}
      <div className="fixed bottom-12 right-12 z-[100] flex flex-col gap-4">
         <motion.div 
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           className="px-8 py-5 bg-accent text-white rounded-[2rem] shadow-2xl border border-white/10 flex items-center gap-6 group hover:translate-x-[-10px] transition-all duration-500"
         >
            <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
               <GeometricLantern variant="terminal" className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
            <div className="space-y-0.5">
               <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">审计状态</div>
               <div className="text-sm font-black uppercase italic tracking-[0.2em]">{isLoading ? '加载中' : `${visibleCount} 条可见`}</div>
            </div>
         </motion.div>
      </div>
    </div>
  );
};

export default AdminLogs;
