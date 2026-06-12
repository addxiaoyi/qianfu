import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, User, ShieldCheck, ChevronLeft } from 'lucide-react';
import { request } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import { toast } from '@/hooks/use-toast';
import { formatDateTime } from '@/utils/serverView';
import { useAuthStore } from '@/store/authStore';

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

type TicketDetailRecord = {
  id: number;
  title: string;
  status: string;
  user?: {
    username?: string | null;
  } | null;
  messages?: TicketMessage[];
};

const TicketDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'admin';

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => request<TicketDetailRecord>(`/tickets/${id}`),
    enabled: !!id,
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      request(`/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      setReply('');
      void queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: '回复已发送' });
    },
  });
  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      request(`/tickets/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: '工单状态已更新' });
    },
  });

  const messages = useMemo(() => ticket?.messages ?? [], [ticket?.messages]);
  const messageCount = messages.length;
  const availableStatuses = isAdmin ? ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] : ['CLOSED'];

  return (
    <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
      <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col h-[calc(100svh-64px)]">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors mb-6 font-semibold uppercase text-[10px] tracking-[0.3em]">
          <ChevronLeft className="w-5 h-5" /> 返回
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8 pb-8 border-b border-border">
          <div className="min-w-0">
            <h1 className="text-2xl font-black mb-2 break-words">{ticket?.title || `工单 #${id}`}</h1>
            <p className="text-sm text-muted-foreground">
              工单 ID: #{id} • 状态: <span className="font-bold text-brand">{ticket?.status || 'UNKNOWN'}</span>
              {ticket?.user?.username ? <> • 提交人: <span className="font-bold">{ticket.user.username}</span></> : null}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-left sm:text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">消息数</div>
              <div className="text-xl font-black">{messageCount}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableStatuses.map((status) => (
                <button type="button"
                  key={status}
                  onClick={() => status !== ticket?.status && statusMutation.mutate(status)}
                  disabled={statusMutation.isPending || status === ticket?.status}
                  className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] border transition-all ${
                    status === ticket?.status
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                  } disabled:opacity-60`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto space-y-8 pr-4 custom-scrollbar mb-8">
          {messages.map((msg) => {
            const role = String(msg.sender?.role || '').toUpperCase();
            const isStaff = msg.is_ai || role === 'ADMIN' || role === 'STAFF';
            return (
              <div key={msg.id} className={`flex gap-4 ${isStaff ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isStaff ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'}`}>
                  {isStaff ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className={`max-w-[70%] ${isStaff ? 'items-end' : ''} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-bold">{msg.sender?.username || (isStaff ? 'Support' : 'User')}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(msg.created_at)}</span>
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isStaff ? 'bg-brand text-white rounded-tr-none' : 'bg-card border border-border rounded-tl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-card border border-border rounded-3xl shadow-xl">
          <div className="relative">
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              className="w-full bg-transparent p-4 pr-16 min-h-[100px] outline-hidden resize-none"
              placeholder="输入您的回复内容..."
            />
            <button type="button"
              onClick={() => reply.trim() && replyMutation.mutate(reply.trim())}
              disabled={!reply.trim() || replyMutation.isPending}
              className="absolute bottom-4 right-4 w-10 h-10 bg-brand text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-brand/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </StatusWrapper>
  );
};

export default TicketDetail;
