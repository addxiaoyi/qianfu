import React, { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Award, ShoppingCart, ArrowLeft, BadgeCheck, Send } from 'lucide-react';
import { api } from '@/api/request';
import { isImageUrlSafe } from '@/utils/urlValidator';
import { fenToYuanNumber, formatCnyFromFen } from '@/utils/money';
import { createPaymentIdempotencyKey, isTrustedPaymentUrl } from '@/utils/paymentRedirect';
import PageSeo from '@/components/ui/PageSeo';

type MarketplaceProduct = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  currency?: 'CNY';
  taxIncluded?: boolean;
  additionalFees?: number;
  validityText?: string;
  deliveryMethod?: string;
  deliveryEta?: string;
  compatibility?: string;
  isPlatformOperated?: boolean;
  sellerIdentity?: string;
  afterSalesContact?: string;
  refundTerms?: string;
  ipSource?: string;
  prohibitedUse?: string;
  riskNotice?: string;
  productVersion?: string;
  fileSha256?: string;
  assetSize?: number;
  assetMime?: string;
  sales: number;
  rating: number;
  reviewCount: number;
  author: string;
  coverUrl?: string;
  downloadUrl?: string;
  createdAt: string;
};

type Review = { id: string; rating: number; content?: string | null; createdAt: string };
type PaymentMethod = 'alipay' | 'wechat' | 'balance';
type MarketplaceOrderResponse = { order: { id: string } };
type MarketplacePaymentResponse = { status?: string; paymentUrl?: string };


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

