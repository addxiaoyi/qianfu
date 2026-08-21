import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, Download, PackageCheck, ShoppingCart } from 'lucide-react';
import { api } from '@/api/request';
import { sanitizeUrl, isUrlSafe } from '@/utils/urlValidator';
import { formatCnyFromFen } from '@/utils/money';
import { createPaymentIdempotencyKey, isTrustedPaymentUrl } from '@/utils/paymentRedirect';

type OrderDetail = {
  order: {
    id: string;
    productTitle: string;
    buyerName: string;
    totalPrice: number;
    paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
    fulfillmentStatus?: 'PENDING' | 'READY' | 'DELIVERED';
    disputeStatus?: 'NONE' | 'OPEN' | 'RESOLVED' | 'REJECTED';
    disputeReason?: string | null;
    disputeDescription?: string | null;
    disputeResolution?: string | null;
    deliveryUrl?: string | null;
    logs?: Array<{ at: string; status: string; note: string }>;
    createdAt: string;
  };
  product?: {
    id: string;
    title: string;
    downloadUrl?: string | null;
  };
  roles?: { isBuyer: boolean; isSeller: boolean };
  permissions?: { canPay: boolean; canFulfill: boolean; canDownload: boolean; canOpenDispute: boolean; canResolveDispute: boolean };
};

type MarketplaceDownloadResponse = {
  downloadUrl?: string;
  file?: { version?: string; sha256?: string | null; size?: number | null; mime?: string | null };
};

const defaultPermissions = { canPay: false, canFulfill: false, canDownload: false, canOpenDispute: false, canResolveDispute: false };
const defaultRoles = { isBuyer: false, isSeller: false };

const paymentStatusLabel = (status?: OrderDetail['order']['paymentStatus']) => ({
  PENDING: '待付款',
  PAID: '已付款',
  FAILED: '付款失败',
  REFUNDED: '已退款',
}[status || 'PENDING']);

const fulfillmentStatusLabel = (status?: OrderDetail['order']['fulfillmentStatus']) => ({
  PENDING: '待交付',
  READY: '待人工交付',
  DELIVERED: '已交付',
}[status || 'PENDING']);

const disputeStatusLabel = (status?: OrderDetail['order']['disputeStatus']) => ({
  NONE: '无争议',
  OPEN: '争议处理中',
  RESOLVED: '争议已解决',
  REJECTED: '争议已驳回',
}[status || 'NONE']);

