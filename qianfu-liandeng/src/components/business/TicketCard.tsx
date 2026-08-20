import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import GeometricLantern from '@/components/ui/GeometricLantern';

interface TicketCardProps {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
  href: string;
  getStatusIcon: (status: string) => React.ReactNode;
}

const TicketCard: React.FC<TicketCardProps> = ({ id, subject, status, updatedAt, href, getStatusIcon }) => {
  return (
    <Link
      key={id}
      to={href}
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 p-5 sm:p-6 lg:p-8 bg-white border border-zinc-100 rounded-[2rem] sm:rounded-[2.5rem] hover:border-zinc-300 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.03)]"
    >
      <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 min-w-0">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-zinc-50 border border-zinc-100 rounded-[1.25rem] flex items-center justify-center text-zinc-400 group-hover:bg-black group-hover:text-white transition-all duration-500 shrink-0">
          <GeometricLantern variant="terminal" className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <div className="space-y-2 min-w-0">
          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-zinc-900 tracking-tight leading-tight group-hover:text-black transition-colors break-words">{subject}</h3>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            <span className="flex items-center gap-2">
              {getStatusIcon(status)}
              {status}
            </span>
            <span className="text-zinc-100">•</span>
            <span className="flex items-center gap-2">
              <GeometricLantern variant="activity" className="w-3.5 h-3.5" />
              最近更新: {updatedAt}
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
