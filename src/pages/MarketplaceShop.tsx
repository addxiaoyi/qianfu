import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpDown, BadgeCheck, BarChart3, Clock3, LampDesk, Lock, Palette, RotateCcw, Save, ShoppingCart } from 'lucide-react';
import { api } from '@/api/request';
import { sanitizeUrl, isImageUrlSafe } from '@/utils/urlValidator';
import PageSeo from '@/components/ui/PageSeo';
import { formatCnyFromFen } from '@/utils/money';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const SITE_URL = (import.meta.env.VITE_APP_URL || 'https://mc-u.top');

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
  creatorId?: number | null;
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
type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
type ShopVerification = { status: VerificationStatus; submittedAt: string | null; reviewedAt: string | null; expiresAt: string | null };
type ShopPayload = {
  config: ShopConfig;
  editable: boolean;
  metrics: ShopMetrics;
  verification: ShopVerification;
  versions: ShopVersion[];
};


const defaultConfig: ShopConfig = {
  bannerUrl: '',
  avatarUrl: '',
  announcementTitle: '',
  announcementText: '',
  bio: '',
  shopName: '',
  theme: 'default',
};

const defaultMetrics: ShopMetrics = {
  visits: 0,
  announcementClicks: 0,
  featuredClicks: 0,
  updatedAt: new Date(0).toISOString(),
};

const defaultVerification: ShopVerification = {
  status: 'UNVERIFIED',
  submittedAt: null,
  reviewedAt: null,
  expiresAt: null,
};

const sortOptions: Array<{ value: 'hot' | 'sales' | 'rating'; label: string }> = [
  { value: 'hot', label: '热度' },
  { value: 'sales', label: '销量' },
  { value: 'rating', label: '评分' },
];

const themeNames: Record<NonNullable<ShopConfig['theme']>, string> = {
  default: '默认',
  tech: '科技风',
  minimal: '极简风',
  creator: '创作者风',
};

