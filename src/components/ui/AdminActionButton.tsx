import React from 'react';

interface AdminActionButtonProps {
  children: React.ReactNode;
  variant?: 'accent' | 'neutral' | 'danger';
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

const variantClasses = {
  accent: 'btn-accent text-white',
  neutral: 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400',
  danger: 'bg-red-600 text-white hover:bg-red-700',
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
      className={`inline-flex min-h-11 items-center justify-center rounded-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export default AdminActionButton;
