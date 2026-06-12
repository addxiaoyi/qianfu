import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { formatDateTime, parseListField } from '@/utils/serverView';

type ReviewStatus = 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION' | 'PENDING';

type PendingServer = {
  id: number;
  name: string;
  summary?: string | null;
  ip?: string | null;
  supported_versions?: string | null;
  review_status: string;
  created_at?: string;
  owner?: {
    username?: string | null;
    email?: string | null;
  } | null;
};

type ReviewStats = {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  totalTodayReviews: number;
  userReviewsToday: number;
};

const reviewBadge = 'MODERATION_NODE / DELTA-0';

const AdminReview: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedAudit, setSelectedAudit] = useState<PendingServer | null>(null);
  const [notes, setNotes] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState<'approve' | 'reject' | null>(null);

  const { data: audits = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-review'],
    queryFn: () => api.get<PendingServer[]>('/review/pending', { limit: 100 }),
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-review-stats'],
    queryFn: () => api.get<ReviewStats>('/review/stats'),
  });

  const actionMutation = useMutation({
    mutationFn: ({ serverId, status, reviewNotes }: { serverId: number; status: ReviewStatus; reviewNotes?: string }) =>
      api.post(`/review/${serverId}`, { status, notes: reviewNotes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-review'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-review-stats'] });
      toast({ title: '审核状态已更新' });
      setIsDialogOpen(null);
      setSelectedAudit(null);
      setNotes('');
    },
  });

  const displayStats = useMemo(() => ({
    pending: stats?.totalPending ?? audits.length,
    approved: stats?.totalApproved ?? 0,
    rejected: stats?.totalRejected ?? 0,
    today: stats?.totalTodayReviews ?? 0,
  }), [audits.length, stats]);

  return (
    <div className="space-y-16 pb-32 bg-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <AdminPageHeader
          badge={reviewBadge}
          title="服务器审核"
          description="服务器审核页已切换到真实 `/review/*` 接口。这里只显示真实待审服务器，不再展示伪造节点和虚构探针数据。"
          statusLabel={`待审核 ${displayStats.pending}`}
          statusTone={displayStats.pending > 0 ? 'warning' : 'success'}
          rightSlot={(
            <>
              <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[200px] space-y-2 shadow-xs">
                <div className="flex items-center gap-3">
                  <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-300" />
                  <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">今日已审</div>
                </div>
                <div className="text-5xl font-black font-mono italic tracking-tighter">{displayStats.today}<span className="text-xs text-zinc-300 ml-2">项</span></div>
              </div>
              <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[200px] space-y-2 shadow-xs">
                <div className="flex items-center gap-3">
                  <GeometricLantern variant="security" className="w-4 h-4 text-zinc-300" />
                  <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">通过 / 驳回</div>
                </div>
                <div className="text-3xl font-black font-mono tracking-tighter italic">{displayStats.approved} / {displayStats.rejected}</div>
              </div>
            </>
          )}
        />

        <div className="space-y-12">
          <AnimatePresence mode="popLayout">
            {audits.map((audit, idx) => {
              const versions = parseListField(audit.supported_versions);
              return (
                <motion.div
                  key={audit.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.4 }}
                  className="p-16 border border-zinc-50 rounded-[5rem] bg-white group hover:border-zinc-200 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 shadow-xs relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-3 h-full bg-orange-300 group-hover:bg-accent transition-colors duration-700" />
                  <div className="flex flex-col 3xl:flex-row gap-20">
                    <div className="flex flex-col xl:flex-row gap-16 flex-grow">
                      <div className="w-48 h-48 bg-zinc-50 rounded-[4rem] flex items-center justify-center text-zinc-100 border border-transparent group-hover:bg-accent group-hover:text-white group-hover:rotate-6 transition-all duration-1000 shadow-xs relative overflow-hidden shrink-0">
                        <GeometricLantern variant="terminal" className="w-20 h-20 relative z-10" />
                      </div>

                      <div className="space-y-8 flex-grow">
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-6">
                            <h3 className="text-5xl font-black tracking-tighter uppercase italic leading-none text-accent group-hover:translate-x-2 transition-transform duration-700">{audit.name}</h3>
                            <div className="flex items-center gap-3 px-4 py-1.5 bg-accent text-white rounded-sm text-[11px] font-black font-mono shadow-2xl shadow-accent/20 italic">
                              <GeometricLantern variant="terminal" className="w-4 h-4" /> SERVER_{audit.id}
                            </div>
                            <div className="px-4 py-1.5 border border-zinc-100 text-zinc-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] italic bg-zinc-50/50">
                              {versions[0] || '版本未填'}
                            </div>
                          </div>
                          <p className="text-base font-bold text-zinc-500 max-w-3xl leading-relaxed italic border-l-2 border-zinc-50 pl-8">{audit.summary || '该服务器尚未填写详细简介。'}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
                          <div className="flex items-center gap-6 p-6 bg-zinc-50/30 rounded-[2.5rem] border border-transparent shadow-xs">
                            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                              <GeometricLantern variant="user" className="w-6 h-6" />
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">提交用户</div>
                              <div className="text-lg font-black uppercase italic tracking-tight">{audit.owner?.username || 'UNKNOWN'}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 p-6 bg-zinc-50/30 rounded-[2.5rem] border border-transparent shadow-xs">
                            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                              <GeometricLantern variant="network" className="w-6 h-6" />
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">服务器地址</div>
                              <div className="text-lg font-black font-mono italic tracking-tighter">{audit.ip || '未公开'}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 p-6 bg-zinc-50/30 rounded-[2.5rem] border border-transparent shadow-xs">
                            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                              <GeometricLantern variant="activity" className="w-6 h-6" />
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">提交时间</div>
                              <div className="text-lg font-black italic tracking-tight">{formatDateTime(audit.created_at)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row 3xl:flex-col justify-center gap-6 min-w-[320px]">
                      <button type="button"
                        onClick={() => { setSelectedAudit(audit); setIsDialogOpen('approve'); }}
                        className="px-12 py-8 btn-accent rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center justify-center gap-6 shadow-2xl shadow-accent/20 italic active:scale-[0.98]"
                      >
                        <GeometricLantern variant="spark" className="w-6 h-6" /> 通过审核
                      </button>
                      <button type="button"
                        onClick={() => { setSelectedAudit(audit); setIsDialogOpen('reject'); }}
                        className="px-12 py-8 border border-zinc-50 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center gap-6 italic active:scale-[0.98] shadow-xs hover:shadow-2xl hover:shadow-red-500/20"
                      >
                        <GeometricLantern variant="alert" className="w-6 h-6" /> 驳回申请
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {audits.length === 0 && (
            <div className="py-48 text-center border border-zinc-50 rounded-[5rem] space-y-8 bg-white shadow-xs">
              <GeometricLantern variant="data" className="w-20 h-20 text-zinc-300 mx-auto" />
              <div className="space-y-3">
                <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none text-accent">当前没有待审服务器</h3>
                <p className="text-sm font-bold text-zinc-400">当前没有真实待审核服务器。</p>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isDialogOpen && selectedAudit && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                onClick={() => setIsDialogOpen(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 40 }}
                transition={{ duration: 0.3 }}
                className="relative w-full max-w-2xl bg-white rounded-[5rem] shadow-[0_64px_128px_rgba(0,0,0,0.5)] p-20 space-y-12"
              >
                <div className="space-y-2">
                  <h3 className="text-5xl font-black tracking-tighter uppercase italic leading-none">{isDialogOpen === 'approve' ? '通过审核' : '驳回审核'}</h3>
                  <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic leading-none">当前服务器：<span className="text-accent">{selectedAudit.name}</span></p>
                </div>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full h-56 px-10 py-10 bg-zinc-50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] transition-all duration-700 outline-hidden font-black text-lg italic tracking-tight shadow-xs placeholder:text-zinc-200"
                  placeholder={isDialogOpen === 'approve' ? '可选：内部审核备注…' : '必填：拒绝原因…'}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                  <button type="button"
                    onClick={() => setIsDialogOpen(null)}
                    className="py-10 border border-zinc-50 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.6em] hover:bg-zinc-50 transition-all italic shadow-xs active:scale-[0.98] text-zinc-300 hover:text-black"
                  >
                    取消操作
                  </button>
                  <button type="button"
                    onClick={() => {
                      if (isDialogOpen === 'reject' && !notes.trim()) {
                        toast({ title: '拒绝时必须填写原因', variant: 'destructive' });
                        return;
                      }
                      actionMutation.mutate({
                        serverId: selectedAudit.id,
                        status: isDialogOpen === 'approve' ? 'APPROVED' : 'REJECTED',
                        reviewNotes: notes.trim() || undefined,
                      });
                    }}
                    disabled={actionMutation.isPending}
                    className={`py-10 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.6em] transition-all italic active:scale-[0.98] flex items-center justify-center gap-6 disabled:opacity-50 ${
                      isDialogOpen === 'approve' ? 'bg-accent text-white hover:bg-accent-medium shadow-accent/20' : 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                    }`}
                  >
                    {isDialogOpen === 'approve' ? '确认通过' : '确认驳回'} <GeometricLantern variant={isDialogOpen === 'approve' ? 'spark' : 'alert'} className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </StatusWrapper>
    </div>
  );
};

export default AdminReview;
