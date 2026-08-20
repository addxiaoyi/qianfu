import React from 'react';

interface HomeStatCardProps {
  label: string;
  value: string;
  className?: string;
}

const HomeStatCard: React.FC<HomeStatCardProps> = ({ label, value, className = '' }) => {
  return (
    <div className={`border-t border-zinc-300 pt-4 sm:pt-5 ${className}`}>
      <p className="text-xs font-semibold text-zinc-500 leading-none">{label}</p>
      <p className="mt-3 text-3xl sm:text-4xl font-black tabular-nums tracking-[-0.04em] leading-none text-zinc-950">{value}</p>
    </div>
  );
};

export default React.memo(HomeStatCard);
