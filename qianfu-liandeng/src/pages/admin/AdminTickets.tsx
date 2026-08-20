import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Send } from 'lucide-react';
import { api } from '@/api/request';
import StatusWrapper from '@/components/ui/StatusWrapper';
import AdminPageHeader from '@/components/ui/AdminPageHeader';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { formatDateTime } from '@/utils/serverView';
import { cn } from '@/utils/cn';
import { toast } from '@/hooks/use-toast';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

type TicketMessage = {
  id: number;
  content: string;
  created_at?: string;
  sender?: {
    username?: string | null;
    role?: string | null;
  } | null;
  is_ai?: boolean;
};

type TicketRecord = {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  created_at?: string;
  updated_at?: string;
  user?: {
    username?: string | null;
    email?: string | null;
  } | null;
};

type TicketDetailRecord = TicketRecord & {
  messages?: TicketMessage[];
};

const statusTone: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-50 text-blue-600 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-600 border-amber-200',
  RESOLVED: 'bg-green-50 text-green-600 border-green-200',
  CLOSED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const AdminTickets: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [reply, setReply] = useState('');

  const { data: tickets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: () => api.get<TicketRecord[]>('/tickets', { limit: 100 }),
  });

  const { data: selectedTicket, isFetching: detailLoading, isError: detailError, refetch: refetchDetail } = useQuery({
    queryKey: ['admin-ticket-detail', selectedTicketId],
    queryFn: () => api.get<TicketDetailRecord>(`/tickets/${selectedTicketId}`),
    enabled: !!selectedTicketId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TicketStatus }) =>
      api.put(`/tickets/${id}/status`, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-ticket-detail', selectedTicketId] }),
      ]);
      toast({ title: '工单状态已更新' });
    },
    onError: () => toast({ variant: 'destructive', title: '更新失败', description: '工单状态未能更新，请稍后重试。' }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      api.post(`/tickets/${id}/messages`, { content }),
    onSuccess: async () => {
      setReply('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-ticket-detail', selectedTicketId] }),
      ]);
      toast({ title: '工单回复已发送' });
    },
    onError: () => toast({ variant: 'destructive', title: '回复失败', description: '回复未能发送，内容已为您保留。' }),
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchTab =
        activeTab === 'all'
          ? true
          : activeTab === 'pending'
            ? ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS'
            : ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
      if (!matchTab) return false;
      if (!query) return true;
      return [ticket.title, ticket.description, ticket.user?.username, ticket.user?.email, String(ticket.id)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [activeTab, search, tickets]);

  const pendingCount = tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED').length;

  React.useEffect(() => {
    if (filtered.length === 0) {
      if (selectedTicketId !== null) setSelectedTicketId(null);
      return;
    }
    const stillVisible = filtered.some((ticket) => ticket.id === selectedTicketId);
    if (!stillVisible) {
      setSelectedTicketId(filtered[0].id);
    }
  }, [filtered, selectedTicketId]);

  return (
    <div className="space-y-16 pb-32 bg-white">
      <AdminPageHeader
        badge="SUPPORT_GRID / NODE_0"
        title="Nexus."
        description="后台工单管理已接入真实工单详情、回复和状态流转，不再只是只读列表。"
        statusLabel={`待处理 ${pendingCount} / 已归档 ${resolvedCount}`}
        statusTone={pendingCount > 0 ? 'warning' : 'success'}
        rightSlot={(
          <div className="p-10 bg-accent text-white rounded-[3rem] flex items-center gap-10 shadow-2xl shadow-accent/20">
            <div className="w-20 h-20 bg-accent-medium/30 rounded-[2rem] flex items-center justify-center border border-white/10 shadow-inner">
              <GeometricLantern variant="activity" className="w-10 h-10 text-green-500" />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500 italic">Live Load</div>
              <div className="text-4xl font-black font-mono tracking-tighter uppercase italic leading-none">{pendingCount > 0 ? 'ACTIVE' : 'CLEAR'}</div>
            </div>
          </div>
        )}
      />

      <div className="flex flex-col xl:flex-row items-center justify-between gap-10 pt-12 border-t border-zinc-50">
        <div className="flex gap-16 overflow-x-auto no-scrollbar w-full xl:w-auto">
          {[
            { id: 'pending' as const, label: 'Processing', tag: `NX_01 / ${pendingCount}` },
            { id: 'resolved' as const, label: 'Archived', tag: `NX_02 / ${resolvedCount}` },
            { id: 'all' as const, label: 'Universal', tag: `NX_ALL / ${tickets.length}` },
          ].map((tab) => (
            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-start gap-3 pb-10 transition-all relative group ${activeTab === tab.id ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
              <span className="text-[12px] font-black uppercase tracking-[0.4em] italic">{tab.label}</span>
              <span className="text-[9px] font-black font-mono tracking-widest text-zinc-400">{tab.tag}</span>
              {activeTab === tab.id && <motion.div layoutId="ticket-tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent" />}
            </button>
          ))}
        </div>
        <div className="relative w-full xl:w-[36rem] group">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-accent transition-colors duration-500" />
          <input
            type="text"
            aria-label="搜索工单"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索工单标题、描述、用户或 ID"
            className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] outline-hidden text-lg font-black italic transition-all duration-500 shadow-xs"
          />
        </div>
      </div>

      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px] gap-8">
          <div className="grid grid-cols-1 gap-8">
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-36 border border-zinc-50 rounded-[5rem] bg-zinc-50/20 text-center border-dashed space-y-8">
                  <GeometricLantern variant="activity" className="w-14 h-14 text-zinc-300 mx-auto" />
                  <div className="space-y-3">
                    <p className="text-[12px] font-black text-zinc-400 uppercase tracking-[0.6em] italic">No Real Tickets</p>
                    <p className="text-sm font-bold text-zinc-400">当前筛选条件下没有真实工单。</p>
                  </div>
                </motion.div>
              ) : (
                filtered.map((ticket, idx) => (
                  <motion.button
                    key={ticket.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.4 }}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`flex flex-col xl:flex-row xl:items-center justify-between p-16 border rounded-[5rem] bg-white hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 group shadow-xs relative overflow-hidden text-left ${
                      selectedTicketId === ticket.id ? 'border-black shadow-lg' : 'border-zinc-50'
                    }`}
                  >
                    <div className={cn('absolute left-0 top-0 w-2 h-full rounded-l-[5rem]', ticket.status === 'OPEN' ? 'bg-blue-400' : ticket.status === 'IN_PROGRESS' ? 'bg-orange-400' : ticket.status === 'RESOLVED' ? 'bg-green-500' : 'bg-zinc-200')} />
                    <div className="flex items-start gap-12 pl-6">
                      <div className={cn('w-20 h-20 rounded-[2.5rem] shrink-0 flex items-center justify-center transition-all duration-700 shadow-xs', ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS' ? 'bg-orange-50 border border-orange-100 text-orange-500' : 'bg-zinc-50 border border-zinc-100 text-zinc-300')}>
                        <GeometricLantern variant="terminal" className="w-10 h-10" />
                      </div>
                      <div className="space-y-6">
                        <div className="flex flex-wrap items-center gap-6">
                          <h3 className="text-3xl font-black tracking-tighter uppercase italic text-accent">{ticket.title || `工单 #${ticket.id}`}</h3>
                          <div className={cn('text-[10px] font-black font-mono px-5 py-2 rounded-sm uppercase tracking-[0.3em] italic border shadow-xs', statusTone[ticket.status])}>
                            {ticket.status}
                          </div>
                          <div className="text-[10px] font-black font-mono px-5 py-2 rounded-sm uppercase tracking-[0.3em] italic border border-zinc-200 text-zinc-500 bg-zinc-50 shadow-xs">
                            {ticket.priority}
                          </div>
                        </div>
                        <p className="text-sm font-bold text-zinc-500 leading-7 max-w-4xl line-clamp-2">{ticket.description}</p>
                        <div className="flex flex-wrap items-center gap-10 text-[10px] font-black font-mono text-zinc-300 uppercase tracking-[0.3em] italic">
                          <div className="flex items-center gap-3"><GeometricLantern variant="user" className="w-4 h-4" /> USER: {ticket.user?.username || 'SELF'}</div>
                          <div className="flex items-center gap-3"><GeometricLantern variant="terminal" className="w-4 h-4" /> UPDATED: {formatDateTime(ticket.updated_at || ticket.created_at)}</div>
                          <div>#ID: {String(ticket.id)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-10 xl:mt-0 flex items-center gap-6 ml-auto shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 group-hover:text-accent transition-colors duration-500 italic">Manage Ticket</span>
                      <div className="w-16 h-16 rounded-[2rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center group-hover:bg-accent group-hover:text-white group-hover:border-accent transition-all duration-700 shadow-xs">
                        <GeometricLantern variant="activity" className="w-7 h-7" />
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="rounded-[4rem] border border-zinc-100 bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)] min-h-[680px]">
            {!selectedTicketId ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
                <GeometricLantern variant="terminal" className="w-14 h-14 text-zinc-200" />
                <div className="space-y-3">
                  <div className="text-[12px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">Select Ticket</div>
                  <p className="text-sm font-bold text-zinc-400">从左侧选择一条工单，即可查看详情、回复和调整状态。</p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {detailError ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center text-sm font-bold text-amber-700">
                    <p>工单详情加载失败，列表数据未受影响。</p>
                    <button type="button" onClick={() => refetchDetail()} className="rounded-xl bg-black px-4 py-2 text-xs text-white">重新加载详情</button>
                  </div>
                ) : detailLoading || !selectedTicket ? (
                  <div className="flex-1 flex items-center justify-center text-sm font-bold text-zinc-400">加载工单详情中…</div>
                ) : (
                  <>
                    <div className="space-y-4 border-b border-zinc-100 pb-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className={cn('text-[10px] font-black font-mono px-4 py-2 rounded-sm uppercase tracking-[0.3em] italic border shadow-xs', statusTone[selectedTicket.status])}>
                          {selectedTicket.status}
                        </div>
                        <div className="text-[10px] font-black font-mono px-4 py-2 rounded-sm uppercase tracking-[0.3em] italic border border-zinc-200 text-zinc-500 bg-zinc-50 shadow-xs">
                          {selectedTicket.priority}
                        </div>
                      </div>
                      <h3 className="text-2xl font-black tracking-tight text-zinc-900 break-words">{selectedTicket.title}</h3>
                      <p className="text-sm text-zinc-500 leading-7">{selectedTicket.description}</p>
                      <div className="text-[10px] font-black font-mono text-zinc-300 uppercase tracking-[0.24em]">
                        创建 {formatDateTime(selectedTicket.created_at)} / 更新 {formatDateTime(selectedTicket.updated_at)}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as TicketStatus[]).map((status) => (
                          <button type="button"
                            key={status}
                            onClick={() => status !== selectedTicket.status && statusMutation.mutate({ id: selectedTicket.id, status })}
                            disabled={statusMutation.isPending || status === selectedTicket.status}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] border transition-all ${
                              status === selectedTicket.status
                                ? 'bg-black text-white border-black'
                                : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                            } disabled:opacity-60`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 py-6">
                      {(selectedTicket.messages || []).length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm font-bold text-zinc-400">这条工单还没有消息记录。</div>
                      ) : (
                        (selectedTicket.messages || []).map((message) => {
                          const role = String(message.sender?.role || '').toUpperCase();
                          const isStaff = message.is_ai || role === 'ADMIN' || role === 'STAFF';
                          return (
                            <div key={message.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${
                                isStaff ? 'bg-black text-white' : 'bg-zinc-50 border border-zinc-100 text-zinc-900'
                              }`}>
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60 mb-2">
                                  {message.sender?.username || (isStaff ? 'STAFF' : 'USER')} / {formatDateTime(message.created_at)}
                                </div>
                                <div className="whitespace-pre-wrap break-words">{message.content}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="border-t border-zinc-100 pt-5">
                      <div className="relative">
                        <textarea
                          aria-label="管理员工单回复"
                          value={reply}
                          onChange={(event) => setReply(event.target.value)}
                          className="w-full min-h-[120px] rounded-[2rem] border border-zinc-100 bg-zinc-50 px-5 py-4 pr-16 outline-none transition-all focus:bg-white focus:border-accent resize-none"
                          placeholder="作为管理员回复工单..."
                        />
                        <div className="absolute bottom-4 right-4 flex items-center gap-2">
                          <button type="button"
                            onClick={() => setReply('')}
                            disabled={!reply.trim() || replyMutation.isPending}
                            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 disabled:opacity-50"
                          >
                            清空
                          </button>
                          <button type="button"
                            onClick={() => selectedTicketId && reply.trim() && replyMutation.mutate({ id: selectedTicketId, content: reply.trim() })}
                            disabled={!reply.trim() || replyMutation.isPending}
                            className="px-4 py-2 rounded-xl bg-black text-white text-[11px] font-black uppercase tracking-[0.18em] flex items-center gap-2 disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                            发送回复
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminTickets;
