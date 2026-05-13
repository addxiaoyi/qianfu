import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Download,
  ExternalLink,
  Globe,
  Library,
  Search,
  Sparkles,
  Store,
  Wrench,
} from 'lucide-react';
import { api } from '@/api/request';
import { isImageUrlSafe } from '@/utils/urlValidator';

type MarketplaceProduct = {
  id: string;
  title: string;
  category: string;
  price: number;
  sales: number;
  rating: number;
  reviewCount: number;
  author: string;
  coverUrl?: string;
};

const CATEGORIES = [
  { id: 'Official', name: '官方', icon: Globe },
  { id: 'Community', name: '社区', icon: Library },
  { id: 'Wiki', name: '百科', icon: Library },
  { id: 'Resources', name: '资源', icon: Download },
  { id: 'Tools', name: '工具', icon: Wrench },
  { id: 'Software', name: '软件', icon: Download },
];

const RESOURCES = [
  { title: 'Minecraft Official', url: 'https://www.minecraft.net/zh-hans', description: 'Minecraft官网', category: 'Official' },
  { title: 'MC China', url: 'https://mc.163.com/m/', description: 'MC中国版官网', category: 'Official' },
  { title: 'Minecraft Forum', url: 'https://www.minecraftforum.net/', description: '国外著名非官方论坛', category: 'Community' },
  { title: 'MineBBS', url: 'https://www.minebbs.com/', description: '国内中文论坛，主营基岩版', category: 'Community' },
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
  const [marketplaceProducts, setMarketplaceProducts] = useState<MarketplaceProduct[]>([]);
  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [marketSort, setMarketSort] = useState<'featured' | 'sales' | 'rating' | 'latest'>('featured');

  useEffect(() => {
    setLoadingMarketplace(true);
    api
      .get<{ products: MarketplaceProduct[]; total?: number; hasMore?: boolean }>(`/qianfu/marketplace/products?sortBy=${marketSort}&page=1&pageSize=6`)
      .then((data) => setMarketplaceProducts(data.products || []))
      .catch(() => setMarketplaceProducts([]))
      .finally(() => setLoadingMarketplace(false));
  }, [marketSort]);

  const filtered = RESOURCES.filter(
    (res) =>
      res.category === activeCat &&
      (res.title.toLowerCase().includes(search.toLowerCase()) || res.description.includes(search))
  );

  const featuredMarketplace = useMemo(() => {
    const list = [...marketplaceProducts];
    if (marketSort === 'sales') return list.sort((a, b) => b.sales - a.sales).slice(0, 6);
    if (marketSort === 'rating') return list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 6);
    if (marketSort === 'latest') return list.sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);
    return list.slice(0, 6);
  }, [marketSort, marketplaceProducts]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <header className="mb-12 sm:mb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8">
            <div className="space-y-3 sm:space-y-4">
              <div className="text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">RESOURCE CENTER</div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight">资源中心</h1>
              <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-lg">
                整理常用的官方链接、社区论坛、技术百科与实用工具，并聚合玩家店铺与商品。
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索资源..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-muted border-none rounded-xl focus:ring-2 focus:ring-black/5 transition-all outline-hidden font-medium text-sm"
              />
            </div>
          </div>
        </header>

        <div className="space-y-10 sm:space-y-12">
          <section className="rounded-[2rem] border border-border bg-card p-5 sm:p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">MARKETPLACE</div>
                <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                  <Store className="w-7 h-7 sm:w-8 sm:h-8" /> 玩家店铺与商品
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">这里展示玩家开设的店铺、热销商品和精选内容。</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {(['featured', 'sales', 'rating', 'latest'] as const).map((sortKey) => (
                  <button
                    key={sortKey}
                    onClick={() => setMarketSort(sortKey)}
                    className={`rounded-full px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.22em] transition-all ${
                      marketSort === sortKey ? 'bg-black text-white' : 'bg-muted text-muted-foreground hover:bg-zinc-200'
                    }`}
                  >
                    {sortKey === 'featured' && '精选'}
                    {sortKey === 'sales' && '热销'}
                    {sortKey === 'rating' && '高分'}
                    {sortKey === 'latest' && '最新'}
                  </button>
                ))}
                <Link to="/marketplace/shop" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-bold">
                  <Sparkles className="w-4 h-4" /> 逛市场
                </Link>
              </div>
            </div>

            {loadingMarketplace ? (
              <div className="text-sm text-muted-foreground">正在加载玩家店铺...</div>
            ) : featuredMarketplace.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {featuredMarketplace.map((item) => (
                  <Link
                    key={item.id}
                    to={`/marketplace/products/${item.id}`}
                    className="rounded-2xl border border-border bg-background p-4 hover:border-black hover:shadow-lg transition-all group overflow-hidden"
                  >
                    <div className="relative mb-4 h-32 overflow-hidden rounded-2xl bg-muted">
                      <img
                        src={(item.coverUrl && isImageUrlSafe(item.coverUrl)) ? item.coverUrl : 'https://picsum.photos/seed/market-default/800/500'}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-transparent" />
                      <div className="absolute left-3 top-3 rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                        {item.category}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">{item.author}</div>
                        <div className="mt-2 font-bold line-clamp-1">{item.title}</div>
                      </div>
                      <BadgeCheck className="w-5 h-5 text-accent shrink-0" />
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>¥{item.price}</span>
                      <span>· 销量 {item.sales}</span>
                      <span>· 评分 {item.rating}</span>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground line-clamp-2">{item.reviewCount} 条评价</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
                暂无玩家店铺商品
              </div>
            )}
          </section>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <aside className="w-full lg:w-48 shrink-0">
              <div className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCat(cat.id)}
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
                    filtered.map((res) => (
                      <a
                        key={res.url}
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
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
                    ))
                  ) : (
                    <div className="col-span-full py-16 sm:py-20 text-center border-2 border-dashed border-border rounded-3xl">
                      <p className="text-sm font-bold text-muted-foreground">未找到相关资源</p>
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
