import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminActionButton from '@/components/AdminActionButton';
import TicketCard from '@/components/TicketCard';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useT } from '@/store/uiStore';
import { formatDateTime } from '@/utils/serverView';

type TicketRecord = {
  id: number;
  title: string;
  status: string;
  updated_at?: string;
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

  return (
    <StatusWrapper isLoading={isLoading} isError={isError} isEmpty={!isLoading && !isError && ticketCards.length === 0} onRetry={() => refetch()}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24 bg-white selection:bg-accent selection:text-white">
        <AdminPageHeader
          badge="TICKET_QUEUE"
          title={t('ticket.list.title')}
          description={t('ticket.list.desc')}
          statusLabel={`OPEN ${openTickets} / RESOLVED ${resolvedTickets}`}
          rightSlot={(
            <AdminActionButton className="w-full sm:w-auto px-6 sm:px-8 py-4 text-[11px] uppercase tracking-[0.28em] flex items-center justify-center gap-3" onClick={() => navigate('/dashboard/tickets/new')}>
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
              updatedAt={formatDateTime(ticket.updated_at)}
              href={`/dashboard/tickets/${ticket.id}`}
              getStatusIcon={getStatusIcon}
            />
          ))}
        </div>
      </div>
    </StatusWrapper>
  );
};

export default TicketList;
