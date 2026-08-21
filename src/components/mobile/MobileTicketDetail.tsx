import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Send, ShieldCheck, User, AlertCircle } from 'lucide-react';
import { api } from '../../api/request';
import { toast } from '../../hooks/use-toast';
import { cn } from '../../utils/cn';
import { formatDateTime } from '../../utils/serverView';

const statusLabels: Record<string, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  WAITING_USER: '等待您回复',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
};

interface Message {
  id: number | string;
  content: string;
  created_at?: string;
  time?: string;
  sender?: {
    username?: string;
    role?: string;
  };
  role?: string;
  is_ai?: boolean;
}

function isStaffMessage(msg: Message) {
  const role = String(msg.sender?.role || msg.role || '').toUpperCase();
  return msg.is_ai || role === 'ADMIN' || role === 'STAFF';
}

function MessageItem({ msg }: { msg: Message }) {
  const staff = isStaffMessage(msg);
  return (
    <div className={cn('flex gap-2', staff ? 'justify-start' : 'justify-end')}>
      {staff && (
        <div className="mt-1 w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          staff
            ? 'bg-white text-zinc-900 border border-zinc-200 rounded-bl-sm'
            : 'bg-zinc-900 text-white rounded-br-sm',
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        <p className="text-[10px] mt-1 text-zinc-400">
          {formatDateTime(msg.created_at || msg.time)}
        </p>
      </div>
      {!staff && (
        <div className="mt-1 w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

export default function MobileTicketDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['ticket', id, 'mobile'],
    queryFn: () => api.get<any>(`/tickets/${id}`),
    enabled: !!id,
  });

  const messages: Message[] = Array.isArray(ticket?.messages) ? ticket.messages : [];

  const replyMutation = useMutation({
    mutationFn: (content: string) => api.post(`/tickets/${id}/messages`, { content }),
    onSuccess: () => {
      setInput('');
      queryClient.invalidateQueries({ queryKey: ['ticket', id, 'mobile'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'mobile'] });
      toast({ title: '回复已发送' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: '回复发送失败', description: '请检查网络后重试。' });
    },
  });

  const handleSubmit = () => {
    const content = input.trim();
    if (!content || replyMutation.isPending) return;
    replyMutation.mutate(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 rounded-2xl bg-zinc-100 animate-pulse" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
        <AlertCircle className="w-12 h-12 text-red-300" />
        <p className="text-sm font-bold text-zinc-500">工单详情加载失败</p>
        <button type="button" onClick={() => refetch()} className="px-5 py-3 rounded-xl bg-black text-white text-xs font-black">重试</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100svh-132px)] bg-zinc-50">
      <div className="px-4 py-3 border-b border-zinc-100 bg-white">
        <h2 className="text-base font-black line-clamp-1">{ticket?.title || ticket?.subject || `工单 #${id}`}</h2>
        <p className="text-[10px] font-bold text-zinc-400 mt-1">状态：{statusLabels[String(ticket?.status || '').toUpperCase()] || '待确认'}</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-bold text-zinc-500">尚无沟通记录</p>
            <p className="mt-2 text-xs text-zinc-400">补充问题细节后，客服会在此回复。</p>
          </div>
        ) : (
          messages.map((msg) => <MessageItem key={msg.id} msg={msg} />)
        )}
      </div>

      <div className="border-t border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label="工单回复内容"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 min-h-[44px] px-4 py-2 rounded-full border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || replyMutation.isPending}
            aria-label="发送回复"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-zinc-900 text-white disabled:opacity-40 transition-opacity"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
