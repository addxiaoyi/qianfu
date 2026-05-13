import React from 'react';

interface HomeStatCardProps {
  label: string;
  value: string;
}

const HomeStatCard: React.FC<HomeStatCardProps> = ({ label, value }) => {
  return (
    <div className="space-y-4 rounded-[2rem] border border-zinc-900/60 bg-white/5 p-5 sm:p-6 backdrop-blur-sm">
      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] italic leading-none">{label}</p>
      <p className="text-4xl sm:text-5xl md:text-6xl font-black text-white italic tracking-tighter leading-none transition-colors hover:text-accent">{value}</p>
    </div>
  );
};

export default React.memo(HomeStatCard);
