import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import GeometricLantern from '@/components/ui/GeometricLantern';

interface TicketCardProps {
  id: string;
  subject: string;
  status: string;
  statusLabel?: string;
  updatedAt: string;
  href: string;
  getStatusIcon: (status: string) => React.ReactNode;
}

const TicketCard: React.FC<TicketCardProps> = ({ id, subject, status, statusLabel, updatedAt, href, getStatusIcon }) => {
  return (
    <Link
      key={id}
      to={href}
      className="group flex flex-col justify-between gap-4 rounded-[14px] border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-400 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
    >
      <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 min-w-0">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-zinc-200 bg-zinc-50 text-zinc-500 group-hover:bg-black group-hover:text-white">
          <GeometricLantern variant="message" className="h-5 w-5" />
        </div>
        <div className="space-y-2 min-w-0">
          <h3 className="break-words text-base font-semibold leading-tight text-zinc-900 sm:text-lg">{subject}</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-zinc-500">
            <span className="flex items-center gap-2">
              {getStatusIcon(status)}
              {statusLabel || status}
            </span>
            <span className="text-zinc-100">•</span>
            <span className="flex items-center gap-2">
              <GeometricLantern variant="activity" className="w-3.5 h-3.5" />
              最近更新：{updatedAt}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 sm:mt-0 w-11 h-11 sm:w-12 sm:h-12 bg-zinc-50 rounded-xl flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all shrink-0 self-end sm:self-auto">
        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
};

export default React.memo(TicketCard);
