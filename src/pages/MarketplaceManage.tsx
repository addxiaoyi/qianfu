import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Clock3, PackageCheck, Plus, ShieldCheck, Truck } from 'lucide-react';
import { api } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { formatCnyFromFen } from '@/utils/money';

type Product = {
  id: string;
  title: string;
  category: string;
  price: number;
  sales: number;
  rating: number;
  reviewCount: number;
  isPublished: boolean;
  listingStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  moderationNotes?: string | null;
  author: string;
};

type MarketplaceOrder = {
  id: string;
  productId: string;
  productTitle: string;
  buyerName: string;
  quantity: number;
  totalPrice: number;
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  fulfillmentStatus?: 'PENDING' | 'READY' | 'DELIVERED';
  disputeStatus: 'NONE' | 'OPEN' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
  roles?: { isBuyer: boolean; isSeller: boolean };
  permissions?: { canFulfill: boolean };
};

type UploadAsset = {
  url: string;
  filename: string;
  mime: string;
  size: number;
};

type ShopVersion = { id: string; createdAt: string; config: { bannerUrl: string; avatarUrl: string; shopName: string; announcementTitle: string; announcementText: string; bio: string; theme?: string } };
type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
type ShopVerification = { status: VerificationStatus; submittedAt: string | null; reviewedAt: string | null; expiresAt: string | null };
type OrderFilter = 'ALL' | 'PENDING_PAYMENT' | 'NEEDS_FULFILLMENT' | 'DELIVERED' | 'DISPUTE';

const verificationLabels: Record<VerificationStatus, string> = {
  UNVERIFIED: '未认证',
  PENDING: '审核中',
  VERIFIED: '已认证',
  REJECTED: '未通过',
  EXPIRED: '已过期',
};

const orderFilters: Array<{ value: OrderFilter; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING_PAYMENT', label: '待付款' },
  { value: 'NEEDS_FULFILLMENT', label: '待交付' },
  { value: 'DELIVERED', label: '已交付' },
  { value: 'DISPUTE', label: '争议中' },
];

const paymentStatusLabel = (status?: MarketplaceOrder['paymentStatus']) => ({
  PENDING: '待付款',
  PAID: '已付款',
  FAILED: '付款失败',
  REFUNDED: '已退款',
}[status || 'PENDING']);

const fulfillmentStatusLabel = (status?: MarketplaceOrder['fulfillmentStatus']) => ({
  PENDING: '待交付',
  READY: '待人工交付',
  DELIVERED: '已交付',
}[status || 'PENDING']);

