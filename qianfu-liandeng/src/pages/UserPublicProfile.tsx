import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import { motion } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT } from '@/store/uiStore';
import { isImageUrlSafe } from '@/utils/urlValidator';
import PageSeo from '@/components/PageSeo';

const stripHtml = (value: unknown) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const truncateText = (value: unknown, maxLength = 155) => {
  const text = stripHtml(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
};

const UserPublicProfile: React.FC = () => {
  const t = useT();
  const { id } = useParams();
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['user-public', id],
    queryFn: () => request<any>(`/public/users/${id}`),
  });

  return (
    <StatusWrapper isLoading={isLoading} isError={isError}>
      {profile && (
        <PageSeo
          title={`${profile.username || '玩家'} 的公开主页 - 千服联灯`}
          description={truncateText(profile.bio || `${profile.username || '该玩家'} 在千服联灯发布和收藏 Minecraft 服务器内容。`)}
          canonicalPath={`/user/${id}`}
          image={isImageUrlSafe(profile.avatar_url) ? profile.avatar_url : undefined}
          schema={{
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: {
              '@type': 'Person',
              name: profile.username || `用户 ${id}`,
              description: truncateText(profile.bio || ''),
            },
          }}
        />
      )}
      <div className="max-w-7xl mx-auto px-6 py-32 bg-white selection:bg-accent selection:text-white">
        {/* Header */}
        <div className="bg-black rounded-[4rem] p-16 text-white mb-24 relative overflow-hidden shadow-2xl shadow-black/20 group">
           <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '48px 48px' }} />
           
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-12 text-center md:text-left">
              <div className="w-40 h-40 bg-zinc-900 rounded-[2.5rem] border-4 border-zinc-800 flex items-center justify-center text-6xl font-black italic shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-700">
                 {profile?.username?.[0]}
              </div>

              <div className="flex-grow space-y-6">
                 <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <h1 className="text-6xl font-black tracking-tighter uppercase italic leading-none">{profile?.username}</h1>
                    <div className="px-5 py-2 bg-accent/20 border border-accent/30 rounded-sm text-[10px] font-black uppercase tracking-[0.3em] text-accent italic">Lv.12 Member_Node</div>
                 </div>
                 <p className="text-xl text-zinc-400 font-bold italic leading-relaxed max-w-2xl">{profile?.bio || t('profile.public.mysterious')}</p>
                 <div className="flex flex-wrap justify-center md:justify-start gap-8 pt-4">
                    <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 italic">
                       <GeometricLantern variant="activity" className="w-5 h-5 text-accent" /> {t('profile.public.joined')} {profile?.joinDate}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 italic">
                       <GeometricLantern variant="spark" className="w-5 h-5 text-accent" /> {t('profile.public.likes')} {profile?.totalLikes}
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Published Servers */}
        <div className="space-y-16">
          <h2 className="text-5xl font-black italic uppercase tracking-tighter flex items-center gap-6">
            <GeometricLantern variant="network" className="w-10 h-10 text-black" /> {t('profile.public.servers')} ({profile?.servers?.length || 0})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {profile?.servers?.map((server: any, i: number) => (
              <motion.div 
                key={server.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white border border-zinc-50 rounded-[3.5rem] overflow-hidden group hover:border-black transition-all duration-700 shadow-xs hover:shadow-2xl"
              >
                 <div className="aspect-video bg-zinc-50 relative overflow-hidden">
                    {isImageUrlSafe(server.image) ? (
                      <img src={server.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-100"><GeometricLantern variant="network" className="w-10 h-10 text-zinc-200" /></div>
                    )}
                 </div>
                 <div className="p-10 space-y-8">
                    <h3 className="text-2xl font-black italic uppercase tracking-tight leading-none">{server.name}</h3>
                    <div className="flex justify-between items-center text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">
                       <span className="flex items-center gap-2"><GeometricLantern variant="user" className="w-4 h-4 text-accent" /> {server.players}</span>
                       <span className="flex items-center gap-2"><GeometricLantern variant="spark" className="w-4 h-4 text-accent" /> {server.likes}</span>
                    </div>
                    <Link to={`/server/${server.id}`} className="w-full py-6 bg-zinc-50 border border-zinc-100 hover:bg-black hover:text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.5em] flex items-center justify-center transition-all italic active:scale-95 shadow-xs">
                       {t('profile.public.view_detail')}
                    </Link>
                 </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </StatusWrapper>
  );
};

export default UserPublicProfile;
