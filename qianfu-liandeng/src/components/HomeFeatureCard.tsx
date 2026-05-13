import React from 'react';
import { motion } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';

interface HomeFeatureCardProps {
  tag: string;
  title: string;
  description: string;
  variant: 'security' | 'spark' | 'terminal';
}

const HomeFeatureCard: React.FC<HomeFeatureCardProps> = ({ tag, title, description, variant }) => {
  return (
    <motion.div className="group relative p-12 rounded-[3.5rem] border border-zinc-50 bg-zinc-50/30 hover:bg-white hover:border-accent transition-all duration-700 shadow-xs hover:shadow-2xl hover:shadow-black/5">
      <div className="absolute top-10 right-10 text-[10px] font-black text-zinc-200 uppercase tracking-widest italic group-hover:text-zinc-400 transition-colors">
        / {tag}
      </div>
      <div className="w-20 h-20 bg-white border border-zinc-100 rounded-[2rem] flex items-center justify-center mb-10 shadow-sm group-hover:rotate-12 group-hover:scale-110 group-hover:bg-accent group-hover:text-white transition-all duration-700">
        <GeometricLantern variant={variant} className="w-8 h-8 transition-colors" />
      </div>
      <h3 className="text-3xl font-black mb-6 tracking-tighter uppercase italic leading-none group-hover:text-accent transition-colors">{title}</h3>
      <p className="text-zinc-400 font-bold text-lg leading-relaxed italic group-hover:text-zinc-600 transition-colors">{description}</p>
      <div className="mt-12 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="w-8 h-[1px] bg-accent" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em] italic text-accent">Learn More</span>
      </div>
    </motion.div>
  );
};

const MemoizedHomeFeatureCard = React.memo(HomeFeatureCard);

export default MemoizedHomeFeatureCard;
