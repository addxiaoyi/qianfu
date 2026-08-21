import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/request';
import StatusWrapper from '@/components/ui/StatusWrapper';
import AdminPageHeader from '@/components/ui/AdminPageHeader';
import AdminActionButton from '@/components/ui/AdminActionButton';
import TicketCard from '@/components/business/TicketCard';
import { FileWarning, Plus, ReceiptText, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useT } from '@/store/uiStore';
import { formatDateTime } from '@/utils/serverView';

type TicketRecord = {
  id: number;
  title: string;
  status: string;
  updated_at?: string;
};

const ticketStatusLabel: Record<string, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
};

const TicketList: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { data: tickets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => request<TicketRecord[]>('/tickets'),
  });

  const openTickets = tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS').length;
  const resolvedTickets = tickets.filter((ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED').length;

  const ticketCards = useMemo(() => tickets, [tickets]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="w-4 h-4 rounded-full bg-accent shadow-[0_0_12px_rgba(var(--accent-rgb),0.25)]" />;
      case 'IN_PROGRESS':
        return <span className="w-4 h-4 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />;
      case 'RESOLVED':
        return <span className="w-4 h-4 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />;
      case 'CLOSED':
        return <span className="w-4 h-4 rounded-full bg-zinc-300" />;
      default:
        return null;
    }
  };

  const emptyAction = (
    <div className="w-full max-w-3xl space-y-7">
      <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: '审核申诉', text: '服务器或资源审核结果需要补充说明。' },
          { icon: ReceiptText, title: '账户与登录', text: '验证码、登录或账户资料出现异常。' },
          { icon: FileWarning, title: '举报与故障', text: '反馈违规内容、页面错误或安全问题。' },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <item.icon className="h-5 w-5 text-zinc-700" aria-hidden="true" />
            <div className="mt-3 text-sm font-bold text-zinc-900">{item.title}</div>
            <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">{item.text}</p>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => navigate('/tickets/new')} className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <Plus className="h-4 w-4" aria-hidden="true" /> 新建工单
      </button>
      <p className="text-xs font-medium text-zinc-500">提交后可以在这里查看处理状态、管理回复和最终结果。</p>
    </div>
  );

  return (
    <StatusWrapper
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && ticketCards.length === 0}
      onRetry={() => refetch()}
      emptyTitle="还没有工单记录"
      emptyDescription="需要审核申诉、账户支持或违规举报时，可以在这里发起并持续跟踪。"
      emptyAction={emptyAction}
    >
      <div className="ui-page bg-white selection:bg-accent selection:text-white">
        <AdminPageHeader
          badge="帮助与反馈"
          title={t('ticket.list.title')}
          description={t('ticket.list.desc')}
          statusLabel={`待处理 ${openTickets} · 已完成 ${resolvedTickets}`}
          rightSlot={(
            <AdminActionButton className="w-full gap-2 px-5 text-sm sm:w-auto" onClick={() => navigate('/tickets/new')}>
              <Plus className="w-5 h-5" /> {t('ticket.list.create')}
            </AdminActionButton>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:gap-6 mt-8 sm:mt-10">
          {ticketCards.map((ticket) => (
            <TicketCard
              key={ticket.id}
              id={String(ticket.id)}
              subject={ticket.title}
              status={ticket.status}
              statusLabel={ticketStatusLabel[ticket.status] || ticket.status}
              updatedAt={formatDateTime(ticket.updated_at)}
              href={`/tickets/${ticket.id}`}
              getStatusIcon={getStatusIcon}
            />
          ))}
        </div>
      </div>
    </StatusWrapper>
  );
};

export default TicketList;