export default function MarketplaceShop() {
  const { id: creatorId } = useParams();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [productsReload, setProductsReload] = useState(0);
  const [sortBy, setSortBy] = useState<'hot' | 'sales' | 'rating'>('hot');
  const [config, setConfig] = useState<ShopConfig>(defaultConfig);
  const [editable, setEditable] = useState(false);
  const [metrics, setMetrics] = useState<ShopMetrics>(defaultMetrics);
  const [verification, setVerification] = useState<ShopVerification>(defaultVerification);
  const [versions, setVersions] = useState<ShopVersion[]>([]);
  const [themes, setThemes] = useState<NonNullable<ShopConfig['theme']>[]>(['default', 'tech', 'minimal', 'creator']);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [form, setForm] = useState<ShopConfig>(defaultConfig);
  const [savingShopConfig, setSavingShopConfig] = useState(false);
  const [shopConfigMessage, setShopConfigMessage] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<ShopVersion | null>(null);
  const [loadingShop, setLoadingShop] = useState(Boolean(creatorId));
  const [shopError, setShopError] = useState('');

  const hydrate = useCallback((payload: Partial<ShopPayload> & { config: ShopConfig }) => {
    const raw = payload.config || defaultConfig;
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
    if (payload.verification) setVerification(payload.verification);
    if (payload.versions) setVersions(payload.versions);
  }, []);

  useEffect(() => {
    let active = true;
    if (!creatorId) {
      setConfig(defaultConfig);
      setForm(defaultConfig);
      setEditable(false);
      setMetrics(defaultMetrics);
      setVerification(defaultVerification);
      setVersions([]);
      setShopError('');
      setLoadingShop(false);
      return () => { active = false; };
    }
    if (!/^[1-9]\d*$/.test(creatorId)) {
      setShopError('店铺地址无效');
      setLoadingShop(false);
      return () => { active = false; };
    }

    setLoadingShop(true);
    setShopError('');
    api.get<ShopPayload>(`/qianfu/marketplace/shops/${creatorId}/config`)
      .then((payload) => { if (active) hydrate(payload); })
      .catch((error: unknown) => {
        if (active) setShopError(error instanceof Error ? error.message : '店铺加载失败');
      })
      .finally(() => { if (active) setLoadingShop(false); });
    return () => { active = false; };
  }, [creatorId, hydrate]);

  useEffect(() => {
    api.get<{ themes: Array<ShopConfig['theme']> }>('/qianfu/marketplace/shop/themes')
      .then((data) => setThemes((data.themes || []).filter((theme): theme is NonNullable<ShopConfig['theme']> => Boolean(theme))))
      .catch((error: unknown) => console.warn('[MarketplaceShop] Failed to load themes.', error));
  }, []);

  useEffect(() => {
    let active = true;
    if (creatorId && !/^[1-9]\d*$/.test(creatorId)) {
      setProducts([]);
      setProductsLoading(false);
      return () => { active = false; };
    }
    setProductsLoading(true);
    setProductsError('');
    setProducts([]);
    const productsRequest = creatorId
      ? api.get<{ products: Product[]; total: number }>(`/qianfu/marketplace/creators/${creatorId}/products?page=1&pageSize=24`)
      : api.get<{ products: Product[]; total: number }>('/qianfu/marketplace/products?sortBy=featured&page=1&pageSize=24');
    productsRequest
      .then((data) => { if (active) setProducts(data.products || []); })
      .catch((error: unknown) => {
        if (active) setProductsError(error instanceof Error ? error.message : '商品列表加载失败');
      })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [creatorId, productsReload]);

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
  const banners: BannerCard[] = config.announcementTitle || config.announcementText
    ? [{ title: config.announcementTitle || '店铺公告', text: config.announcementText || '店主暂未填写公告内容。' }]
    : [{ title: '暂无公告', text: '店主尚未发布店铺公告。' }];

  useEffect(() => {
    setActiveBannerIndex((current) => Math.min(current, Math.max(banners.length - 1, 0)));
  }, [banners.length]);

  useEffect(() => {
    setActiveFeaturedIndex((current) => Math.min(current, Math.max(featured.length - 1, 0)));
  }, [featured.length]);

  useEffect(() => {
    if (prefersReducedMotion || banners.length <= 1) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setActiveBannerIndex((current) => (current + 1) % banners.length);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [banners.length, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || featured.length <= 1) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setActiveFeaturedIndex((current) => (current + 1) % featured.length);
      }
    }, 4500);
    return () => window.clearInterval(timer);
  }, [featured.length, prefersReducedMotion]);

  const activeBanner = banners[activeBannerIndex % banners.length];
  const activeFeatured = featured[activeFeaturedIndex % Math.max(featured.length, 1)];
  const canonicalPath = creatorId ? `/shop/${creatorId}` : '/marketplace/shop';
  const shopSeoDescription = config.bio || '浏览公开玩家店铺、商品与创作者资源。';
  const shopSeoSchema = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: config.shopName || '玩家店铺',
    description: shopSeoDescription,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: featured.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE_URL}/marketplace/products/${item.id}`,
        name: item.title,
      })),
    },
  }), [config.shopName, featured, shopSeoDescription]);

  const saveConfig = async () => {
    if (!creatorId) return;
    setSavingShopConfig(true);
    try {
      const result = await api.put<{ config: ShopConfig; versions?: ShopVersion[] }>(`/qianfu/marketplace/shops/${creatorId}/config`, form);
      hydrate({ config: result.config, editable, metrics, verification, versions: result.versions || versions });
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
    if (!creatorId) return;
    setSavingShopConfig(true);
    try {
      const result = await api.post<{ config: ShopConfig; versions?: ShopVersion[] }>(`/qianfu/marketplace/shops/${creatorId}/config/reset`, {});
      hydrate({ config: result.config, editable, metrics, verification, versions: result.versions || versions });
      setShopConfigMessage('已重置为默认配置');
      setTimeout(() => setShopConfigMessage(''), 2500);
    } catch (error: any) {
      setShopConfigMessage(error?.message || '重置失败');
    } finally {
      setSavingShopConfig(false);
    }
  };

  const applyTheme = async (theme: NonNullable<ShopConfig['theme']>) => {
    if (!creatorId) return;
    setSavingShopConfig(true);
    try {
      const result = await api.post<{ config: ShopConfig; versions?: ShopVersion[] }>(`/qianfu/marketplace/shops/${creatorId}/theme/${theme}`, {});
      hydrate({ config: result.config, editable, metrics, verification, versions: result.versions || versions });
      setShopConfigMessage(`已应用 ${themeNames[theme]} 主题`);
      setTimeout(() => setShopConfigMessage(''), 2000);
    } catch (error: any) {
      setShopConfigMessage(error?.message || '主题应用失败');
    } finally {
      setSavingShopConfig(false);
    }
  };

  const restoreVersion = async (version: ShopVersion) => {
    if (!creatorId) return;
    setSavingShopConfig(true);
    try {
      const result = await api.put<{ config: ShopConfig; versions?: ShopVersion[] }>(`/qianfu/marketplace/shops/${creatorId}/config`, version.config);
      hydrate({ config: result.config, editable, metrics, verification, versions: result.versions || versions });
      setShopConfigMessage('已回滚到所选版本');
      setTimeout(() => setShopConfigMessage(''), 2000);
    } catch (error: any) {
      setShopConfigMessage(error?.message || '回滚失败');
    } finally {
      setSavingShopConfig(false);
    }
  };

  const bumpMetric = async (kind: 'announcement' | 'featured') => {
    if (!creatorId) return;
    try {
      const result = await api.post<{ metrics: ShopMetrics }>(`/qianfu/marketplace/shops/${creatorId}/metrics/click`, { kind });
      setMetrics(result.metrics);
    } catch (error) {
      console.warn('[MarketplaceShop] Failed to record shop interaction.', error);
    }
  };

  return (
    <>
      <PageSeo
        title={`${config.shopName || '玩家店铺'} - 千服联灯`}
        description={shopSeoDescription}
        canonicalPath={canonicalPath}
        image={isImageUrlSafe(config.bannerUrl) ? config.bannerUrl : undefined}
        schema={shopSeoSchema}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6 sm:space-y-8">
      <div className="flex flex-wrap justify-end gap-3">
        <Link to="/marketplace/favorites" className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold hover:border-black">我的收藏</Link>
        <Link to="/marketplace/manage" className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white">卖家中心</Link>
      </div>
      {loadingShop && creatorId ? <div role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">正在加载店铺...</div> : null}
      {shopError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{shopError}</div> : null}
      {productsError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>商品列表加载失败：{productsError}</span><button type="button" onClick={() => setProductsReload((value) => value + 1)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">重试</button></div> : null}
      {productsLoading ? <div role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">正在加载商品...</div> : null}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="relative h-48 sm:h-56 md:h-72">
          {isImageUrlSafe(config.bannerUrl) ? (
            <img src={config.bannerUrl} alt="店铺 banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent/20 to-card flex items-center justify-center"><LampDesk className="w-10 h-10 text-accent/40" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 flex flex-col md:flex-row md:items-end gap-5">
            <div className="relative shrink-0">
              {isImageUrlSafe(config.avatarUrl) ? (
                <img src={config.avatarUrl} alt="店铺头像" className="w-24 h-24 md:w-28 md:h-28 rounded-3xl border-4 border-white object-cover shadow-xl ring-4 ring-black/10 transition-all duration-500" />
              ) : (
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl border-4 border-white bg-zinc-100 shadow-xl ring-4 ring-black/10 flex items-center justify-center">
                  <LampDesk className="w-8 h-8 text-zinc-300" />
                </div>
              )}
              {verification.status === 'VERIFIED' ? (
                <div className="absolute -right-2 -bottom-2 w-8 h-8 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center text-white shadow-lg" aria-label="已认证商家">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                </div>
              ) : null}
            </div>
            <div className="text-white space-y-3 max-w-4xl">
              {verification.status === 'VERIFIED' ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-[10px] font-black uppercase tracking-[0.45em]"><BadgeCheck className="w-3.5 h-3.5" /> 已认证商家</div>
              ) : null}
              {editable && verification.status === 'PENDING' ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/80 text-[10px] font-black">认证审核中</div>
              ) : null}
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">{config.shopName || '未命名店铺'}</h1>
              <p className="max-w-3xl leading-7 text-white/85">{config.bio || '店主尚未填写店铺简介。'}</p>
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
                {banners.map((_, index) => <button type="button" key={index} aria-label={`查看店铺公告 ${index + 1}`} aria-current={index === activeBannerIndex ? 'true' : undefined} onClick={() => { setActiveBannerIndex(index); bumpMetric('announcement'); }} className={`w-2.5 h-2.5 rounded-full transition-all ${index === activeBannerIndex ? 'bg-black scale-110' : 'bg-muted-foreground/35'}`} />)}
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-gradient-to-br from-background to-muted/40 p-4 sm:p-5 min-h-[160px] sm:min-h-[180px] flex flex-col justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-black">{activeBanner.title}</div>
              <div className="text-xl sm:text-2xl font-black mt-3">{activeBanner.text}</div>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-5 sm:mt-6">
              {prefersReducedMotion
                ? '已根据系统设置关闭自动轮播，可以使用圆点手动切换。'
                : banners.length > 1
                  ? '公告会自动轮播，也可以使用圆点手动切换。'
                  : '当前仅有一条公告。'}
            </div>
          </div>
          {editable ? (
            <>
              <button type="button" onClick={() => setEditingAnnouncement((current) => !current)} className="w-full sm:w-auto px-4 py-2 rounded-xl border border-border text-sm font-bold">{editingAnnouncement ? '收起编辑' : '编辑公告 / 头图'}</button>
              {editingAnnouncement && (
                <div className="space-y-4 rounded-3xl border border-dashed border-border p-4 sm:p-5 bg-muted/20">
                  {shopConfigMessage && <div role="status" aria-live="polite" className="rounded-2xl border border-border bg-background p-3 text-sm">{shopConfigMessage}</div>}
                  <div className="grid gap-3">
                    <input aria-label="店铺 Banner 图片 URL" className="rounded-xl border border-border px-4 py-3 bg-background" value={form.bannerUrl} onChange={(e) => setForm((s) => ({ ...s, bannerUrl: e.target.value }))} placeholder="Banner 图片 URL" />
                    <input aria-label="店铺头像图片 URL" className="rounded-xl border border-border px-4 py-3 bg-background" value={form.avatarUrl} onChange={(e) => setForm((s) => ({ ...s, avatarUrl: e.target.value }))} placeholder="头像图片 URL" />
                    <input aria-label="店铺名称" className="rounded-xl border border-border px-4 py-3 bg-background" value={form.shopName} onChange={(e) => setForm((s) => ({ ...s, shopName: e.target.value }))} placeholder="店铺名称" />
                    <input aria-label="店铺简介" className="rounded-xl border border-border px-4 py-3 bg-background" value={form.bio} onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))} placeholder="店铺简介" />
                    <input aria-label="店铺公告标题" className="rounded-xl border border-border px-4 py-3 bg-background" value={form.announcementTitle} onChange={(e) => setForm((s) => ({ ...s, announcementTitle: e.target.value }))} placeholder="公告标题" />
                    <textarea aria-label="店铺公告内容" className="rounded-xl border border-border px-4 py-3 bg-background min-h-28" value={form.announcementText} onChange={(e) => setForm((s) => ({ ...s, announcementText: e.target.value }))} placeholder="公告内容" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button type="button" disabled={savingShopConfig} onClick={saveConfig} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"><Save className="w-4 h-4" /> {savingShopConfig ? '保存中...' : '保存店铺配置'}</button>
                    <button type="button" disabled={savingShopConfig} onClick={resetConfig} className="px-4 py-2 rounded-xl border border-border text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"><RotateCcw className="w-4 h-4" /> 重置默认</button>
                    <button type="button" onClick={() => setEditingAnnouncement(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-bold">取消</button>
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
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border"><LampDesk className="w-3.5 h-3.5" /> 公告点击 {metrics.announcementClicks}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border"><ShoppingCart className="w-3.5 h-3.5" /> 精选点击 {metrics.featuredClicks}</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {themes.map((theme) => (
              <button type="button" key={theme} disabled={!editable || savingShopConfig} onClick={() => applyTheme(theme)} className={`rounded-2xl border p-4 text-left transition-all ${config.theme === theme ? 'border-black bg-black text-white' : 'border-border bg-background hover:border-black'} ${!editable ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] font-black"><Palette className="w-3.5 h-3.5" />{themeNames[theme]}</div>
                <div className="text-sm mt-2 opacity-85">一键套用主题预设</div>
              </button>
            ))}
          </div>
          <div className="rounded-3xl border border-border bg-muted/20 p-5">
            <div className="flex items-center justify-between gap-3 mb-4"><h3 className="font-black">配置版本历史</h3><span className="text-xs text-muted-foreground">最近 {versions.length} 条</span></div>
            <div className="space-y-3 max-h-[320px] overflow-auto pr-1">
              {versions.length ? versions.map((version) => (
                <div key={version.id} className={`rounded-2xl border bg-background p-4 flex items-center justify-between gap-3 flex-wrap ${selectedVersion?.id === version.id ? 'border-black' : 'border-border'}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedVersion(version)}
                    aria-pressed={selectedVersion?.id === version.id}
                    className="min-w-0 flex-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/10"
                  >
                    <span className="block text-xs text-muted-foreground">{version.createdAt}</span>
                    <span className="block font-bold mt-1">{version.config.shopName} · {version.config.theme || 'default'}</span>
                    <span className="block text-sm text-muted-foreground mt-1 line-clamp-1">{version.config.announcementText}</span>
                  </button>
                  {editable && <button type="button" disabled={savingShopConfig} onClick={() => restoreVersion(version)} className="px-4 py-2 rounded-xl border border-border text-sm font-bold">回滚此版本</button>}
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
                  {editable && <button type="button" disabled={savingShopConfig} onClick={() => restoreVersion(selectedVersion)} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold">回滚到该版本</button>}
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
              {featured.map((_, index) => <button type="button" key={index} aria-label={`查看精选商品 ${index + 1}`} aria-current={index === activeFeaturedIndex ? 'true' : undefined} onClick={() => { setActiveFeaturedIndex(index); bumpMetric('featured'); }} className={`w-2.5 h-2.5 rounded-full transition-all ${index === activeFeaturedIndex ? 'bg-black scale-110' : 'bg-muted-foreground/35'}`} />)}
            </div>
          </div>
          {activeFeatured ? (
            <Link to={`/marketplace/${activeFeatured.id}`} className="block rounded-3xl overflow-hidden border border-border bg-muted/20 hover:border-black transition-all" onClick={() => bumpMetric('featured')}>
              <div className="h-44 sm:h-56 bg-gradient-to-br from-black/85 to-black/55 relative">
                {activeFeatured.coverUrl && isImageUrlSafe(activeFeatured.coverUrl) ? <img src={activeFeatured.coverUrl} alt={activeFeatured.title} className="w-full h-full object-cover opacity-85" /> : <div className="w-full h-full flex items-center justify-center text-white/60"><ShoppingCart className="w-12 h-12" /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute left-4 right-4 sm:left-5 sm:right-5 bottom-4 sm:bottom-5 text-white">
                  <div className="text-[10px] sm:text-xs uppercase tracking-[0.35em] font-black opacity-80">精选</div>
                  <div className="text-xl sm:text-2xl font-black mt-2 line-clamp-2">{activeFeatured.title}</div>
                  <div className="text-xs sm:text-sm mt-2 opacity-85">{formatCnyFromFen(activeFeatured.price)} · 销量 {activeFeatured.sales} · 评分 {activeFeatured.rating}</div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-muted-foreground">暂无精选商品</div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black">全部商品</h2>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowUpDown className="w-4 h-4" />选择商品排序方式</span>
            <div role="group" aria-label="商品排序" className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
              {sortOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  aria-pressed={sortBy === option.value}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${sortBy === option.value ? 'bg-black text-white' : 'text-muted-foreground hover:bg-white hover:text-black'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy={productsLoading}>
            {!productsLoading && !productsError && sortedProducts.length === 0 ? (
              <div role="status" className="sm:col-span-2 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {creatorId ? '该店铺暂时没有公开商品。' : '市场暂时没有可展示的公开商品。'}
              </div>
            ) : null}
            {sortedProducts.map((item) => <Link key={item.id} to={`/marketplace/${item.id}`} className="rounded-2xl border border-border bg-card p-4 hover:border-black transition-all"><div className="text-xs text-muted-foreground uppercase tracking-widest">{item.category}</div><div className="font-bold mt-2 line-clamp-1">{item.title}</div><div className="text-sm text-muted-foreground mt-2 flex items-center gap-2 flex-wrap"><span>{formatCnyFromFen(item.price)}</span><span>· 销量 {item.sales}</span><span>· 评分 {item.rating}</span></div></Link>)}
          </div>
        </div>
      </section>

      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-xl sm:text-2xl font-black">店铺精选</h2>
          <div className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-2"><Clock3 className="w-4 h-4" /> 最近更新 {metrics.updatedAt}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {featured.map((item) => <Link key={item.id} to={`/marketplace/${item.id}`} className="rounded-2xl border border-border bg-background p-4 hover:border-black transition-all" onClick={() => bumpMetric('featured')}><div className="font-bold line-clamp-1">{item.title}</div><div className="text-sm text-muted-foreground mt-2">{formatCnyFromFen(item.price)} · 销量 {item.sales} · 评分 {item.rating}</div></Link>)}
        </div>
      </div>
      </div>
    </>
  );
}
