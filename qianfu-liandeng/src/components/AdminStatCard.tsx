import React from 'react';
import { motion } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';

interface AdminStatCardProps {
  tag: string;
  value: string;
  label: string;
  variant: any;
  colorClassName?: string;
  trend: string;
  delay?: number;
  up?: boolean;
}

const AdminStatCard: React.FC<AdminStatCardProps> = ({
  tag,
  value,
  label,
  variant,
  colorClassName,
  trend,
  delay = 0,
  up = true,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className="p-12 border border-zinc-50 rounded-[4rem] bg-white group hover:border-accent hover:shadow-2xl hover:shadow-black/5 transition-all duration-700 shadow-xs relative overflow-hidden"
    >
      <div className="absolute top-10 right-10 text-[9px] font-black text-zinc-100 group-hover:text-zinc-200 transition-colors italic">/ {tag}</div>
      <div className="flex justify-between items-start mb-12">
        <div className="w-20 h-20 bg-zinc-50 rounded-[2rem] flex items-center justify-center text-zinc-300 group-hover:bg-accent group-hover:text-white group-hover:rotate-6 transition-all duration-700 border border-transparent shadow-xs">
          <GeometricLantern variant={variant} className={`w-8 h-8 ${colorClassName ?? ''} group-hover:text-white transition-colors`} />
        </div>
        <div className={`p-3 rounded-xl border border-zinc-50 opacity-0 group-hover:opacity-100 transition-opacity ${up ? 'text-green-600' : 'text-red-600'}`}>
          <GeometricLantern variant={up ? 'spark' : 'alert'} className="w-5 h-5 text-accent" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="text-3xl sm:text-4xl lg:text-6xl font-black font-mono tracking-tighter italic leading-none break-words">{value}</div>
        <div className="flex items-center justify-between border-t border-zinc-50 pt-4">
          <div className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.4em] italic group-hover:text-accent transition-colors">{label}</div>
          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter italic">{trend}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminStatCard;
