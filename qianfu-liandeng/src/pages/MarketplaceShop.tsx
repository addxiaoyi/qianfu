import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpDown, BadgeCheck, BarChart3, Clock3, Lock, Palette, RotateCcw, Save, ShoppingCart, Sparkles } from 'lucide-react';
import { api } from '@/api/request';
import { sanitizeUrl, isUrlSafe, isImageUrlSafe } from '@/utils/urlValidator';

type Product = {
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

type BannerCard = { title: string; text: string };

type ShopConfig = {
  bannerUrl: string;
  avatarUrl: string;
  announcementTitle: string;
  announcementText: string;
  bio: string;
  shopName: string;
  ownerId?: number | null;
  theme?: 'default' | 'tech' | 'minimal' | 'creator';
};

type ShopMetrics = { visits: number; announcementClicks: number; featuredClicks: number; updatedAt: string };
type ShopVersion = { id: string; createdAt: string; config: ShopConfig };


const defaultConfig: ShopConfig = {
  bannerUrl: 'https://picsum.photos/seed/shop-banner/1600/500',
  avatarUrl: 'https://picsum.photos/seed/shop-avatar/400/400',
  announcementTitle: '公告',
  announcementText: '每周上新资源，持续更新售后与兼容性说明。',
  bio: '专注 Minecraft 资源创作与持续更新，提供地图、插件、模组与整合包。',
  shopName: '创作者店铺',
  theme: 'default',
};

const themeNames: Record<NonNullable<ShopConfig['theme']>, string> = {
  default: '默认',
  tech: '科技风',
  minimal: '极简风',
  creator: '创作者风',
};

export default function MarketplaceShop() {
  const { userId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState<'hot' | 'sales' | 'rating'>('hot');
  const [config, setConfig] = useState<ShopConfig>(defaultConfig);
  const [editable, setEditable] = useState(false);
  const [metrics, setMetrics] = useState<ShopMetrics>({ visits: 0, announcementClicks: 0, featuredClicks: 0, updatedAt: new Date().toISOString() });
  const [versions, setVersions] = useState<ShopVersion[]>([]);
  const [themes, setThemes] = useState<NonNullable<ShopConfig['theme']>[]>(['default', 'tech', 'minimal', 'creator']);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [form, setForm] = useState<ShopConfig>(defaultConfig);
  const [savingShopConfig, setSavingShopConfig] = useState(false);
  const [shopConfigMessage, setShopConfigMessage] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<ShopVersion | null>(null);

  const hydrate = (payload: { config: ShopConfig; editable?: boolean; metrics?: ShopMetrics; versions?: ShopVersion[] }) => {
    const raw = payload.config || {};
    const sanitized: ShopConfig = {
      ...raw,
      bannerUrl: sanitizeUrl(raw.bannerUrl, defaultConfig.bannerUrl),
      avatarUrl: sanitizeUrl(raw.avatarUrl, defaultConfig.avatarUrl),
    };
    const next = { ...defaultConfig, ...sanitized };
    setConfig(next);
    setForm(next);
    setEditable(!!payload.editable);
    if (payload.metrics) setMetrics(payload.metrics);
    if (payload.versions) setVersions(payload.versions);
  };

  useEffect(() => {
    api.get<{ config: ShopConfig; editable: boolean; metrics: ShopMetrics; versions: ShopVersion[] }>('/qianfu/marketplace/shop/config').then(hydrate).catch(() => undefined);
    api.get<{ themes: Array<ShopConfig['theme']> }>('/qianfu/marketplace/shop/themes').then((data) => setThemes((data.themes || []).filter((theme): theme is NonNullable<ShopConfig['theme']> => Boolean(theme)))).catch(() => undefined);
    api.get<{ products: Product[]; total: number }>('/qianfu/marketplace/me/listings')
      .then((data) => setProducts((data.products || []).filter((item) => String(item.author) === String(userId || item.author))))
      .catch(() => setProducts([]));
    api.get<{ metrics: ShopMetrics; versions: ShopVersion[] }>('/qianfu/marketplace/shop/metrics').then((data) => {
      if (data.metrics) setMetrics(data.metrics);
      if (data.versions) setVersions(data.versions);
    }).catch(() => undefined);
  }, [userId]);

  const summary = useMemo(() => ({
    total: products.length,
    sales: products.reduce((sum, item) => sum + item.sales, 0),
    rating: products.length ? products.reduce((sum, item) => sum + item.rating, 0) / products.length : 0,
    reviews: products.reduce((sum, item) => sum + item.reviewCount, 0),
  }), [products]);

  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sortBy === 'sales') return list.sort((a, b) => b.sales - a.sales);
    if (sortBy === 'rating') return list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    return list.sort((a, b) => (b.sales * 0.7 + b.rating * 20) - (a.sales * 0.7 + a.rating * 20));
  }, [products, sortBy]);

  const featured = sortedProducts.slice(0, 3);
  const banners: BannerCard[] = [
    { title: config.announcementTitle, text: config.announcementText },
    { title: '精选', text: '热销 / 高评分 / 新上架三类内容轮播展示。' },
    { title: '福利', text: '关注店铺可第一时间获取折扣与更新通知。' },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setActiveBannerIndex((current) => (current + 1) % banners.length), 4000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    if (!featured.length) return;
    const timer = window.setInterval(() => setActiveFeaturedIndex((current) => (current + 1) % featured.length), 4500);
    return () => window.clearInterval(timer);
  }, [featured.length]);

  const activeBanner = banners[activeBannerIndex % banners.length];
  const activeFeatured = featured[activeFeaturedIndex % Math.max(featured.length, 1)];

  const saveConfig = async () => {
    setSavingShopConfig(true);
    try {
      const result = await api.put<{ config: ShopConfig }>('/qianfu/marketplace/shop/config', form);
      hydrate({ config: result.config, editable, metrics, versions });
      setShopConfigMessage('店铺配置已保存到后端');
      setTimeout(() => setShopConfigMessage(''), 2500);
      setEditingAnnouncement(false);
    } catch (error: any) {
      setShopConfigMessage(error?.message || '保存失败');
    } finally {
      setSavingShopConfig(false);
    }
  };

  const resetConfig = async () => {
    setSavingShopConfig(true);
    try {
      const result = await api.post<{ config: ShopConfig }>('/qianfu/marketplace/shop/config/reset', {});
      hydrate({ config: result.config, editable, metrics, versions });
      setShopConfigMessage('已重置为默认配置');
      setTimeout(() => setShopConfigMessage(''), 2500);
    } catch (error: any) {
      setShopConfigMessage(error?.message || '重置失败');
    } finally {
      setSavingShopConfig(false);
    }
  };

  const applyTheme = async (theme: NonNullable<ShopConfig['theme']>) => {
    setSavingShopConfig(true);
    try {
      const result = await api.post<{ config: ShopConfig }>(`/qianfu/marketplace/shop/theme/${theme}`, {});
      hydrate({ config: result.config, editable, metrics, versions });
      setShopConfigMessage(`已应用 ${themeNames[theme]} 主题`);
      setTimeout(() => setShopConfigMessage(''), 2000);
    } catch (error: any) {
      setShopConfigMessage(error?.message || '主题应用失败');
    } finally {
      setSavingShopConfig(false);
    }
  };

  const restoreVersion = async (version: ShopVersion) => {
    setSavingShopConfig(true);
    try {
      const result = await api.put<{ config: ShopConfig }>('/qianfu/marketplace/shop/config', version.config);
      hydrate({ config: result.config, editable, metrics, versions });
      setShopConfigMessage('已回滚到所选版本');
      setTimeout(() => setShopConfigMessage(''), 2000);
    } catch (error: any) {
      setShopConfigMessage(error?.message || '回滚失败');
    } finally {
      setSavingShopConfig(false);
    }
  };

  const bumpMetric = async (kind: 'announcement' | 'featured') => {
    await api.post('/qianfu/marketplace/shop/metrics/click', { kind }).catch(() => undefined);
    setMetrics((current) => ({ ...current, [kind === 'announcement' ? 'announcementClicks' : 'featuredClicks']: (current as any)[kind === 'announcement' ? 'announcementClicks' : 'featuredClicks'] + 1, updatedAt: new Date().toISOString() }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6 sm:space-y-8">
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="relative h-48 sm:h-56 md:h-72">
          {isImageUrlSafe(config.bannerUrl) ? (
            <img src={config.bannerUrl} alt="店铺 banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent/20 to-card flex items-center justify-center"><Sparkles className="w-10 h-10 text-accent/40" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 flex flex-col md:flex-row md:items-end gap-5">
            <div className="relative shrink-0">
              {isImageUrlSafe(config.avatarUrl) ? (
                <img src={config.avatarUrl} alt="店铺头像" className="w-24 h-24 md:w-28 md:h-28 rounded-3xl border-4 border-white object-cover shadow-xl ring-4 ring-black/10 transition-all duration-500" />
              ) : (
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl border-4 border-white bg-zinc-100 shadow-xl ring-4 ring-black/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-zinc-300" />
                </div>
              )}
              <div className="absolute -right-2 -bottom-2 w-8 h-8 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center text-white text-xs font-black shadow-lg">✓</div>
            </div>
            <div className="text-white space-y-3 max-w-4xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-[10px] font-black uppercase tracking-[0.45em]"><BadgeCheck className="w-3.5 h-3.5" /> Verified Seller</div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">{config.shopName}</h1>
              <p className="max-w-3xl leading-7 text-white/85">{config.bio}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 md:p-8 bg-background/60">
          <div className="rounded-2xl border border-border p-4 sm:p-5 bg-background/80"><div className="text-xs text-muted-foreground">商品数</div><div className="text-2xl sm:text-3xl font-black mt-2">{summary.total}</div></div>
          <div className="rounded-2xl border border-border p-4 sm:p-5 bg-background/80"><div className="text-xs text-muted-foreground">总销量</div><div className="text-2xl sm:text-3xl font-black mt-2">{summary.sales}</div></div>
          <div className="rounded-2xl border border-border p-4 sm:p-5 bg-background/80"><div className="text-xs text-muted-foreground">平均评分</div><div className="text-2xl sm:text-3xl font-black mt-2">{summary.rating.toFixed(1)}</div></div>
          <div className="rounded-2xl border border-border p-4 sm:p-5 bg-background/80"><div className="text-xs text-muted-foreground">总评论</div><div className="text-2xl sm:text-3xl font-black mt-2">{summary.reviews}</div></div>
        </div>
      </div>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className={`rounded-3xl border bg-card p-4 sm:p-6 md:p-8 space-y-4 shadow-sm ${editable ? 'border-border' : 'border-dashed opacity-95'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black">店铺公告</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {!editable && <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs font-bold text-muted-foreground"><Lock className="w-3.5 h-3.5" />仅店主可编辑</span>}
              {editable && <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold">可编辑</span>}
              <div className="flex items-center gap-2">
                {banners.map((_, index) => <button key={index} onClick={() => { setActiveBannerIndex(index); bumpMetric('announcement'); }} className={`w-2.5 h-2.5 rounded-full transition-all ${index === activeBannerIndex ? 'bg-black scale-110' : 'bg-muted-foreground/35'}`} />)}
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-gradient-to-br from-background to-muted/40 p-4 sm:p-5 min-h-[160px] sm:min-h-[180px] flex flex-col justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-black">{activeBanner.title}</div>
              <div className="text-xl sm:text-2xl font-black mt-3">{activeBanner.text}</div>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-5 sm:mt-6">公告会自动轮播，也可以手动点下方圆点切换。</div>
          </div>
          {editable ? (
            <>
              <button onClick={() => setEditingAnnouncement((current) => !current)} className="w-full sm:w-auto px-4 py-2 rounded-xl border border-border text-sm font-bold">{editingAnnouncement ? '收起编辑' : '编辑公告 / 头图'}</button>
              {editingAnnouncement && (
                <div className="space-y-4 rounded-3xl border border-dashed border-border p-4 sm:p-5 bg-muted/20">
                  {shopConfigMessage && <div className="rounded-2xl border border-border bg-background p-3 text-sm">{shopConfigMessage}</div>}
                  <div className="grid gap-3">
                    <input className="rounded-xl border border-border px-4 py-3 bg-background" value={form.bannerUrl} onChange={(e) => setForm((s) => ({ ...s, bannerUrl: e.target.value }))} placeholder="Banner 图片 URL" />
                    <input className="rounded-xl border border-border px-4 py-3 bg-background" value={form.avatarUrl} onChange={(e) => setForm((s) => ({ ...s, avatarUrl: e.target.value }))} placeholder="头像图片 URL" />
                    <input className="rounded-xl border border-border px-4 py-3 bg-background" value={form.shopName} onChange={(e) => setForm((s) => ({ ...s, shopName: e.target.value }))} placeholder="店铺名称" />
                    <input className="rounded-xl border border-border px-4 py-3 bg-background" value={form.bio} onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))} placeholder="店铺简介" />
                    <input className="rounded-xl border border-border px-4 py-3 bg-background" value={form.announcementTitle} onChange={(e) => setForm((s) => ({ ...s, announcementTitle: e.target.value }))} placeholder="公告标题" />
                    <textarea className="rounded-xl border border-border px-4 py-3 bg-background min-h-28" value={form.announcementText} onChange={(e) => setForm((s) => ({ ...s, announcementText: e.target.value }))} placeholder="公告内容" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button disabled={savingShopConfig} onClick={saveConfig} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"><Save className="w-4 h-4" /> {savingShopConfig ? '保存中...' : '保存店铺配置'}</button>
                    <button disabled={savingShopConfig} onClick={resetConfig} className="px-4 py-2 rounded-xl border border-border text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"><RotateCcw className="w-4 h-4" /> 重置默认</button>
                    <button onClick={() => setEditingAnnouncement(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-bold">取消</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">当前店铺配置只读，非店主不可修改。</div>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black">经营面板</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border"><BarChart3 className="w-3.5 h-3.5" /> 访问 {metrics.visits}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border"><Sparkles className="w-3.5 h-3.5" /> 公告点击 {metrics.announcementClicks}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border"><ShoppingCart className="w-3.5 h-3.5" /> 精选点击 {metrics.featuredClicks}</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {themes.map((theme) => (
              <button key={theme} disabled={!editable || savingShopConfig} onClick={() => applyTheme(theme)} className={`rounded-2xl border p-4 text-left transition-all ${config.theme === theme ? 'border-black bg-black text-white' : 'border-border bg-background hover:border-black'} ${!editable ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] font-black"><Palette className="w-3.5 h-3.5" />{themeNames[theme]}</div>
                <div className="text-sm mt-2 opacity-85">一键套用主题预设</div>
              </button>
            ))}
          </div>
          <div className="rounded-3xl border border-border bg-muted/20 p-5">
            <div className="flex items-center justify-between gap-3 mb-4"><h3 className="font-black">配置版本历史</h3><span className="text-xs text-muted-foreground">最近 {versions.length} 条</span></div>
            <div className="space-y-3 max-h-[320px] overflow-auto pr-1">
              {versions.length ? versions.map((version) => (
                <div key={version.id} className={`rounded-2xl border bg-background p-4 flex items-center justify-between gap-3 flex-wrap ${selectedVersion?.id === version.id ? 'border-black' : 'border-border'}`} onClick={() => setSelectedVersion(version)}>
                  <div>
                    <div className="text-xs text-muted-foreground">{version.createdAt}</div>
                    <div className="font-bold mt-1">{version.config.shopName} · {version.config.theme || 'default'}</div>
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-1">{version.config.announcementText}</div>
                  </div>
                  {editable && <button disabled={savingShopConfig} onClick={() => restoreVersion(version)} className="px-4 py-2 rounded-xl border border-border text-sm font-bold">回滚此版本</button>}
                </div>
              )) : <div className="text-sm text-muted-foreground">暂无版本历史</div>}
            </div>
            {selectedVersion && (
              <div className="mt-4 rounded-2xl border border-dashed border-border p-4 bg-white">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs text-muted-foreground">版本详情</div>
                    <div className="font-bold mt-1">{selectedVersion.config.shopName} · {selectedVersion.config.theme || 'default'}</div>
                  </div>
                  {editable && <button disabled={savingShopConfig} onClick={() => restoreVersion(selectedVersion)} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold">回滚到该版本</button>}
                </div>
                <div className="grid md:grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted-foreground mb-1">Banner</div><div className="break-all">{selectedVersion.config.bannerUrl}</div></div>
                  <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted-foreground mb-1">头像</div><div className="break-all">{selectedVersion.config.avatarUrl}</div></div>
                  <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted-foreground mb-1">公告</div><div className="break-words">{selectedVersion.config.announcementTitle} / {selectedVersion.config.announcementText}</div></div>
                  <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted-foreground mb-1">简介</div><div className="break-words">{selectedVersion.config.bio}</div></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black">精选轮播</h2>
            <div className="flex items-center gap-2">
              {featured.map((_, index) => <button key={index} onClick={() => { setActiveFeaturedIndex(index); bumpMetric('featured'); }} className={`w-2.5 h-2.5 rounded-full transition-all ${index === activeFeaturedIndex ? 'bg-black scale-110' : 'bg-muted-foreground/35'}`} />)}
            </div>
          </div>
          {activeFeatured ? (
            <Link to={`/marketplace/${activeFeatured.id}`} className="block rounded-3xl overflow-hidden border border-border bg-muted/20 hover:border-black transition-all" onClick={() => bumpMetric('featured')}>
              <div className="h-44 sm:h-56 bg-gradient-to-br from-black/85 to-black/55 relative">
                {activeFeatured.coverUrl && isImageUrlSafe(activeFeatured.coverUrl) ? <img src={activeFeatured.coverUrl} alt={activeFeatured.title} className="w-full h-full object-cover opacity-85" /> : <div className="w-full h-full flex items-center justify-center text-white/60"><ShoppingCart className="w-12 h-12" /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute left-4 right-4 sm:left-5 sm:right-5 bottom-4 sm:bottom-5 text-white">
                  <div className="text-[10px] sm:text-xs uppercase tracking-[0.35em] font-black opacity-80">Featured</div>
                  <div className="text-xl sm:text-2xl font-black mt-2 line-clamp-2">{activeFeatured.title}</div>
                  <div className="text-xs sm:text-sm mt-2 opacity-85">¥{activeFeatured.price} · 销量 {activeFeatured.sales} · 评分 {activeFeatured.rating}</div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-muted-foreground">暂无精选商品</div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black">全部商品</h2>
          <div className="flex items-center justify-between gap-3 flex-wrap"><span className="text-sm text-muted-foreground">按热度、销量、评分切换排序</span><button onClick={() => setSortBy((current) => current === 'hot' ? 'sales' : current === 'sales' ? 'rating' : 'hot')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-bold"><ArrowUpDown className="w-4 h-4" />切换排序</button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedProducts.map((item) => <Link key={item.id} to={`/marketplace/${item.id}`} className="rounded-2xl border border-border bg-card p-4 hover:border-black transition-all"><div className="text-xs text-muted-foreground uppercase tracking-widest">{item.category}</div><div className="font-bold mt-2 line-clamp-1">{item.title}</div><div className="text-sm text-muted-foreground mt-2 flex items-center gap-2 flex-wrap"><span>¥{item.price}</span><span>· 销量 {item.sales}</span><span>· 评分 {item.rating}</span></div></Link>)}
          </div>
        </div>
      </section>

      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-xl sm:text-2xl font-black">店铺精选</h2>
          <div className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-2"><Clock3 className="w-4 h-4" /> 最近更新 {metrics.updatedAt}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {featured.map((item) => <Link key={item.id} to={`/marketplace/${item.id}`} className="rounded-2xl border border-border bg-background p-4 hover:border-black transition-all" onClick={() => bumpMetric('featured')}><div className="font-bold line-clamp-1">{item.title}</div><div className="text-sm text-muted-foreground mt-2">¥{item.price} · 销量 {item.sales} · 评分 {item.rating}</div></Link>)}
        </div>
      </div>
    </div>
  );
}
