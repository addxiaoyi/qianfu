import React from 'react';

interface AdminTableShellProps {
  children: React.ReactNode;
  emptyState?: React.ReactNode;
}

const AdminTableShell: React.FC<AdminTableShellProps> = ({ children, emptyState }) => {
  return (
    <div className="overflow-hidden rounded-[14px] border border-zinc-200 bg-white shadow-sm">
      {children}
      {emptyState}
    </div>
  );
};

export default AdminTableShell;
