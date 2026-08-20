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
    <header className="flex flex-col justify-between gap-6 sm:gap-8 lg:gap-10 xl:flex-row xl:items-end">
      <div className="space-y-3 sm:space-y-4">
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
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-accent break-words">
          {title}
        </h1>
        <p className="max-w-xl border-l-2 border-zinc-100 pl-4 text-sm font-bold italic text-zinc-400 sm:pl-6 sm:text-base">
          {description}
        </p>
      </div>

      {rightSlot && <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">{rightSlot}</div>}
    </header>
  );
};

export default AdminPageHeader;