const disputeStatusLabel = (status: MarketplaceOrder['disputeStatus']) => ({
  NONE: '无争议',
  OPEN: '争议处理中',
  RESOLVED: '争议已解决',
  REJECTED: '争议已驳回',
}[status]);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export default function MarketplaceManage() {
  const user = useAuthStore((state) => state.user);
  const ownerId = user?.id && /^[1-9]\d*$/.test(String(user.id)) ? String(user.id) : null;
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ALL');
  const [fulfillingOrderId, setFulfillingOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [uploads, setUploads] = useState<UploadAsset[]>([]);
  const [diffLeft, setDiffLeft] = useState<ShopVersion | null>(null);
  const [diffRight, setDiffRight] = useState<ShopVersion | null>(null);
  const [versions, setVersions] = useState<ShopVersion[]>([]);
  const [verification, setVerification] = useState<ShopVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingVerification, setSubmittingVerification] = useState(false);

  const load = useCallback(async () => {
    if (!ownerId) return;
    const [listingResult, history, verificationResult, orderResult] = await Promise.all([
      api.get<{ products: Product[] }>('/qianfu/marketplace/me/listings'),
      api.get<{ versions: ShopVersion[] }>(`/qianfu/marketplace/shops/${ownerId}/history`),
      api.get<{ verification: ShopVerification }>('/qianfu/marketplace/sellers/me/verification'),
      api.get<{ orders: MarketplaceOrder[] }>('/qianfu/marketplace/me/orders'),
    ]);
    const nextProducts = listingResult.products || [];
    const ownedProductIds = new Set(nextProducts.map((product) => product.id));
    setProducts(nextProducts);
    setOrders((orderResult.orders || []).filter((order) => order.roles?.isSeller ?? ownedProductIds.has(order.productId)));
    setVersions(history.versions || []);
    setVerification(verificationResult.verification);
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    load()
      .catch((error: unknown) => {
        setProducts([]);
        setOrders([]);
        setMessage(error instanceof Error ? error.message : '卖家数据加载失败');
      })
      .finally(() => setLoading(false));
  }, [load, ownerId]);

  const submitVerification = async () => {
    setSubmittingVerification(true);
    try {
      const result = await api.post<{ verification: ShopVerification }>('/qianfu/marketplace/sellers/me/verification/submit', {});
      setVerification(result.verification);
      setMessage('认证申请已提交');
    } catch (error: any) {
      setMessage(error?.message || '认证申请提交失败');
    } finally {
      setSubmittingVerification(false);
    }
  };

  const fulfillOrder = async (orderId: string) => {
    if (fulfillingOrderId) return;
    setFulfillingOrderId(orderId);
    setMessage('');
    try {
      const result = await api.post<{ replayed?: boolean }>(`/qianfu/marketplace/orders/${orderId}/fulfill`, {});
      setMessage(result.replayed ? '该订单已完成交付，列表已刷新。' : '订单交付状态已更新，买家现在可以查看交付结果。');
      await load();
    } catch (error: any) {
      setMessage(error?.message || '订单交付失败');
    } finally {
      setFulfillingOrderId(null);
    }
  };

  const unpublish = async (id: string) => {
    try {
      await api.post(`/qianfu/marketplace/products/${id}/unpublish`, {});
      setMessage('已下架');
      await load();
    } catch (error: any) {
      setMessage(error?.message || '下架失败');
    }
  };

  const publish = async (id: string) => {
    try {
      await api.post(`/qianfu/marketplace/products/${id}/publish`, {});
      setMessage('已重新上架');
      await load();
    } catch (error: any) {
      setMessage(error?.message || '上架失败');
    }
  };

  const onUpload = async (file: File, kind: 'image' | 'asset') => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const uploaded = await api.post<UploadAsset>('/upload', form, { useAuth: true });
    setUploads((current) => [uploaded, ...current]);
  };

  const diffText = useMemo(() => {
    if (!diffLeft || !diffRight) return '';
    const left = JSON.stringify(diffLeft.config, null, 2).split('\n');
    const right = JSON.stringify(diffRight.config, null, 2).split('\n');
    return left.map((line, index) => (line === right[index] ? `  ${line}` : `- ${line}\n+ ${right[index] || ''}`)).join('\n');
  }, [diffLeft, diffRight]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (orderFilter === 'ALL') return true;
    if (orderFilter === 'PENDING_PAYMENT') return order.paymentStatus !== 'PAID';
    if (orderFilter === 'NEEDS_FULFILLMENT') return order.permissions?.canFulfill === true;
    if (orderFilter === 'DELIVERED') return order.fulfillmentStatus === 'DELIVERED' || order.fulfillmentStatus === 'READY';
    return order.disputeStatus === 'OPEN';
  }), [orderFilter, orders]);

  const orderCount = (filter: OrderFilter) => orders.filter((order) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING_PAYMENT') return order.paymentStatus !== 'PAID';
    if (filter === 'NEEDS_FULFILLMENT') return order.permissions?.canFulfill === true;
    if (filter === 'DELIVERED') return order.fulfillmentStatus === 'DELIVERED' || order.fulfillmentStatus === 'READY';
    return order.disputeStatus === 'OPEN';
  }).length;

  const listingLabel = (item: Product) => {
    if (item.listingStatus === 'PENDING_REVIEW') return '审核中';
    if (item.listingStatus === 'REJECTED') return '审核未通过';
    if (item.listingStatus === 'SUSPENDED') return '已被平台下架';
    return item.isPublished ? '上架中' : '已下架';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 sm:py-16 space-y-8">
      <h1 className="text-3xl font-black">卖家控制台</h1>
      {message && <div role="status" className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">{message}</div>}
      {loading ? <div role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">正在加载卖家数据...</div> : null}

      <section className="rounded-3xl border border-border bg-card p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            {verification?.status === 'VERIFIED' ? <BadgeCheck className="h-5 w-5" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div>
            <h2 className="font-black">商家认证</h2>
            <div className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
              {verification?.status === 'PENDING' ? <Clock3 className="h-4 w-4" aria-hidden="true" /> : null}
              {verification ? verificationLabels[verification.status] : '加载中'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ownerId ? <Link to={`/shop/${ownerId}`} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">查看店铺</Link> : null}
          {verification && !['PENDING', 'VERIFIED'].includes(verification.status) ? (
            <button type="button" disabled={submittingVerification} onClick={submitVerification} className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {submittingVerification ? '提交中...' : '提交认证申请'}
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><Truck className="h-5 w-5" aria-hidden="true" /><h2 className="text-xl font-black">订单处理</h2></div>
            <p className="mt-2 text-sm text-muted-foreground">按付款、交付和争议状态处理本人商品产生的订单。</p>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="订单状态筛选">
            {orderFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={orderFilter === filter.value}
                onClick={() => setOrderFilter(filter.value)}
                className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${orderFilter === filter.value ? 'bg-black text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {filter.label} {orderCount(filter.value)}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">当前筛选条件下没有订单。</div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const fulfilling = fulfillingOrderId === order.id;
              return (
                <article key={order.id} className="rounded-2xl border border-border bg-background p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="font-black break-words">{order.productTitle}</div>
                      <div className="mt-1 text-xs text-muted-foreground break-all">订单 {order.id}</div>
                    </div>
                    <div className="text-left lg:text-right">
                      <div className="font-black">{formatCnyFromFen(order.totalPrice)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-xl bg-muted/30 p-3"><div className="text-xs text-muted-foreground">买家</div><div className="mt-1 text-sm font-bold break-words">{order.buyerName}</div></div>
                    <div className="rounded-xl bg-muted/30 p-3"><div className="text-xs text-muted-foreground">数量</div><div className="mt-1 text-sm font-bold">{order.quantity}</div></div>
                    <div className="rounded-xl bg-muted/30 p-3"><div className="text-xs text-muted-foreground">付款</div><div className="mt-1 text-sm font-bold">{paymentStatusLabel(order.paymentStatus)}</div></div>
                    <div className="rounded-xl bg-muted/30 p-3"><div className="text-xs text-muted-foreground">交付</div><div className="mt-1 text-sm font-bold">{fulfillmentStatusLabel(order.fulfillmentStatus)}</div></div>
                    <div className="rounded-xl bg-muted/30 p-3"><div className="text-xs text-muted-foreground">争议</div><div className="mt-1 text-sm font-bold">{disputeStatusLabel(order.disputeStatus)}</div></div>
                  </div>

                  {order.disputeStatus === 'OPEN' ? (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />该订单存在开放争议，交付操作已冻结，请从订单详情查看处理进度。
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Link to={`/marketplace/orders/${order.id}`} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">查看详情</Link>
                    {order.permissions?.canFulfill ? (
                      <button
                        type="button"
                        onClick={() => fulfillOrder(order.id)}
                        disabled={Boolean(fulfillingOrderId)}
                        className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        <PackageCheck className="h-4 w-4" aria-hidden="true" />{fulfilling ? '交付中...' : '确认交付'}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-black">资产管理</h2>
          <label className="block text-sm font-medium">上传 Banner / 头像</label>
          <input type="file" aria-label="上传店铺 Banner 或头像" accept="image/*" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], 'image')} />
          <label className="block text-sm font-medium">上传资源文件</label>
          <input type="file" aria-label="上传店铺资源文件" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0], 'asset')} />
          <div className="grid grid-cols-2 gap-3">
            {uploads.map((asset) => (
              <div key={asset.url} className="rounded-2xl border border-border p-3 text-xs break-all">
                <div className="font-bold">{asset.filename}</div>
                <div>{asset.mime}</div>
                <div>{asset.url}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-black">版本差异</h2>
          <div className="grid gap-3">
            <select aria-label="选择店铺旧版本" className="rounded-xl border border-border p-3" onChange={(event) => setDiffLeft(versions.find((version) => version.id === event.target.value) || null)}>
              <option value="">选择旧版本</option>
              {versions.map((version) => <option key={version.id} value={version.id}>{version.createdAt} · {version.config.shopName}</option>)}
            </select>
            <select aria-label="选择店铺新版本" className="rounded-xl border border-border p-3" onChange={(event) => setDiffRight(versions.find((version) => version.id === event.target.value) || null)}>
              <option value="">选择新版本</option>
              {versions.map((version) => <option key={version.id} value={version.id}>{version.createdAt} · {version.config.shopName}</option>)}
            </select>
          </div>
          <pre className="max-h-96 overflow-auto rounded-2xl bg-black text-white p-4 text-xs whitespace-pre-wrap">{diffText || '选择两个版本后查看差异'}</pre>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">我的商品</h2>
          <Link to="/marketplace/new" className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white">
            <Plus className="h-4 w-4" aria-hidden="true" />新建商品
          </Link>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-background p-4 space-y-3">
              <div className="font-bold">{item.title}</div>
              <div className="text-sm text-muted-foreground">{formatCnyFromFen(item.price)} · 销量 {item.sales} · 评分 {item.rating}</div>
              <div className="text-xs text-muted-foreground">{listingLabel(item)}</div>
              {item.moderationNotes ? <div className="text-xs text-amber-700">审核说明：{item.moderationNotes}</div> : null}
              <div className="flex gap-2 flex-wrap">
                <Link to={`/marketplace/${item.id}`} className="px-4 py-2 rounded-xl border border-border text-sm font-bold">查看</Link>
                <Link to={`/marketplace/edit/${item.id}`} className="px-4 py-2 rounded-xl border border-border text-sm font-bold">编辑</Link>
                {item.isPublished ? (
                  <button type="button" onClick={() => unpublish(item.id)} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold">下架</button>
                ) : item.listingStatus === 'APPROVED' ? (
                  <button type="button" onClick={() => publish(item.id)} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold">重新上架</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
