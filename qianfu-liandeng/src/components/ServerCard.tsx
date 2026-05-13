import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';

interface ServerCardProps {
  server: any;
  index: number;
  protocolLabel: string;
  nodesOnlineLabel: string;
}

const ServerCard: React.FC<ServerCardProps> = ({ server, index, protocolLabel, nodesOnlineLabel }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col"
    >
      <Link 
        to={`/portal/${server.id}?token=DEMO_TOKEN_${Math.random().toString(36).substring(7)}`} 
        target="_blank"
        className="block relative"
      >
        <div className="aspect-square bg-zinc-50 rounded-[4rem] overflow-hidden relative mb-10 shadow-xs group-hover:shadow-[0_32px_64px_rgba(0,0,0,0.08)] group-hover:-translate-y-4 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]">
          <img 
            src={server.image} 
            className="w-full h-full object-cover group-hover:scale-110 transition-all duration-1000 ease-out grayscale group-hover:grayscale-0" 
            alt={server.name}
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="absolute top-10 left-10 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
             <div className="px-4 py-1.5 bg-white/95 backdrop-blur-xl text-black text-[9px] font-black uppercase tracking-[0.3em] rounded-sm italic shadow-2xl">
                {protocolLabel}{server.version}
             </div>
          </div>
          <div className="absolute bottom-10 right-10">
             <div className="w-16 h-16 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-700 delay-100">
                <GeometricLantern variant="network" className="w-8 h-8 text-black group-hover:translate-x-1 transition-transform" />
             </div>
          </div>
        </div>
        <div className="space-y-6 px-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              {server.tags.slice(0, 2).map((tag: string) => (
                <span key={tag} className="text-[9px] font-black font-mono text-zinc-300 uppercase tracking-[0.4em] bg-zinc-50 border border-zinc-100 px-3 py-1 rounded-sm group-hover:border-zinc-200 group-hover:text-zinc-500 transition-all italic">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex flex-col items-end -space-y-1">
               <span className="text-[10px] font-black font-mono italic group-hover:text-black transition-colors">{server.players}</span>
               <span className="text-[8px] font-black text-zinc-200 uppercase tracking-widest italic group-hover:text-green-500 transition-colors">{nodesOnlineLabel}</span>
            </div>
          </div>
          <h3 className="text-4xl font-black tracking-tighter leading-none group-hover:text-black transition-colors uppercase italic group-hover:translate-x-2 transition-transform duration-500">
            {server.name}
          </h3>
          <p className="text-zinc-400 font-bold text-sm line-clamp-2 leading-relaxed italic opacity-80 group-hover:opacity-100 transition-opacity">
            {server.description}
          </p>
        </div>
      </Link>
    </motion.div>
  );
};

export default React.memo(ServerCard);
