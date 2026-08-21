import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Download,
  ExternalLink,
  Globe,
  Library,
  Search,
  Wrench,
} from 'lucide-react';
import { sanitizeUrl } from '@/utils/urlValidator';

const CATEGORIES = [
  { id: 'Official', name: '官方', icon: Globe },
  { id: 'Wiki', name: '百科', icon: Library },
  { id: 'Resources', name: '资源', icon: Download },
  { id: 'Tools', name: '工具', icon: Wrench },
  { id: 'Software', name: '软件', icon: Download },
];

const RESOURCES = [
  { title: 'Minecraft Official', url: 'https://www.minecraft.net/zh-hans', description: 'Minecraft官网', category: 'Official' },
  { title: 'MC China', url: 'https://mc.163.com/m/', description: 'MC中国版官网', category: 'Official' },
  { title: 'Minecraft Wiki', url: 'https://zh.minecraft.wiki/', description: '最权威的非官方百科', category: 'Wiki' },
  { title: 'MCMod', url: 'https://www.mcmod.cn/', description: '国内著名模组百科', category: 'Wiki' },
  { title: 'Modrinth', url: 'https://modrinth.com/', description: '新兴第三方资源站', category: 'Resources' },
  { title: 'CurseForge', url: 'https://www.curseforge.com/minecraft', description: '老牌资源站', category: 'Resources' },
  { title: 'Chunk Base', url: 'https://www.chunkbase.com/', description: '种子/区块查询工具', category: 'Tools' },
  { title: 'mcsrvstat.us', url: 'https://mcsrvstat.us/', description: '服务器状态检测', category: 'Tools' },
  { title: 'HMCL', url: 'https://hmcl.huangyuhui.net/', description: '经典跨平台启动器', category: 'Software' },
  { title: 'PCL2', url: 'https://afdian.com/p/0164034c016c11ebafcb52540025c377', description: '新兴启动器', category: 'Software' },
];

const ResourceCenter: React.FC = () => {
  const [activeCat, setActiveCat] = useState('Official');
  const [search, setSearch] = useState('');

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = RESOURCES.filter(
    (res) =>
      res.category === activeCat &&
      (!normalizedSearch ||
        res.title.toLowerCase().includes(normalizedSearch) ||
        res.description.toLowerCase().includes(normalizedSearch))
  );
  const resourceSearchStatus = normalizedSearch
    ? `找到 ${filtered.length} 个匹配资源`
    : `当前分类共有 ${filtered.length} 个资源`;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <header className="mb-12 sm:mb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8">
            <div className="space-y-3 sm:space-y-4">
              <div className="text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">RESOURCE CENTER</div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight">资源中心</h1>
              <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-lg">
                整理常用的官方链接、技术百科与实用工具，帮助玩家和服主快速找到可靠入口。
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                name="resourceSearch"
                aria-label="搜索资源"
                aria-describedby="resource-search-status"
                autoComplete="off"
                spellCheck={false}
                placeholder="搜索资源…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-muted border-none rounded-xl focus-visible:ring-2 focus-visible:ring-black/20 transition-[box-shadow,background-color] outline-hidden font-medium text-sm"
              />
              <p id="resource-search-status" role="status" aria-live="polite" className="sr-only">
                {resourceSearchStatus}
              </p>
            </div>
          </div>
        </header>

        <section className="mb-12 rounded-[2rem] border border-border bg-card p-5 sm:p-6 md:p-8 shadow-sm">
          <div className="max-w-4xl space-y-3">
            <div className="text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">资源概览</div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Minecraft 工具、社区与店铺聚合页</h2>
            <p className="text-sm sm:text-base text-muted-foreground font-medium leading-7">
              千服联灯资源中心整理 Minecraft 官方网站、百科、启动器和常用工具，也聚合玩家店铺与商品，适合玩家和服主快速找到可靠入口。
            </p>
          </div>
        </section>

        <div className="space-y-10 sm:space-y-12">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <aside className="w-full lg:w-48 shrink-0">
              <div className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
                {CATEGORIES.map((cat) => (
                  <button type="button"
                    key={cat.id}
                    onClick={() => setActiveCat(cat.id)}
                    aria-pressed={activeCat === cat.id}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                      activeCat === cat.id ? 'bg-black text-white' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <cat.icon className="w-4 h-4" />
                    {cat.name}
                  </button>
                ))}
              </div>
            </aside>

            <div className="flex-grow min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCat}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6"
                >
                  {filtered.length > 0 ? (
                    filtered.map((res) => {
                      const safeUrl = sanitizeUrl(res.url, '#');
                      return (
                      <a
                        key={res.url}
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={safeUrl === '#' ? (event) => event.preventDefault() : undefined}
                        className="p-4 sm:p-6 border border-border rounded-2xl hover:border-black hover:shadow-xl hover:shadow-black/5 transition-all group bg-card"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center font-mono font-bold text-xs group-hover:bg-black group-hover:text-white transition-colors">
                            {res.title[0]}
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                        <h3 className="font-bold mb-2 group-hover:text-black transition-colors">{res.title}</h3>
                        <p className="text-xs text-muted-foreground font-medium line-clamp-2 h-8">{res.description}</p>
                        <div className="mt-6 pt-4 border-t border-dashed border-border flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{res.category}</span>
                          <span className="text-[10px] font-mono text-black font-bold uppercase opacity-0 group-hover:opacity-100 transition-all">Visit site</span>
                        </div>
                      </a>
                      );
                    })
                  ) : (
                    <div className="col-span-full py-16 sm:py-20 px-6 text-center border-2 border-dashed border-border rounded-3xl" role="status" aria-live="polite">
                      <p className="text-sm font-bold text-muted-foreground">
                        {normalizedSearch ? `没有找到与“${search.trim()}”匹配的资源` : '当前分类暂无资源'}
                      </p>
                      {normalizedSearch ? (
                        <button
                          type="button"
                          onClick={() => setSearch('')}
                          className="mt-5 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
                        >
                          清除搜索条件
                        </button>
                      ) : null}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceCenter;
