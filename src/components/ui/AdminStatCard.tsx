import React from 'react';
import { motion } from 'framer-motion';
import GeometricLantern from '@/components/ui/GeometricLantern';

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
      className="relative overflow-hidden rounded-3xl border border-zinc-50 bg-white p-6 shadow-xs transition-all duration-500 group hover:border-accent hover:shadow-xl hover:shadow-black/5 sm:p-7"
    >
      <div className="absolute right-6 top-6 text-[9px] font-black italic text-zinc-100 transition-colors group-hover:text-zinc-200">/ {tag}</div>
      <div className="mb-7 flex items-start justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-transparent bg-zinc-50 text-zinc-300 shadow-xs transition-all duration-500 group-hover:rotate-6 group-hover:bg-accent group-hover:text-white sm:h-16 sm:w-16">
          <GeometricLantern variant={variant} className={`h-7 w-7 ${colorClassName ?? ''} transition-colors group-hover:text-white`} />
        </div>
        <div className={`rounded-lg border border-zinc-50 p-2 opacity-0 transition-opacity group-hover:opacity-100 ${up ? 'text-green-600' : 'text-red-600'}`}>
          <GeometricLantern variant={up ? 'spark' : 'alert'} className="h-4 w-4 text-accent" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="break-words font-mono text-2xl font-black italic leading-none tracking-tighter sm:text-3xl lg:text-4xl">{value}</div>
        <div className="flex items-center justify-between border-t border-zinc-50 pt-3">
          <div className="text-[10px] font-black uppercase italic tracking-[0.3em] text-zinc-300 transition-colors group-hover:text-accent">{label}</div>
          <span className="text-[9px] font-black italic tracking-tighter text-zinc-400">{trend}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminStatCard;
