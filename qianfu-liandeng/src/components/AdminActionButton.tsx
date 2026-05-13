import React from 'react';

interface AdminActionButtonProps {
  children: React.ReactNode;
  variant?: 'accent' | 'neutral' | 'danger';
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

const variantClasses = {
  accent: 'btn-accent text-white shadow-2xl shadow-accent/20',
  neutral: 'bg-white border border-zinc-100 text-zinc-400 hover:bg-zinc-50 hover:border-zinc-200',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-2xl shadow-red-500/20',
} as const;

const AdminActionButton: React.FC<AdminActionButtonProps> = ({
  children,
  variant = 'accent',
  className = '',
  onClick,
  type = 'button',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-2xl sm:rounded-[3rem] transition-all duration-500 active:scale-[0.98] font-semibold ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export default AdminActionButton;
