import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, ArrowLeft, Clock3, CheckCircle2 } from 'lucide-react';
import { api } from '@/api/request';
import { sanitizeUrl, isUrlSafe } from '@/utils/urlValidator';

type OrderDetail = {
  order: {
    id: string;
    productTitle: string;
    buyerName: string;
    totalPrice: number;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    deliveryUrl?: string | null;
    logs?: Array<{ at: string; status: string; note: string }>;
    createdAt: string;
  };
  product?: {
    id: string;
    title: string;
    downloadUrl?: string | null;
  };
};

export default function MarketplaceOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<OrderDetail['order'] | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get<OrderDetail>(`/qianfu/marketplace/orders/${id}`)
      .then((data) => {
        setOrder(data.order || null);
      })
      .catch((error) => setMessage(error?.message || '加载订单失败'));
  }, [id]);

  if (!order) {
    return <div className="max-w-4xl mx-auto px-6 py-16 text-sm text-muted-foreground">{message || '订单加载中...'}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-6">
      <Link to="/marketplace/favorites" className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft className="w-4 h-4" />返回收藏</Link>
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black">订单详情</h1>
            <p className="text-sm text-muted-foreground mt-2">查看支付、发货与履约日志。</p>
          </div>
          {order.deliveryUrl && <a href={order.deliveryUrl} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-black text-white font-bold text-sm"><Download className="w-4 h-4" />下载资源</a>}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">商品</div><div className="font-bold mt-1">{order.productTitle}</div></div>
          <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">买家</div><div className="font-bold mt-1">{order.buyerName}</div></div>
          <div className="rounded-2xl border border-border p-4 bg-muted/20"><div className="text-xs text-muted-foreground">金额</div><div className="font-bold mt-1">¥{order.totalPrice}</div></div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 pt-1">
          <div className="rounded-2xl border border-border p-4 bg-muted/20 flex items-center gap-3"><Clock3 className="w-5 h-5" /><div><div className="text-xs text-muted-foreground">支付状态</div><div className="font-bold">{order.paymentStatus || 'PENDING'}</div></div></div>
          <div className="rounded-2xl border border-border p-4 bg-muted/20 flex items-center gap-3"><CheckCircle2 className="w-5 h-5" /><div><div className="text-xs text-muted-foreground">发货状态</div><div className="font-bold">{order.fulfillmentStatus || 'PENDING'}</div></div></div>
        </div>

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
