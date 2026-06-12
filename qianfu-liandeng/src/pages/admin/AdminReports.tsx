import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Search } from 'lucide-react';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import { toast } from '@/hooks/use-toast';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/serverView';

type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

type ReportItem = {
  id: number;
  reporter_id: number;
  target_type: string;
  target_id: number;
  reason: string;
  description?: string | null;
  status: ReportStatus;
  resolution_notes?: string | null;
  handler_id?: number | null;
  created_at?: string;
  updated_at?: string;
  reporter?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
  handler?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};

const statusLabelMap: Record<'pending' | 'resolved' | 'all', string> = {
  pending: '待处理',
  resolved: '已归档',
  all: '全部案件',
};

const reportTone: Record<ReportStatus, string> = {
  PENDING: 'bg-orange-50 text-orange-600 border-orange-200',
  REVIEWING: 'bg-blue-50 text-blue-600 border-blue-200',
  RESOLVED: 'bg-green-50 text-green-600 border-green-200',
  REJECTED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const AdminReports: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved' | 'all'>('pending');
  const [search, setSearch] = useState('');

  const { data: reports = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => api.get<ReportItem[]>('/reports', { limit: 100 }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ReportStatus }) =>
      api.patch(`/reports/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      toast({ title: '举报状态已更新' });
    },
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      const matchTab =
        activeTab === 'all'
          ? true
          : activeTab === 'pending'
            ? report.status === 'PENDING' || report.status === 'REVIEWING'
            : report.status === 'RESOLVED' || report.status === 'REJECTED';
      if (!matchTab) return false;
      if (!query) return true;
      return [report.reason, report.description, report.reporter?.username, String(report.target_id)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [activeTab, reports, search]);

  const pendingCount = reports.filter((report) => report.status === 'PENDING' || report.status === 'REVIEWING').length;
  const resolvedCount = reports.filter((report) => report.status === 'RESOLVED' || report.status === 'REJECTED').length;

  return (
    <div className="space-y-16 pb-32 bg-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <AdminPageHeader
          badge="举报处理 / 实时数据"
          title="举报管理"
          description="审阅违规举报并记录处置结果。这里现在只展示真实举报数据，不再显示伪造案件。"
          statusLabel={`待处理 ${pendingCount} / 已归档 ${resolvedCount}`}
          statusTone={pendingCount > 0 ? 'warning' : 'success'}
          rightSlot={(
            <div className="p-10 bg-zinc-50 border border-zinc-100 rounded-[3rem] flex items-center gap-10 shadow-xs">
              <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center border border-zinc-100 shadow-xs">
                <GeometricLantern variant="alert" className="w-10 h-10 text-zinc-400" />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 italic">待处理队列</div>
                <div className="text-4xl font-black font-mono tracking-tighter italic leading-none">{pendingCount}</div>
              </div>
            </div>
          )}
        />

        <div className="flex flex-col xl:flex-row items-center justify-between gap-10 pt-12 border-t border-zinc-50">
          <div className="flex gap-16 overflow-x-auto no-scrollbar w-full xl:w-auto">
            {[
              { id: 'pending' as const, label: '待处理', tag: `JUS_01 / ${pendingCount}` },
              { id: 'resolved' as const, label: '已归档', tag: `JUS_02 / ${resolvedCount}` },
              { id: 'all' as const, label: '全部案件', tag: `JUS_ALL / ${reports.length}` },
            ].map((tab) => (
              <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-start gap-3 pb-10 transition-all relative group ${activeTab === tab.id ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
                <span className="text-[12px] font-black uppercase tracking-[0.4em] italic">{tab.label}</span>
                <span className="text-[9px] font-black font-mono tracking-widest text-zinc-400">{tab.tag}</span>
                {activeTab === tab.id && <motion.div layoutId="report-tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent" />}
              </button>
            ))}
          </div>
          <div className="relative w-full xl:w-[36rem] group">
            <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-accent transition-colors duration-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索举报原因、举报人或目标 ID"
              className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] outline-hidden text-lg font-black italic transition-all duration-500 shadow-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-36 border border-zinc-50 rounded-[5rem] bg-zinc-50/20 text-center border-dashed space-y-8">
                <AlertCircle className="w-14 h-14 text-zinc-300 mx-auto" />
                <div className="space-y-3">
                  <p className="text-[12px] font-black text-zinc-400 uppercase tracking-[0.6em] italic">当前没有举报</p>
                  <p className="text-sm font-bold text-zinc-400">{statusLabelMap[activeTab]}范围内暂无真实举报记录。</p>
                </div>
              </motion.div>
            ) : (
              filtered.map((report, idx) => (
                <motion.div key={report.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04, duration: 0.4 }} className="p-16 border border-zinc-50 rounded-[5rem] bg-white flex flex-col xl:flex-row xl:items-center justify-between gap-16 shadow-xs relative overflow-hidden">
                  <div className={cn('absolute left-0 top-0 w-2 h-full rounded-l-[5rem]', report.status === 'PENDING' ? 'bg-orange-400' : report.status === 'REVIEWING' ? 'bg-blue-400' : report.status === 'RESOLVED' ? 'bg-green-500' : 'bg-zinc-200')} />
                  <div className="space-y-8 flex-grow pl-6">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className={cn('px-5 py-2 rounded-sm text-[10px] font-black uppercase tracking-[0.4em] italic border shadow-xs', reportTone[report.status])}>
                        {report.status}
                      </div>
                      <div className="text-[10px] font-black font-mono text-zinc-300 uppercase tracking-[0.3em] italic">
                        CASE #{report.id} / TARGET {report.target_type} #{report.target_id}
                      </div>
                    </div>
                    <h3 className="text-4xl font-black tracking-tighter uppercase italic leading-none text-accent">{report.reason}</h3>
                    {report.description ? (
                      <p className="text-base font-bold text-zinc-500 leading-7 max-w-4xl">{report.description}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-10 text-[10px] font-black font-mono text-zinc-300 uppercase tracking-[0.3em] italic">
                      <span className="flex items-center gap-3"><GeometricLantern variant="user" className="w-4 h-4" /> 举报人：{report.reporter?.display_name || report.reporter?.username || `USER_${report.reporter_id}`}</span>
                      <span className="flex items-center gap-3"><GeometricLantern variant="activity" className="w-4 h-4" /> 创建时间：{formatDateTime(report.created_at)}</span>
                      <span className="flex items-center gap-3"><GeometricLantern variant="terminal" className="w-4 h-4" /> 更新时间：{formatDateTime(report.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {report.status === 'PENDING' || report.status === 'REVIEWING' ? (
                      <>
                        <button type="button"
                          onClick={() => resolveMutation.mutate({ id: report.id, status: 'REJECTED' })}
                          disabled={resolveMutation.isPending}
                          className="w-20 h-20 flex items-center justify-center border border-zinc-100 rounded-[2rem] hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all duration-500 shadow-xs active:scale-[0.95]"
                          title="驳回案件"
                        >
                          <GeometricLantern variant="alert" className="w-8 h-8 text-zinc-300" />
                        </button>
                        <button type="button"
                          onClick={() => resolveMutation.mutate({ id: report.id, status: 'RESOLVED' })}
                          disabled={resolveMutation.isPending}
                          className="px-10 py-6 btn-accent rounded-[2.5rem] transition-all duration-500 shadow-2xl shadow-accent/20 flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.4em] italic active:scale-[0.98] disabled:opacity-50"
                        >
                          <GeometricLantern variant="security" className="w-5 h-5" /> 结案
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-green-600 bg-green-50 px-8 py-5 rounded-[2rem] border border-green-100 italic shadow-xs">
                        <GeometricLantern variant="spark" className="w-5 h-5" /> 已记录处理结果
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminReports;
