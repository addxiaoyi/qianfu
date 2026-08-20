import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Heart, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/api/request';
import { formatCnyFromFen } from '@/utils/money';

type MarketplaceProduct = {
  id: string;
  title: string;
  price: number;
  sales: number;
  rating: number;
  category: string;
};

export default function MarketplaceFavorites() {
  const favoritesQuery = useQuery({
    queryKey: ['marketplace-favorites'],
    queryFn: () => api.get<{ products: MarketplaceProduct[] }>('/qianfu/marketplace/favorites'),
  });
  const favorites = favoritesQuery.data?.products || [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/marketplace/shop" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-black">
            <ArrowLeft className="h-4 w-4" />返回商城
          </Link>
          <h1 className="mt-4 text-3xl font-black">我的商品收藏</h1>
          <p className="mt-2 text-sm text-muted-foreground">保存感兴趣的 Minecraft 资源，便于稍后查看。</p>
        </div>
        {!favoritesQuery.isLoading && !favoritesQuery.isError && favorites.length > 0 ? (
          <span className="text-sm font-bold text-zinc-500">共 {favorites.length} 件</span>
        ) : null}
      </header>

      {favoritesQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="正在加载商品收藏">
          {[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-zinc-100" />)}
        </div>
      ) : favoritesQuery.isError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="font-bold text-red-700">商品收藏加载失败</p>
          <button type="button" onClick={() => favoritesQuery.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white">
            <RefreshCw className="h-4 w-4" />重试
          </button>
        </div>
      ) : favorites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-16 text-center">
          <Heart className="mx-auto h-10 w-10 text-zinc-300" />
          <h2 className="mt-4 text-xl font-black">还没有收藏商品</h2>
          <p className="mt-2 text-sm text-zinc-500">在商品详情页点击收藏后，会显示在这里。</p>
          <Link to="/marketplace/shop" className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white">浏览商城</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((item) => (
            <Link key={item.id} to={`/marketplace/${item.id}`} className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-black hover:shadow-sm">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{item.category}</div>
              <div className="mt-2 font-bold">{item.title}</div>
              <div className="mt-3 text-sm text-muted-foreground">{formatCnyFromFen(item.price)} · 销量 {item.sales} · 评分 {item.rating}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