export default function MarketplaceOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<OrderDetail['order'] | null>(null);
  const [roles, setRoles] = useState(defaultRoles);
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('NOT_DELIVERED');
  const [description, setDescription] = useState('');
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat' | 'balance'>('alipay');

  const loadOrder = useCallback(async () => {
    if (!id) return;
    const data = await api.get<OrderDetail>(`/qianfu/marketplace/orders/${id}`);
    setOrder(data.order || null);
    setRoles(data.roles || defaultRoles);
    setPermissions(data.permissions || defaultPermissions);
  }, [id]);

  useEffect(() => {
    setOrder(null);
    setMessage('');
    loadOrder().catch((error) => setMessage(error?.message || '加载订单失败'));
  }, [loadOrder]);

  if (!order) {
    return <div className="max-w-4xl mx-auto px-6 py-16 text-sm text-muted-foreground">{message || '订单加载中...'}</div>;
  }

  const backTo = roles.isSeller ? '/seller/marketplace' : '/marketplace/shop';
  const backLabel = roles.isSeller ? '返回卖家控制台' : '返回商城';

  const payOrder = async () => {
    if (!id || paying) return;
    setPaying(true);
    setMessage('');
    try {
      const payment = await api.post<{ status?: string; paymentUrl?: string }>('/payment/create', {
        planId: 'marketplace',
        marketplaceOrderId: id,
        paymentMethod,
      }, {
        headers: { 'Idempotency-Key': createPaymentIdempotencyKey() },
      });
      if (payment.status === 'COMPLETED') {
        await loadOrder();
        setMessage('支付已完成，订单状态已刷新。');
        return;
      }
      if (!isTrustedPaymentUrl(payment.paymentUrl)) {
        setMessage('支付通道未返回可信地址，订单仍保留为待支付，请稍后重试。');
        return;
      }
      window.location.assign(payment.paymentUrl);
    } catch (error: any) {
      setMessage(error?.message || '继续支付失败');
    } finally {
      setPaying(false);
    }
  };

  const downloadOrder = async () => {
    if (!id || downloading) return;
    setDownloading(true);
    setMessage('');
    try {
      const result = await api.post<MarketplaceDownloadResponse>(`/qianfu/marketplace/orders/${id}/download`, {});
      const safeUrl = sanitizeUrl(result.downloadUrl);
      if (!safeUrl || !isUrlSafe(safeUrl)) {
        setMessage('下载服务未返回可用地址，请稍后重试。');
        return;
      }
      window.location.assign(safeUrl);
    } catch (error: any) {
      setMessage(error?.message || '下载签发失败');
    } finally {
      setDownloading(false);
    }
  };

  const fulfillOrder = async () => {
    if (!id || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await api.post<{ replayed?: boolean }>(`/qianfu/marketplace/orders/${id}/fulfill`, {});
      await loadOrder();
      setMessage(result.replayed ? '该订单已完成交付。' : '订单已完成交付，履约日志已更新。');
    } catch (error: any) {
      setMessage(error?.message || '订单交付失败');
    } finally {
      setSaving(false);
    }
  };

  const openDispute = async () => {
    if (!id || saving) return;
    setSaving(true);
    setMessage('');
    try {
      await api.post(`/qianfu/marketplace/orders/${id}/dispute`, { reason, description });
      await loadOrder();
      setDescription('');
      setMessage('争议已提交，平台将保留订单与履约记录进行审核。');
    } catch (error: any) {
      setMessage(error?.message || '争议提交失败');
    } finally {
      setSaving(false);
    }
  };

  const resolveDispute = async (status: 'RESOLVED' | 'REJECTED') => {
    if (!id || saving) return;
    setSaving(true);
    setMessage('');
    try {
      await api.post(`/qianfu/marketplace/orders/${id}/dispute/resolve`, { status, resolution });
      await loadOrder();
      setResolution('');
      setMessage('争议处理结果已记录并通知买卖双方。');
    } catch (error: any) {
      setMessage(error?.message || '争议处理失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 sm:py-16 space-y-6">
      <Link to={backTo} className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft className="w-4 h-4" />{backLabel}</Link>
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 md:p-8 space-y-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black">订单详情</h1>
            <p className="text-sm text-muted-foreground mt-2">查看付款、交付、争议和履约日志。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {permissions.canFulfill ? (
              <button type="button" onClick={fulfillOrder} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                <PackageCheck className="h-4 w-4" />{saving ? '交付中...' : '确认交付'}
              </button>
            ) : null}
            {permissions.canDownload ? (
              <button type="button" onClick={downloadOrder} disabled={downloading} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-black text-white font-bold text-sm disabled:opacity-50">
                <Download className="w-4 h-4" />{downloading ? '签发下载中...' : '下载资源'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">商品</div><div className="font-bold mt-1">{order.productTitle}</div></div>
          <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">买家</div><div className="font-bold mt-1">{order.buyerName}</div></div>
          <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">金额</div><div className="font-bold mt-1">{formatCnyFromFen(order.totalPrice)}</div></div>
        </div>

        <div className="grid md:grid-cols-3 gap-3 pt-1">
          <div className="rounded-2xl border border-border p-4 bg-muted/20 flex items-center gap-3"><Clock3 className="w-5 h-5" /><div><div className="text-xs text-muted-foreground">付款状态</div><div className="font-bold">{paymentStatusLabel(order.paymentStatus)}</div></div></div>
          <div className="rounded-2xl border border-border p-4 bg-muted/20 flex items-center gap-3"><CheckCircle2 className="w-5 h-5" /><div><div className="text-xs text-muted-foreground">交付状态</div><div className="font-bold">{fulfillmentStatusLabel(order.fulfillmentStatus)}</div></div></div>
          <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">争议状态</div><div className="font-bold mt-1">{disputeStatusLabel(order.disputeStatus)}</div></div>
        </div>

        {permissions.canPay ? (
          <section className="rounded-2xl border border-border p-5 space-y-4 bg-muted/10">
            <div>
              <div className="font-bold">继续支付</div>
              <p className="mt-1 text-sm text-muted-foreground">订单已保留，可选择支付方式继续完成付款，不会重复创建商城订单。</p>
            </div>
            <fieldset className="grid gap-2 sm:grid-cols-3">
              <legend className="sr-only">选择支付方式</legend>
              {(['alipay', 'wechat', 'balance'] as const).map((method) => (
                <label key={method} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-bold">
                  <input type="radio" name="order-payment-method" value={method} checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} />
                  {method === 'alipay' ? '支付宝' : method === 'wechat' ? '微信' : '余额'}
                </label>
              ))}
            </fieldset>
            <button type="button" onClick={payOrder} disabled={paying || saving} className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              <ShoppingCart className="h-4 w-4" />{paying ? '正在创建支付...' : '继续支付'}
            </button>
          </section>
        ) : null}

        <section className="rounded-2xl border border-border p-5 space-y-4 bg-muted/10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="font-bold">订单争议</div>
            <div className="text-xs font-bold">{disputeStatusLabel(order.disputeStatus)}</div>
          </div>
          {order.disputeReason ? <div className="text-sm">原因：{order.disputeReason}</div> : null}
          {order.disputeDescription ? <div className="text-sm text-muted-foreground">说明：{order.disputeDescription}</div> : null}
          {order.disputeResolution ? <div className="text-sm text-muted-foreground">处理结果：{order.disputeResolution}</div> : null}

          {permissions.canOpenDispute ? (
            <div className="grid gap-3">
              <select aria-label="订单争议原因" value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                <option value="NOT_DELIVERED">未收到交付</option>
                <option value="NOT_AS_DESCRIBED">商品与描述不符</option>
                <option value="UNAUTHORIZED">非本人授权订单</option>
                <option value="OTHER">其他问题</option>
              </select>
              <textarea aria-label="订单争议说明" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={2000} className="min-h-28 rounded-xl border border-border bg-background px-4 py-3 text-sm" placeholder="请描述问题、发生时间和已尝试的沟通方式" />
              <button type="button" onClick={openDispute} disabled={saving || description.trim().length < 10} className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? '提交中...' : '发起争议'}</button>
            </div>
          ) : null}

          {permissions.canResolveDispute ? (
            <div className="grid gap-3">
              <textarea aria-label="订单争议处理结论" value={resolution} onChange={(event) => setResolution(event.target.value)} maxLength={2000} className="min-h-28 rounded-xl border border-border bg-background px-4 py-3 text-sm" placeholder="填写核验依据和处理结论" />
              <div className="flex gap-3 flex-wrap">
                <button type="button" onClick={() => resolveDispute('RESOLVED')} disabled={saving || !resolution.trim()} className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-50">处理争议</button>
                <button type="button" onClick={() => resolveDispute('REJECTED')} disabled={saving || !resolution.trim()} className="rounded-xl border border-border px-5 py-3 text-sm font-bold disabled:opacity-50">驳回争议</button>
              </div>
            </div>
          ) : null}
          {message ? <div role="status" className="text-sm text-muted-foreground">{message}</div> : null}
        </section>

        <div className="space-y-4 pt-2">
          <div className="text-sm font-bold">履约时间轴</div>
          <div className="relative pl-4 border-l-2 border-dashed border-border space-y-4">
            {order.logs?.length ? order.logs.map((log) => (
              <div key={`${log.at}-${log.status}`} className="relative">
                <div className="absolute -left-[23px] top-3 w-4 h-4 rounded-full bg-black border-4 border-background" />
                <div className="rounded-2xl border border-border p-4 text-sm bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-bold text-foreground">{log.status}</div>
                    <div className="text-xs text-muted-foreground">{log.at}</div>
                  </div>
                  <div className="mt-2 leading-6 text-muted-foreground">{log.note}</div>
                </div>
              </div>
            )) : <div className="text-sm text-muted-foreground">暂无履约日志</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
