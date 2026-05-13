import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Star, ShoppingCart, ArrowLeft, Download, BadgeCheck, Send } from 'lucide-react';
import { api } from '@/api/request';
import { isImageUrlSafe, isUrlSafe } from '@/utils/urlValidator';

type MarketplaceProduct = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  sales: number;
  rating: number;
  reviewCount: number;
  author: string;
  coverUrl?: string;
  downloadUrl?: string;
  createdAt: string;
};

type Review = { id: string; rating: number; content?: string | null; createdAt: string };

export default function MarketplaceDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [related, setRelated] = useState<MarketplaceProduct[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [buyerName, setBuyerName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [rating, setRating] = useState('5');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  const loadDetail = async () => {
    if (!id) return;
    const data = await api.get<{ product: MarketplaceProduct & { favorited?: boolean }; related: MarketplaceProduct[]; reviews: Review[]; favorite?: boolean }>(`/qianfu/marketplace/products/${id}`);
    setProduct(data.product);
    setRelated(data.related || []);
    setReviews(data.reviews || []);
    setFavorite(!!data.favorite || !!data.product?.favorited);
  };

  useEffect(() => {
    loadDetail().catch((error) => setMessage(error?.message || '加载详情失败'));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.get<{ product: MarketplaceProduct; related: MarketplaceProduct[]; reviews: Review[]; favorite?: boolean }>(`/qianfu/marketplace/products/${id}`)
      .then((data) => setFavorite(!!data.favorite))
      .catch(() => undefined);
  }, [id]);

  const buy = async () => {
    if (!product) return;
    setMessage('');
    try {
      const result = await api.post<{ downloadUrl?: string }>('/qianfu/marketplace/orders', {
        productId: product.id,
        buyerName: buyerName || '匿名用户',
        quantity: Number(quantity) || 1,
      });
      setMessage(result.downloadUrl ? `购买成功，下载链接：${result.downloadUrl}` : '购买成功');
      await loadDetail();
      if ((result as any)?.order?.id) {
        window.location.hash = `#/marketplace/orders/${(result as any).order.id}`;
      }
    } catch (error: any) {
      setMessage(error?.message || '购买失败');
    }
  };

  const toggleFavorite = async () => {
    if (!product || favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      const result = await api.post<{ favorite: boolean }>(`/qianfu/marketplace/products/${product.id}/favorite`, {});
      setFavorite(!!result.favorite);
      setMessage(result.favorite ? '已收藏' : '已取消收藏');
    } catch (error: any) {
      setMessage(error?.message || '收藏操作失败');
    } finally {
      setFavoriteBusy(false);
    }
  };

  const submitReview = async () => {
    if (!product) return;
    setMessage('');
    try {
      await api.post(`/qianfu/marketplace/products/${product.id}/reviews`, {
        rating: Number(rating) || 5,
        content,
      });
      setContent('');
      setRating('5');
      setMessage('评价已提交');
      await loadDetail();
    } catch (error: any) {
      setMessage(error?.message || '评价失败');
    }
  };

  const safeCoverUrl = product.coverUrl && isImageUrlSafe(product.coverUrl) ? product.coverUrl : 'https://picsum.photos/seed/market-default/800/500';
  const safeDownloadUrl = product.downloadUrl && isUrlSafe(product.downloadUrl) ? product.downloadUrl : null;

  if (!product) {
    return <div className="max-w-5xl mx-auto px-6 py-20 text-sm text-muted-foreground">正在加载商品详情...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
      <Link to="/resources" className="inline-flex items-center gap-2 text-sm font-bold hover:text-black transition-colors">
        <ArrowLeft className="w-4 h-4" />返回资源中心
      </Link>
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-8">
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 md:p-8 space-y-5">
          <img
            src={safeCoverUrl}
            alt={product.title}
            className="w-full h-52 sm:h-64 lg:h-[320px] object-cover rounded-3xl border border-border"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-[0.25em]">{product.category}</span>
            <span className="text-sm text-muted-foreground">作者 {product.author}</span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />{product.rating}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{product.title}</h1>
          <p className="text-sm leading-7 text-muted-foreground">{product.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">价格</div><div className="font-black text-xl">¥{product.price}</div></div>
            <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">销量</div><div className="font-black text-xl">{product.sales}</div></div>
            <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">评论</div><div className="font-black text-xl">{product.reviewCount}</div></div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 md:p-8 space-y-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-3"><BadgeCheck className="w-5 h-5 text-black" /><h2 className="text-xl font-black">购买资源</h2></div>
          <button onClick={toggleFavorite} className="w-full rounded-xl border border-border px-4 py-3 font-bold text-sm" disabled={favoriteBusy}>
            {favoriteBusy ? '处理中...' : favorite ? '已收藏' : '收藏商品'}
          </button>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <input className="w-full rounded-xl border border-border px-4 py-3 bg-white" placeholder="买家昵称" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            <input className="w-full rounded-xl border border-border px-4 py-3 bg-white" placeholder="购买数量" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <button onClick={buy} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-black text-white font-bold text-sm">
            <ShoppingCart className="w-4 h-4" />确认下单
          </button>
          {safeDownloadUrl && (
            <a href={safeDownloadUrl} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border font-bold text-sm">
              <Download className="w-4 h-4" />直接下载
            </a>
          )}
          {message && <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">{message}</div>}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_0.8fr] gap-6 lg:gap-8">
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 md:p-8 space-y-4">
          <h3 className="text-xl font-black">商品评价</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
            <select className="rounded-xl border border-border px-4 py-3 bg-white" value={rating} onChange={(e) => setRating(e.target.value)}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} 星</option>)}
            </select>
            <input className="rounded-xl border border-border px-4 py-3 bg-white" placeholder="评价内容" value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <button onClick={submitReview} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-black text-white font-bold text-sm">
            <Send className="w-4 h-4" />提交评价
          </button>
          <div className="space-y-3 pt-3">
            {reviews.length > 0 ? reviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-border p-4 bg-muted/20">
                <div className="text-sm font-bold">{review.rating} 星</div>
                <div className="text-sm text-muted-foreground mt-2">{review.content || '暂无文字评价'}</div>
              </div>
            )) : <div className="text-sm text-muted-foreground">暂无评价，快来留下第一条评价。</div>}
          </div>
        </div>

        {related.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-black">相关商品</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {related.map((item) => (
                <Link key={item.id} to={`/marketplace/${item.id}`} className="rounded-2xl border border-border bg-card p-4 hover:border-black transition-all">
                  <div className="font-bold line-clamp-1">{item.title}</div>
                  <div className="text-sm text-muted-foreground mt-2">¥{item.price} · 销量 {item.sales}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
