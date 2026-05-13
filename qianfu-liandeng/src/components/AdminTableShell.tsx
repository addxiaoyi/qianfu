import React from 'react';

interface AdminTableShellProps {
  children: React.ReactNode;
  emptyState?: React.ReactNode;
}

const AdminTableShell: React.FC<AdminTableShellProps> = ({ children, emptyState }) => {
  return (
    <div className="border border-zinc-50 rounded-[5rem] overflow-hidden bg-white shadow-xs group/table hover:border-zinc-100 transition-all duration-1000">
      {children}
      {emptyState}
    </div>
  );
};

export default AdminTableShell;
