import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Check, Copy } from 'lucide-react';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { copyText } from '@/utils/clipboard';
import { toast } from '@/hooks/use-toast';
import {
  getServerAvailability,
  getServerFreshnessLabel,
  getServerName,
  getServerPlatformLabel,
  getServerPlayerLabel,
  getServerSummary,
  getServerThumbnail,
  getServerVersionLabels,
  parseListField,
} from '@/utils/serverView';
import type { ServerListItem } from '@/types/server';

interface ServerCardProps {
  server: ServerListItem;
  index: number;
  protocolLabel: string;
  nodesOnlineLabel: string;
}

const ServerCard: React.FC<ServerCardProps> = ({ server, index, protocolLabel, nodesOnlineLabel }) => {
  const [copied, setCopied] = useState(false);
  const tags = parseListField(server.tags).slice(0, 2);
  const name = getServerName(server);
  const image = getServerThumbnail(server);
  const players = getServerPlayerLabel(server);
  const description = getServerSummary(server);
  const versions = getServerVersionLabels(server);
  const availability = getServerAvailability(server);
  const endpoint = String(server.ip || '').trim();
  const availabilityLabel = availability === 'online' ? '在线' : availability === 'offline' ? '离线' : '未知';
  const availabilityClass = availability === 'online'
    ? 'bg-emerald-50 text-emerald-700'
    : availability === 'offline'
      ? 'bg-red-50 text-red-700'
      : 'bg-zinc-100 text-zinc-500';

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!endpoint) {
      toast({ title: '该服务器未公开连接地址', variant: 'destructive' });
      return;
    }
    try {
      await copyText(endpoint);
      setCopied(true);
      toast({ title: '服务器地址已复制' });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: '复制失败，请手动查看连接地址', variant: 'destructive' });
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="group flex h-full flex-col"
    >
      <div className="relative flex h-full flex-col">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2.5rem] bg-zinc-50 shadow-xs transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-2 group-hover:shadow-[0_24px_48px_rgba(0,0,0,0.08)]">
            {image ? <img
              src={image}
              className="w-full h-full object-cover group-hover:scale-110 transition-all duration-1000 ease-out grayscale group-hover:grayscale-0"
              alt={name}
              loading="lazy"
              decoding="async"
            /> : <div className="flex h-full items-center justify-center text-[10px] font-semibold tracking-wide text-zinc-300">暂无封面</div>}
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="absolute left-6 top-6 translate-y-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
             <div className="px-4 py-1.5 bg-white/95 backdrop-blur-xl text-black text-[9px] font-semibold tracking-wide rounded-sm shadow-2xl">
                 {protocolLabel}{versions[0] || '版本未填'}
             </div>
          </div>
          <div className="absolute bottom-6 right-6">
             <div className="flex h-12 w-12 translate-y-8 items-center justify-center rounded-2xl bg-white opacity-0 shadow-2xl transition-all delay-100 duration-700 group-hover:translate-y-0 group-hover:opacity-100">
                <GeometricLantern variant="network" className="h-6 w-6 text-black transition-transform group-hover:translate-x-1" />
             </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-5">
          <div className="flex min-h-8 items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${availabilityClass}`}>
                {availabilityLabel}
              </span>
                {tags.map((tag: string) => (
                <span key={tag} className="rounded-sm border border-zinc-100 bg-zinc-50 px-2.5 py-1 font-mono text-[9px] font-medium tracking-normal text-zinc-400 transition-all group-hover:border-zinc-200 group-hover:text-zinc-500">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 flex-col items-end leading-none">
               <span className="font-mono text-[10px] font-semibold transition-colors group-hover:text-black">{players}</span>
               <span className="mt-1 font-mono text-[8px] font-medium tracking-normal text-zinc-300 transition-colors group-hover:text-green-500">{nodesOnlineLabel}</span>
            </div>
          </div>
          <h3 className="line-clamp-2 text-2xl font-bold leading-tight tracking-tight transition-transform duration-500 group-hover:translate-x-1 group-hover:text-black">
             {name}
          </h3>
              <p className="line-clamp-2 text-sm font-medium leading-relaxed text-zinc-400 opacity-80 transition-opacity group-hover:opacity-100">
             {description}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-100 pt-4 text-xs font-bold text-zinc-500">
            <span className="truncate">{getServerPlatformLabel(server)}</span>
            <span className="truncate text-right">{versions.slice(0, 2).join(' / ') || '版本未填'}</span>
            <span className="col-span-2 truncate text-[10px] font-medium text-zinc-400">{getServerFreshnessLabel(server)}</span>
          </div>
          <div className="mt-auto flex items-center gap-2 pt-1">
             <Link to={`/server/${server.id}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-zinc-800">
              查看详情
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="复制服务器地址"
              title={endpoint ? '复制服务器地址' : '该服务器未公开连接地址'}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-600 transition-colors hover:border-black hover:text-black"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export default React.memo(ServerCard);
