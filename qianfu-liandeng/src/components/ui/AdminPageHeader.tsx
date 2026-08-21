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
    <header className="flex flex-col justify-between gap-5 border-b border-zinc-200 pb-6 xl:flex-row xl:items-end">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600">
            {badge}
          </div>
          {statusLabel && (
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${statusTone === 'warning' ? 'bg-orange-500' : statusTone === 'danger' ? 'bg-red-500' : statusTone === 'success' ? 'bg-green-500' : 'bg-zinc-500'}`} />
              <span className="text-xs font-medium text-zinc-500">{statusLabel}</span>
            </div>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-accent break-words">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
          {description}
        </p>
      </div>

      {rightSlot && <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">{rightSlot}</div>}
    </header>
  );
};

export default AdminPageHeader;
