import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/request';

type MarketplaceProduct = {
  id: string;
  title: string;
  price: number;
  sales: number;
  rating: number;
  category: string;
};

export default function MarketplaceFavorites() {
  const [favorites, setFavorites] = useState<MarketplaceProduct[]>([]);

  useEffect(() => {
    api.get<{ products: MarketplaceProduct[] }>('/qianfu/marketplace/favorites')
      .then((data) => setFavorites(data.products || []))
      .catch(() => setFavorites([]));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-6">
      <h1 className="text-3xl font-black">我的收藏</h1>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {favorites.map((item) => (
          <Link key={item.id} to={`/marketplace/${item.id}`} className="rounded-2xl border border-border bg-card p-4 hover:border-black transition-all">
            <div className="text-xs text-muted-foreground uppercase tracking-widest">{item.category}</div>
            <div className="font-bold mt-2">{item.title}</div>
            <div className="text-sm text-muted-foreground mt-2">¥{item.price} · 销量 {item.sales} · 评分 {item.rating}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