export default function MarketplaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [related, setRelated] = useState<MarketplaceProduct[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [rating, setRating] = useState('5');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('商品涉嫌违规');
  const [reportDescription, setReportDescription] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const orderKeyRef = useRef<string | null>(null);
  const paymentKeyRef = useRef<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    const data = await api.get<{ product: MarketplaceProduct & { favorited?: boolean }; related: MarketplaceProduct[]; reviews: Review[]; favorite?: boolean }>(`/qianfu/marketplace/products/${id}`);
    setProduct(data.product);
    setRelated(data.related || []);
    setReviews(data.reviews || []);
    setFavorite(!!data.favorite || !!data.product?.favorited);
  }, [id]);

  useEffect(() => {
    loadDetail().catch((error) => setMessage(error?.message || '加载详情失败'));
  }, [loadDetail]);

  useEffect(() => {
    orderKeyRef.current = null;
    paymentKeyRef.current = null;
    setPendingOrderId(null);
    setPolicyAccepted(false);
  }, [id]);

  const updateQuantity = (event: ChangeEvent<HTMLInputElement>) => {
    setQuantity(event.target.value);
  };

  const choosePaymentMethod = (event: ChangeEvent<HTMLInputElement>) => {
    const nextMethod = event.target.value;
    if (nextMethod === 'alipay' || nextMethod === 'wechat' || nextMethod === 'balance') {
      setPaymentMethod(nextMethod);
    }
  };

  const togglePolicyAcceptance = (event: ChangeEvent<HTMLInputElement>) => {
    setPolicyAccepted(event.target.checked);
  };

  const buy = async () => {
    if (!product || purchaseBusy) return;
    if (!policyAccepted) {
      setMessage('请先阅读并确认购买披露与市场政策。');
      return;
    }
    setPurchaseBusy(true);
    setMessage('');
    let orderId = pendingOrderId;
    try {
      const orderKey = orderKeyRef.current || (orderKeyRef.current = createPaymentIdempotencyKey());
      const order = orderId
        ? { id: orderId }
        : (await api.post<MarketplaceOrderResponse>('/qianfu/marketplace/orders', {
          productId: product.id,
          quantity: Number(quantity) || 1,
          policyAcceptance: { accepted: true },
        }, {
          headers: { 'Idempotency-Key': orderKey },
        })).order;
      if (!order?.id) {
        throw new Error('订单服务未返回订单编号');
      }
      orderId = order.id;
      setPendingOrderId(order.id);

      const paymentKey = paymentKeyRef.current || (paymentKeyRef.current = createPaymentIdempotencyKey());
      const payment = await api.post<MarketplacePaymentResponse>('/payment/create', {
        planId: 'marketplace',
        marketplaceOrderId: order.id,
        paymentMethod,
      }, {
        headers: { 'Idempotency-Key': paymentKey },
      });

      if (payment.status === 'COMPLETED') {
        setMessage('支付完成，正在打开订单详情。');
        await loadDetail();
        navigate(`/marketplace/orders/${order.id}`);
        return;
      }
      if (!isTrustedPaymentUrl(payment.paymentUrl)) {
        setMessage('订单已创建，支付通道未返回可用地址，请在订单详情继续查看。');
        return;
      }

      window.location.assign(payment.paymentUrl);
    } catch (error: any) {
      const failureMessage = error?.message || '支付创建失败';
      setMessage(orderId ? `订单已创建，支付尚未完成：${failureMessage}` : failureMessage);
    } finally {
      setPurchaseBusy(false);
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

  const submitReport = async () => {
    if (!product || reportBusy) return;
    setReportBusy(true);
    try {
      await api.post('/reports', {
        target_type: 'PRODUCT',
        target_id: product.id,
        reason: reportReason,
        description: reportDescription || undefined,
      });
      setReportOpen(false);
      setReportDescription('');
      setMessage('举报已提交，平台会保留审核与处理记录。');
    } catch (error: any) {
      setMessage(error?.message || '举报提交失败，请先登录并验证邮箱。');
    } finally {
      setReportBusy(false);
    }
  };

  if (!product) {
    return <div className="max-w-5xl mx-auto px-6 py-20 text-sm text-muted-foreground">正在加载商品详情...</div>;
  }

  const safeCoverUrl = product.coverUrl && isImageUrlSafe(product.coverUrl) ? product.coverUrl : '';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
      <PageSeo
        title={`${product.title} - 玩家资源商品 - 千服联灯`}
        description={truncateText(product.description || `${product.title}，作者 ${product.author}，分类 ${product.category}，可在千服联灯资源中心查看。`)}
        canonicalPath={`/marketplace/products/${product.id}`}
        image={safeCoverUrl.startsWith('http') ? safeCoverUrl : undefined}
        schema={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.title,
          description: truncateText(product.description, 300),
          category: product.category,
          brand: {
            '@type': 'Brand',
            name: '千服联灯玩家市场',
          },
          offers: {
            '@type': 'Offer',
            price: fenToYuanNumber(product.price),
            priceCurrency: 'CNY',
            availability: 'https://schema.org/InStock',
          },
          aggregateRating: product.reviewCount > 0 ? {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          } : undefined,
        }}
      />
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
              <Award className="w-4 h-4 text-amber-600" />{product.rating}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{product.title}</h1>
          <p className="text-sm leading-7 text-muted-foreground">{product.description}</p>
          <button type="button" onClick={() => setReportOpen((open) => !open)} className="text-sm font-bold text-red-600">举报商品</button>
          {reportOpen ? (
            <div className="grid gap-3 rounded-2xl border border-red-100 bg-red-50/40 p-4">
              <input aria-label="举报原因" value={reportReason} onChange={(event) => setReportReason(event.target.value)} minLength={5} maxLength={100} className="rounded-xl border border-border bg-white px-4 py-3 text-sm" placeholder="举报原因" />
              <textarea aria-label="举报说明或证据线索" value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} maxLength={1000} className="min-h-24 rounded-xl border border-border bg-white px-4 py-3 text-sm" placeholder="补充说明或证据线索（可选）" />
              <button type="button" onClick={submitReport} disabled={reportBusy || reportReason.trim().length < 5} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{reportBusy ? '提交中...' : '确认举报'}</button>
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">价格</div><div className="font-black text-xl">{formatCnyFromFen(product.price)}</div></div>
            <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">销量</div><div className="font-black text-xl">{product.sales}</div></div>
            <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">评论</div><div className="font-black text-xl">{product.reviewCount}</div></div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 md:p-8 space-y-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-3"><BadgeCheck className="w-5 h-5 text-black" /><h2 className="text-xl font-black">购买资源</h2></div>
          <button type="button" onClick={toggleFavorite} className="w-full rounded-xl border border-border px-4 py-3 font-bold text-sm" disabled={favoriteBusy}>
            {favoriteBusy ? '处理中...' : favorite ? '已收藏' : '收藏商品'}
          </button>
          <label htmlFor="marketplace-quantity" className="text-sm font-bold">购买数量</label>
          <input id="marketplace-quantity" type="number" min="1" max="100" className="w-full rounded-xl border border-border px-4 py-3 bg-white" placeholder="购买数量" value={quantity} onChange={updateQuantity} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">支付方式</legend>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-bold cursor-pointer">
                <input type="radio" name="marketplace-payment-method" value="alipay" checked={paymentMethod === 'alipay'} onChange={choosePaymentMethod} />支付宝
              </label>
              <label className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-bold cursor-pointer">
                <input type="radio" name="marketplace-payment-method" value="wechat" checked={paymentMethod === 'wechat'} onChange={choosePaymentMethod} />微信
              </label>
              <label className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-bold cursor-pointer">
                <input type="radio" name="marketplace-payment-method" value="balance" checked={paymentMethod === 'balance'} onChange={choosePaymentMethod} />余额
              </label>
            </div>
          </fieldset>
          <section aria-labelledby="marketplace-purchase-disclosure" className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">
            <h3 id="marketplace-purchase-disclosure" className="font-bold">购买前披露</h3>
            <dl className="mt-3 grid gap-2 text-muted-foreground">
              <div><dt className="inline font-medium text-foreground">卖方：</dt><dd className="inline">{product.sellerIdentity || product.author}</dd></div>
              <div><dt className="inline font-medium text-foreground">费用：</dt><dd className="inline">商品 {formatCnyFromFen(product.price)}，{product.additionalFees ? `每件另收 ${formatCnyFromFen(product.additionalFees)}` : '无额外费用'}，{product.taxIncluded ? '已含税' : '税费以结算页为准'}</dd></div>
              <div><dt className="inline font-medium text-foreground">交付：</dt><dd className="inline">{product.deliveryMethod || '订单中心交付'}；{product.deliveryEta || '付款后按商品说明交付'}</dd></div>
              <div><dt className="inline font-medium text-foreground">有效期与兼容性：</dt><dd className="inline">{product.validityText || '以商品说明为准'}；{product.compatibility || '购买前请自行核对环境'}</dd></div>
              <div><dt className="inline font-medium text-foreground">退款条款：</dt><dd className="inline">{product.refundTerms || '依平台规则和商品实际交付情况处理'}</dd></div>
              <div><dt className="inline font-medium text-foreground">禁止用途：</dt><dd className="inline">{product.prohibitedUse || '不得转售、违法使用或侵犯第三方权利'}</dd></div>
              <div><dt className="inline font-medium text-foreground">风险提示：</dt><dd className="inline">{product.riskNotice || '安装前请备份，并在测试环境验证'}</dd></div>
            </dl>
          </section>
          <label htmlFor="marketplace-policy-acceptance" className="flex items-start gap-3 rounded-2xl border border-border p-4 text-sm leading-6">
            <input id="marketplace-policy-acceptance" type="checkbox" checked={policyAccepted} onChange={togglePolicyAcceptance} className="mt-1" />
            <span>我已阅读并同意上述价格、交付、退款、禁止用途和风险提示，并授权平台保存本次确认的证据快照。</span>
          </label>
          <button type="button" onClick={buy} disabled={purchaseBusy || !policyAccepted} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-black text-white font-bold text-sm disabled:cursor-not-allowed disabled:opacity-60">
            <ShoppingCart className="w-4 h-4" />{purchaseBusy ? '正在创建支付...' : policyAccepted ? '确认并支付' : '请先确认购买政策'}
          </button>
          {pendingOrderId && <Link to={`/marketplace/orders/${pendingOrderId}`} className="w-full inline-flex items-center justify-center px-5 py-3 rounded-xl border border-border font-bold text-sm">查看待支付订单</Link>}
          {message && <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">{message}</div>}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_0.8fr] gap-6 lg:gap-8">
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 md:p-8 space-y-4">
          <h3 className="text-xl font-black">商品评价</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
            <select aria-label="评价星级" className="rounded-xl border border-border px-4 py-3 bg-white" value={rating} onChange={(e) => setRating(e.target.value)}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} 星</option>)}
            </select>
            <input aria-label="评价内容" className="rounded-xl border border-border px-4 py-3 bg-white" placeholder="评价内容" value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <button type="button" onClick={submitReview} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-black text-white font-bold text-sm">
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
                  <div className="text-sm text-muted-foreground mt-2">{formatCnyFromFen(item.price)} · 销量 {item.sales}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
