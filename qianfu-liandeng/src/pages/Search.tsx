import React, { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import GeometricLantern from '@/components/icons/GeometricLantern';

const CATEGORIES = ['生存', '创造', 'PVP', '模组', '小游戏', 'RPG', '纯净', '空岛', '科技', '魔法'];
const VERSIONS = ['1.20.x', '1.19.x', '1.18.x', '1.16.x', '1.12.2', '1.8.x', '基岩版'];

const resultCardBase = 'group block space-y-8';

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const navigate = useNavigate();

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="min-h-screen bg-white selection:bg-accent selection:text-white">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-12 py-24 sm:py-32">
        <header className="mb-24 sm:mb-32 space-y-8 border-b border-zinc-50 pb-16">
           <div className="flex items-center gap-4">
              <div className="px-5 py-2 border border-zinc-100 bg-white rounded-sm text-[10px] font-black uppercase tracking-[0.4em] italic shadow-xs flex items-center gap-3">
                 <GeometricLantern variant="spark" className="w-4 h-4" /> 通用发现 / 搜索核心
              </div>
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-accent" />
           </div>
           <motion.h1 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             className="text-6xl sm:text-7xl lg:text-[9rem] font-black tracking-tighter uppercase leading-[0.85] text-black italic break-words"
           >
              探索 <br />
              <span className="text-zinc-200">网络世界。</span>
           </motion.h1>
           <p className="text-zinc-400 font-bold max-w-2xl text-lg sm:text-xl lg:text-2xl leading-relaxed italic">
              通过高级多维筛选发现下一个值得入驻的世界。我们实时索引超过 12,000+ 服务器节点。
           </p>
        </header>

        <div className="max-w-5xl space-y-24">
           {/* Search Input Area */}
           <div className="relative group">
              <GeometricLantern variant="spark" className="absolute left-8 top-1/2 -translate-y-1/2 w-8 h-8 text-zinc-300 group-focus-within:text-black transition-all" />
              <input 
                type="text" 
                placeholder="搜索服务器名称、描述、IP 地址或标签..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-24 pr-12 py-6 sm:py-8 lg:py-10 bg-zinc-50 border border-transparent focus:bg-white focus:border-black rounded-[2rem] sm:rounded-[2.5rem] transition-all outline-hidden text-lg sm:text-xl lg:text-2xl font-black tracking-tight shadow-xs italic"
              />
              <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-3">
                 <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 rounded-lg border border-zinc-200">
                    <GeometricLantern variant="terminal" className="w-3 h-3 text-zinc-400" />
                    <span className="text-[10px] font-black font-mono text-zinc-400">ENTER</span>
                 </div>
              </div>
           </div>

           {/* Filter System */}
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
              <div className="lg:col-span-8 space-y-10">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2 italic break-words">
                       <GeometricLantern variant="settings" className="w-3.5 h-3.5" /> 发现标签
                    </h3>
                    {selectedTags.length > 0 && (
                      <button type="button" onClick={() => setSelectedTags([])} className="text-[10px] font-black text-destructive uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity italic">
                         <X className="w-3 h-3" /> 清除筛选
                      </button>
                    )}
                 </div>
                 <div className="flex flex-wrap gap-3">
                    {CATEGORIES.map(tag => (
                      <button type="button" 
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border italic ${
                          selectedTags.includes(tag) 
                            ? 'bg-black text-white border-black shadow-2xl shadow-black/20 scale-105' 
                            : 'bg-white border-zinc-100 text-zinc-400 hover:border-black hover:text-black'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="lg:col-span-4 space-y-10">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black font-mono uppercase tracking-[0.2em] text-muted-foreground italic">版本节点</h3>
                    {selectedVersion && <button type="button" onClick={() => setSelectedVersion(null)} className="text-[10px] font-bold text-muted-foreground hover:text-black uppercase tracking-widest italic">重置</button>}
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    {VERSIONS.map(v => (
                      <button type="button" 
                        key={v}
                        onClick={() => setSelectedVersion(v)}
                        className={`px-6 py-3 rounded-2xl text-[10px] font-black font-mono tracking-tighter border transition-all italic ${
                          selectedVersion === v 
                            ? 'bg-black text-white border-black' 
                            : 'bg-zinc-50 border-transparent text-zinc-400 hover:border-black hover:text-black'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                 </div>
              </div>
           </div>

           {/* Execution Bar */}
           <div className="pt-12 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex gap-8">
                 <button type="button" className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-widest italic">
                    <GeometricLantern variant="user" className="w-4 h-4 text-zinc-300 group-hover:text-black transition-colors" /> 热度高
                 </button>
                 <button type="button" className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-black transition-colors italic">
                    <GeometricLantern variant="network" className="w-4 h-4 text-zinc-300 group-hover:text-black transition-colors" /> 最近动态
                 </button>
                 <button type="button" className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-black transition-colors italic">
                    <GeometricLantern variant="spark" className="w-4 h-4 text-zinc-300 group-hover:text-black transition-colors" /> 算法推荐
                 </button>
              </div>
              <button type="button" 
                onClick={() => navigate('/servers')}
                className="w-full md:w-auto px-16 py-6 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-black/10 italic active:scale-95"
              >
                 执行查询系统 <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
        </div>

        {/* Dynamic Recommendations */}
        <section className="mt-64 space-y-16">
           <header className="flex items-end justify-between border-b border-zinc-100 pb-8">
              <div className="space-y-1">
                 <h2 className="text-4xl font-black tracking-tighter uppercase italic">精选发现。</h2>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">基于您最近的浏览行为 / NOC_RECOMMEND</p>
              </div>
              <button type="button" className="px-6 py-2 bg-zinc-100 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-black hover:text-white transition-all italic">
                 刷新结果
              </button>
           </header>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[1,2,3].map(i => (
                <Link key={i} to="/servers" className={resultCardBase}>
                   <div className="w-full aspect-video bg-zinc-50 rounded-[2.5rem] overflow-hidden relative border border-transparent group-hover:border-black transition-all duration-700 ease-out shadow-xs group-hover:shadow-2xl">
                      <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                      <div className="absolute top-8 left-8 px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm italic">
                         分类：RPG
                      </div>
                   </div>
                   <div className="space-y-4 px-2">
                      <div className="flex items-center gap-2 text-[9px] font-black font-mono text-zinc-400 uppercase tracking-widest italic">
                         <GeometricLantern variant="network" className="w-3 h-3" /> 12ms 延迟 / 亚洲北部
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase group-hover:text-black transition-colors italic group-hover:translate-x-2 transition-transform duration-500 break-words">服务器节点 #{i}</h3>
                      <p className="text-muted-foreground font-medium leading-relaxed line-clamp-2 italic">
                         一个高精度的生存与角色扮演服务器，内置完整的经济系统与社区自治法案。
                      </p>
                      <div className="flex items-center justify-between pt-4">
                         <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <span className="text-[10px] font-black font-mono uppercase tracking-widest italic">4.2k 日活跃</span>
                         </div>
                         <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-500">
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                         </div>
                      </div>
                   </div>
                </Link>
              ))}
           </div>
        </section>
      </div>
    </div>
  );
};

export default SearchPage;
