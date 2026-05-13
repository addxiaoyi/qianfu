import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import { Send, User, ShieldCheck } from 'lucide-react';
import { escapeHtml } from '@/utils/htmlSanitizer';
import { toast } from '@/hooks/use-toast';

const TicketDetail: React.FC = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const messageCount = 0;

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => request<any>(`/tickets/${id}`),
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) => request(`/tickets/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast({ title: '回复已发送' });
    }
  });

  return (
    <StatusWrapper isLoading={isLoading} isError={isError}>
      <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col h-[calc(100svh-64px)]">
        {/* Ticket Header */}
        <div className="flex justify-between items-center mb-8 pb-8 border-b border-border">
          <div>
            <h1 className="text-2xl font-black mb-2">{escapeHtml(ticket?.subject)}</h1>
            <p className="text-sm text-muted-foreground">工单 ID: #{id} • 状态: <span className="font-bold text-brand">{ticket?.status}</span></p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">消息数</div>
            <div className="text-xl font-black">{messageCount}</div>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-grow overflow-y-auto space-y-8 pr-4 custom-scrollbar mb-8">
          {ticket?.messages?.map((msg: any) => (
            <div 
              key={msg.id} 
              className={`flex gap-4 ${msg.role === 'staff' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'staff' ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {msg.role === 'staff' ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <div className={`max-w-[70%] ${msg.role === 'staff' ? 'items-end' : ''} flex flex-col`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-xs font-bold">{escapeHtml(msg.author)}</span>
                  <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'staff' ? 'bg-brand text-white rounded-tr-none' : 'bg-card border border-border rounded-tl-none'
                }`}>
                  {escapeHtml(msg.content)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reply Input */}
        <div className="p-4 bg-card border border-border rounded-3xl shadow-xl">
           <div className="relative">
             <textarea 
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              className="w-full bg-transparent p-4 pr-16 min-h-[100px] outline-hidden resize-none"
              placeholder="输入您的回复内容..."
             />
             <button 
              onClick={() => replyMutation.mutate(reply)}
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
