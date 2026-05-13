import React from 'react';

interface AdminPageHeaderProps {
  badge: string;
  title: string;
  description: string;
  statusLabel?: string;
  statusTone?: 'default' | 'success' | 'warning' | 'danger';
  rightSlot?: React.ReactNode;
}

const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  badge,
  title,
  description,
  statusLabel,
  statusTone = 'default',
  rightSlot,
}) => {
  return (
    <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 sm:gap-12 lg:gap-16">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="px-4 py-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-sm shadow-2xl shadow-accent/20 italic">
            {badge}
          </div>
          {statusLabel && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.5)] ${statusTone === 'warning' ? 'bg-orange-500' : statusTone === 'danger' ? 'bg-red-500' : statusTone === 'success' ? 'bg-green-500' : 'bg-green-500'}`} />
              <span className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-zinc-300 italic">{statusLabel}</span>
            </div>
          )}
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.9] italic text-accent break-words">
          {title}
        </h1>
        <p className="text-zinc-400 font-bold text-base sm:text-lg max-w-xl italic border-l-2 border-zinc-100 pl-4 sm:pl-8">
          {description}
        </p>
      </div>

      {rightSlot && <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">{rightSlot}</div>}
    </header>
  );
};

export default AdminPageHeader;
