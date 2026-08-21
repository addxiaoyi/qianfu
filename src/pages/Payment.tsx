import { safeJsonParse } from '@/utils/json';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/request';
import { ApiError } from '@/api/request';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, QrCode, CreditCard, ChevronRight, ChevronLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useMobile } from '@/hooks/useMobile';
import { validateCustomPaymentAmount } from '@/utils/paymentAmount';
import { createPaymentPoller, type PaymentPollStatus } from './paymentPolling';

interface Order {
  orderId: string;
  paymentUrl: string;
  provider?: string;
  qrImagePath?: string;
  paymentQrContent?: string;
  tenantKey?: string;
  upstreamOrderId?: string;
  planId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  createdAt?: number;
}

const IMAGE_PATH_PATTERN = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i;

const toAbsoluteUrl = (value?: string) => {
  if (!value) return undefined;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) {
    return value;
  }
  if (typeof window === 'undefined') {
    return value;
  }
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
};

const looksLikeImagePath = (value?: string) => !!value && IMAGE_PATH_PATTERN.test(value);

const normalizeOrder = (value: any, planId: string, amount: number): Order | null => {
  const raw = value?.data && typeof value.data === 'object' ? value.data : value;
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const orderId = typeof raw.orderId === 'string'
    ? raw.orderId
    : typeof raw.paymentId === 'string'
      ? raw.paymentId
      : typeof raw.id === 'string'
        ? raw.id
        : '';
  let paymentUrl = typeof raw.paymentUrl === 'string' ? raw.paymentUrl : '';
  let qrImagePath = typeof raw.qrImagePath === 'string' ? raw.qrImagePath : undefined;
  let paymentQrContent = typeof raw.paymentQrContent === 'string' ? raw.paymentQrContent : undefined;

  if (!qrImagePath && looksLikeImagePath(paymentUrl)) {
    qrImagePath = paymentUrl;
  }
  if (paymentQrContent && looksLikeImagePath(paymentQrContent)) {
    qrImagePath = paymentQrContent;
    paymentQrContent = undefined;
  }

  paymentUrl = toAbsoluteUrl(paymentUrl) || '';
  qrImagePath = toAbsoluteUrl(qrImagePath);

  if (!orderId || !paymentUrl) {
    return null;
  }

  return {
    orderId,
    paymentUrl,
    provider: typeof raw.provider === 'string' ? raw.provider : undefined,
    qrImagePath,
    paymentQrContent,
    tenantKey: typeof raw.tenantKey === 'string' ? raw.tenantKey : undefined,
    upstreamOrderId: typeof raw.upstreamOrderId === 'string' ? raw.upstreamOrderId : undefined,
    planId,
    amount,
    status: ['COMPLETED', 'FAILED', 'EXPIRED'].includes(raw.status) ? raw.status : 'PENDING',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  };
};

const isValidOrder = (value: any): value is Order => {
  return !!value
    && typeof value.orderId === 'string'
    && typeof value.paymentUrl === 'string'
    && typeof value.planId === 'string'
    && typeof value.amount === 'number'
    && ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'].includes(value.status);
};

const PLANS = [
  { id: 'custom', name: '钱包充值', price: 10, period: 'recharge', desc: '先充值到账户余额，再在发布服务器时按月租 / 季付 / 年付扣款' },
] as const;

const paymentMethodMeta = {
  wechat: { label: '微信支付', short: '实时到账', accentClass: 'text-green-500' },
  alipay: { label: '支付宝', short: '实时到账', accentClass: 'text-blue-500' },
  paypal: { label: 'PayPal', short: '跳转 PayPal 完成支付', accentClass: 'text-sky-600' },
} as const;

const flowSteps = ['选择方案', '支付方式', '生成订单'];
const PENDING_ORDER_TTL_MS = 15 * 60 * 1000;
const PENDING_ORDER_STORAGE_KEY = 'payment.pending.order';

const allowedPaymentHosts = (import.meta.env.VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS || '')
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean);

const isSafeCheckoutUrl = (value: string, provider?: string) => {
  if (!value) return false;

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    if (parsed.origin === window.location.origin) {
      return true;
    }

    const host = parsed.host.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    if (allowedPaymentHosts.includes(host) || allowedPaymentHosts.includes(hostname)) {
      return true;
    }

    if (provider === 'creem') {
      return hostname === 'creem.io' || hostname.endsWith('.creem.io');
    }

    if (provider === 'paypal') {
      return hostname === 'paypal.com' || hostname.endsWith('.paypal.com');
    }

    return false;
  } catch {
    return false;
  }
};

const openCheckoutUrlSafely = (value: string, provider?: string) => {
  if (!isSafeCheckoutUrl(value, provider)) {
    throw new Error('支付跳转地址不安全，请联系管理员检查支付网关配置。');
  }
  window.location.href = value;
};

const buildLocalQrUrl = (value?: string, size = 220) => {
  if (!value) return '';
  const encoded = btoa(unescape(encodeURIComponent(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `/api/v1/assets/qr?size=${size}&data_b64=${encoded}`;
};

const readPendingOrderSnapshot = () => {
  if (typeof window === 'undefined') return null;
  const saved = window.sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
  window.localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  return saved;
};

const writePendingOrderSnapshot = (order: Order) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(order));
  window.localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
};

const clearPendingOrderSnapshot = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  window.localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
};

const Payment: React.FC = () => {
  const navigate = useNavigate();
  const { isMobile } = useMobile();
  const [step, setStep] = useState(1); // For mobile 3-step flow
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[number]>(PLANS[0]);
  const [customAmount, setCustomAmount] = useState<number>(10);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay' | 'paypal'>('wechat');
  const paymentMeta = paymentMethodMeta[paymentMethod];
  const pollRef = useRef<ReturnType<typeof createPaymentPoller> | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const backoffTimeoutRef = useRef<number | null>(null);

  const clearPolling = useCallback(() => {
    pollRef.current?.stop();
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (backoffTimeoutRef.current) window.clearTimeout(backoffTimeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
    backoffTimeoutRef.current = null;
  }, []);

  const resetPendingState = useCallback((options?: { resetStep?: boolean }) => {
    clearPolling();
    setPendingOrder(null);
    clearPendingOrderSnapshot();
    if (isMobile && options?.resetStep !== false) {
      setStep(1);
    }
  }, [clearPolling, isMobile]);

  const startPolling = useCallback((orderId: string) => {
    clearPolling();

    const stopPendingOrder = (title: string, description: string) => {
      resetPendingState({ resetStep: false });
      toast({
        title,
        description,
        variant: 'destructive',
      });
    };

    const poller = createPaymentPoller(
      async (signal): Promise<PaymentPollStatus> => {
        const statusData = await api.get<Order>(`/payment/status/${orderId}`, undefined, { signal });
        const status = (statusData as unknown)?.status ?? (statusData as unknown)?.data?.status;
        return ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'].includes(status) ? status : 'PENDING';
      },
      {
        initialDelayMs: 3000,
        maxDelayMs: 15_000,
        maxFailures: 4,
        onStatus: (status) => {
          setPendingOrder((prev) => (prev ? { ...prev, status } : null));
          if (status !== 'PENDING') clearPendingOrderSnapshot();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 429) {
            stopPendingOrder('支付状态轮询过于频繁', '已暂停当前订单轮询，请返回支付页重新发起订单。');
            return;
          }
          stopPendingOrder('支付状态暂不可达', '已暂停轮询，请稍后重新发起订单。');
        },
      },
    );
    pollRef.current = poller;
    poller.start();

    timeoutRef.current = window.setTimeout(() => {
      resetPendingState();
      toast({
        title: '支付订单已过期',
        description: '本地保存的待支付订单已超时清理。',
      });
    }, PENDING_ORDER_TTL_MS);
  }, [clearPolling, resetPendingState]);

  useEffect(() => {
    const saved = readPendingOrderSnapshot();
    if (saved) {
      try {
        const order = safeJsonParse(saved, {});
        if (isValidOrder(order)) {
          const createdAt = typeof order.createdAt === 'number' ? order.createdAt : 0;
          if (createdAt > 0 && Date.now() - createdAt > PENDING_ORDER_TTL_MS) {
            resetPendingState();
            toast({
              title: '已清理过期订单',
              description: '检测到本地待支付订单已过期，已自动移除。',
            });
            return;
          }
          setPendingOrder(order);
          startPolling(order.orderId);
        } else {
          resetPendingState();
          toast({
            title: '已清理过期订单',
            description: '本地保存的支付订单格式无效，已自动移除。',
          });
        }
      } catch {
        resetPendingState();
      }
    }
    return () => clearPolling();
  }, [resetPendingState, startPolling, clearPolling]);

  const handleCreateOrder = async () => {
    const amount = customAmount;
    const amountError = validateCustomPaymentAmount(amount);
    if (amountError) {
      toast({
        title: '金额范围无效',
        description: amountError,
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      const orderResponse = await api.post<any>('/payment/create', { planId: 'custom', amount, paymentMethod }, {
        headers: { 'Idempotency-Key': uuidv4() },
        skipCsrf: false,
      });
      const order = normalizeOrder(orderResponse, 'custom', amount);
      if (!isValidOrder(order)) {
        throw new Error('支付服务返回了无效的订单数据');
      }
      order.createdAt = Date.now();
      setPendingOrder(order);
      writePendingOrderSnapshot(order);
      startPolling(order.orderId);
      if (order.provider === 'creem' || order.provider === 'paypal') {
        openCheckoutUrlSafely(order.paymentUrl, order.provider);
        return;
      }
      if (isMobile) setStep(3);
    } catch (err: any) {
      toast({
        title: '创建订单失败',
        description: err?.message || '当前后端未响应，请稍后重试。',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERING LOGIC ---

  if (pendingOrder && pendingOrder.status === 'COMPLETED') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 bg-white">
        <div className="relative w-full max-w-md p-12 rounded-[3.5rem] border border-zinc-50 bg-zinc-50/30 shadow-xs text-center overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="w-20 h-20 bg-white border border-zinc-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-accent" />
          </div>
          <h2 className="text-4xl font-black tracking-tighter uppercase italic mb-4">支付成功</h2>
          <p className="text-zinc-400 font-bold italic leading-relaxed mb-10">充值金额已到账钱包，发布服务器时会按所选周期扣除余额。</p>
          <button type="button" onClick={() => { resetPendingState(); navigate('/dashboard'); }} className="w-full py-5 btn-accent text-white rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.5em] shadow-2xl italic">返回中心</button>
        </div>
      </div>
    );
  }

  // Mobile Step 3 or Desktop Pending
  if (pendingOrder && pendingOrder.status === 'PENDING') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 bg-white">
        <div className="relative w-full max-w-md p-10 rounded-[3.5rem] border border-zinc-50 bg-zinc-50/30 shadow-xs text-center overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-center gap-3 text-accent mb-8 font-black uppercase tracking-[0.4em] text-[10px] italic">
            <Loader2 className="w-4 h-4 animate-spin" /> 正在轮询订单状态
          </div>
          
          {pendingOrder.provider === 'creem' || pendingOrder.provider === 'paypal' ? (
            <div className="bg-white p-6 rounded-[2.5rem] mb-8 border border-zinc-100 shadow-sm space-y-4">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">支付跳转</div>
              <div className="text-sm font-bold text-zinc-500 break-all">{pendingOrder.paymentUrl}</div>
              <button
                type="button"
                onClick={() => {
                  try {
                    openCheckoutUrlSafely(pendingOrder.paymentUrl, pendingOrder.provider);
                  } catch (error) {
                    toast({
                      title: '无法打开支付页',
                      description: error instanceof Error ? error.message : '支付地址校验失败',
                      variant: 'destructive',
                    });
                  }
                }}
                className="w-full py-4 btn-accent text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.35em] italic"
              >
                打开支付页
              </button>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-[2.5rem] mb-8 inline-block border border-zinc-100 shadow-sm">
              <img
                src={pendingOrder.paymentQrContent
                  ? buildLocalQrUrl(pendingOrder.paymentQrContent, 220)
                  : pendingOrder.qrImagePath || buildLocalQrUrl(pendingOrder.paymentUrl, 220)}
                alt="QR Code"
                onError={(event) => {
                  const target = event.currentTarget;
                  target.onerror = null;
                  target.src = buildLocalQrUrl(pendingOrder.paymentUrl, 220);
                }}
              />
            </div>
          )}

          <h2 className="text-3xl font-black tracking-tighter uppercase italic mb-3">
            {paymentMeta.label}
          </h2>
          <p className={`text-zinc-400 font-bold italic leading-relaxed mb-2 ${paymentMeta.accentClass}`}>{paymentMeta.short}</p>
          {pendingOrder.provider === 'xpay-tenant' && pendingOrder.tenantKey && (
            <p className="text-zinc-300 font-black uppercase tracking-[0.3em] text-[10px] italic mb-2">XPay / {pendingOrder.tenantKey}</p>
          )}
          {pendingOrder.provider === 'creem' && (
            <p className="text-zinc-300 font-black uppercase tracking-[0.3em] text-[10px] italic mb-2">Creem / Hosted Checkout</p>
          )}
          {pendingOrder.provider === 'paypal' && (
            <p className="text-zinc-300 font-black uppercase tracking-[0.3em] text-[10px] italic mb-2">PayPal / Orders v2</p>
          )}
          <p className="text-zinc-400 font-bold italic leading-relaxed mb-8">
            {pendingOrder.provider === 'paypal'
              ? `请在 PayPal 页面完成 ¥${pendingOrder.amount} 的订单支付`
              : `请扫描二维码完成 ¥${pendingOrder.amount} 的订单支付`}
          </p>
          {pendingOrder.provider === 'xpay-tenant' && (
            <div className="mb-8 rounded-[2rem] border border-zinc-100 bg-white px-5 py-4 text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic mb-2">付款备注</div>
              <div className="font-mono text-xs break-all text-zinc-700">{pendingOrder.orderId}</div>
              <p className="mt-2 text-xs font-bold text-zinc-400">个人码到账监听需要用备注匹配订单，请付款时填写此订单号。</p>
            </div>
          )}
          {(pendingOrder.provider === 'tpay' || pendingOrder.provider === 'hupijiao' || pendingOrder.provider === 'qiupay') && (
            <div className="mb-8 rounded-[2rem] border border-zinc-100 bg-white px-5 py-4 text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic mb-2">自动到账</div>
              <p className="text-xs font-bold text-zinc-400">当前通道支持自动异步回调，无需填写付款备注，支付成功后会自动更新订单状态。</p>
            </div>
          )}
          
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => {
                resetPendingState();
                toast({
                  title: '已重置待支付订单',
                  description: '您可以重新生成新的支付订单。',
                });
              }}
              className="px-6 py-3 rounded-[1.5rem] border border-zinc-100 bg-white text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500 hover:border-accent hover:text-accent transition-colors italic"
            >
              重新生成订单
            </button>
            <button 
              type="button"
              onClick={() => { resetPendingState(); navigate('/dashboard'); }}
              className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 hover:text-accent transition-colors italic"
            >
              取消订单
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile Steps 1 & 2
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <div className="px-6 py-6 border-b border-zinc-50 bg-white/90 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            {step > 1 && <button type="button" onClick={() => setStep(step - 1)} className="w-10 h-10 rounded-xl border border-zinc-100 flex items-center justify-center hover:bg-zinc-50 transition-colors"><ChevronLeft className="w-5 h-5" /></button>}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">充值流程</div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase italic">{flowSteps[step - 1]}</h1>
            </div>
            <div className="ml-auto px-4 py-2 rounded-full border border-zinc-100 text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-400">第 {step}/3 步</div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto w-full px-6 py-10 flex-grow">
          {step === 1 ? (
            <div className="grid grid-cols-1 gap-6">
              {PLANS.map(plan => (
                <div
                  key={plan.id}
                  className={`relative rounded-[3rem] border transition-all shadow-xs overflow-hidden ${
                    selectedPlan.id === plan.id ? 'border-accent bg-accent-subtle' : 'border-zinc-50 bg-zinc-50/30 hover:bg-white hover:border-accent'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    aria-pressed={selectedPlan.id === plan.id}
                    className="relative w-full p-8 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                  >
                    <span className="absolute top-6 right-6 text-[9px] font-black text-zinc-200 uppercase tracking-widest italic">/ {plan.period}</span>
                    <span className="flex items-start justify-between gap-8">
                      <span className="space-y-3 max-w-lg">
                        <span className="block text-2xl sm:text-3xl font-black uppercase italic tracking-tighter leading-none">{plan.name}</span>
                        <span className="block text-zinc-400 font-bold italic leading-relaxed">{plan.desc}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-4xl font-black tracking-tighter italic text-black">¥{customAmount}</span>
                        <span className="block text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic mt-2">{selectedPlan.id === plan.id ? '已选择' : '点击选择'}</span>
                      </span>
                    </span>
                  </button>
                  {selectedPlan.id === plan.id && plan.id === 'custom' && (
                    <div className="mx-8 mb-8 p-6 rounded-[2rem] border border-zinc-100 bg-white/80">
                      <label htmlFor="mobile-wallet-custom-amount" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic block mb-3">自定义金额</label>
                      <input
                        id="mobile-wallet-custom-amount"
                        type="number"
                        min="0.1"
                        max="10000"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(Number(e.target.value))}
                        className="w-full text-3xl font-black bg-transparent border-b border-zinc-100 py-2 outline-hidden italic"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => setPaymentMethod('wechat')}
                aria-pressed={paymentMethod === 'wechat'}
                className={`p-8 rounded-[3rem] border text-left transition-all shadow-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${paymentMethod === 'wechat' ? 'border-accent bg-accent-subtle' : 'border-zinc-50 bg-zinc-50/30 hover:bg-white hover:border-accent'}`}
              >
                <span className="flex items-center gap-5">
                  <span className="w-14 h-14 bg-white rounded-[1.5rem] border border-zinc-100 flex items-center justify-center text-green-500 shadow-sm"><QrCode className="w-7 h-7" /></span>
                  <span>
                    <span className="block text-2xl font-black uppercase italic tracking-tighter">微信支付</span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic mt-1">扫码支付</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('alipay')}
                aria-pressed={paymentMethod === 'alipay'}
                className={`p-8 rounded-[3rem] border text-left transition-all shadow-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${paymentMethod === 'alipay' ? 'border-accent bg-accent-subtle' : 'border-zinc-50 bg-zinc-50/30 hover:bg-white hover:border-accent'}`}
              >
                <span className="flex items-center gap-5">
                  <span className="w-14 h-14 bg-white rounded-[1.5rem] border border-zinc-100 flex items-center justify-center text-blue-500 shadow-sm"><CreditCard className="w-7 h-7" /></span>
                  <span>
                    <span className="block text-2xl font-black uppercase italic tracking-tighter">支付宝</span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic mt-1">扫码支付</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('paypal')}
                aria-pressed={paymentMethod === 'paypal'}
                className={`p-8 rounded-[3rem] border text-left transition-all shadow-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${paymentMethod === 'paypal' ? 'border-accent bg-accent-subtle' : 'border-zinc-50 bg-zinc-50/30 hover:bg-white hover:border-accent'}`}
              >
                <span className="flex items-center gap-5">
                  <span className="w-14 h-14 bg-white rounded-[1.5rem] border border-zinc-100 flex items-center justify-center text-sky-600 shadow-sm"><CreditCard className="w-7 h-7" /></span>
                  <span>
                    <span className="block text-2xl font-black uppercase italic tracking-tighter">PayPal</span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic mt-1">跳转支付</span>
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-50 bg-white sticky bottom-0">
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between gap-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">总计费用</div>
              <div className="text-3xl font-black tracking-tighter italic">¥{customAmount}</div>
            </div>
            <button 
              type="button"
              onClick={() => step === 1 ? setStep(2) : handleCreateOrder()}
              disabled={loading}
              className="px-10 py-5 btn-accent text-white rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.5em] shadow-2xl italic flex items-center gap-3"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {step === 1 ? '继续下一步' : '立即支付'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop Flow (Existing but Polished)
  return (
    <div className="max-w-6xl mx-auto py-24 px-4">
      <div className="flex flex-col items-center text-center mb-16">
         <h1 className="text-5xl font-black tracking-tight mb-4">钱包充值</h1>
         <p className="text-muted-foreground text-lg max-w-xl">充值到账户余额后，再去发布页选择上架周期。发布时系统会自动从钱包扣款。</p>
      </div>

      <div className="grid grid-cols-1 gap-8 mb-16">
        {PLANS.map((plan) => (
          <button
            type="button"
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            aria-pressed={selectedPlan.id === plan.id}
            className={`p-8 rounded-[2rem] border-2 text-left transition-all flex flex-col group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${
              selectedPlan.id === plan.id ? 'border-brand bg-brand/5 ring-8 ring-brand/5 scale-105' : 'border-border hover:border-brand/30'
            }`}
          >
            <span className="text-xl font-bold mb-2">{plan.name}</span>
            <span className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-black">¥{customAmount}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{plan.period}</span>
            </span>
            <span className="text-sm text-muted-foreground mb-8 leading-relaxed">{plan.desc}</span>
            <span className={`mt-auto py-2 px-4 rounded-xl text-center text-xs font-bold uppercase tracking-widest ${
               selectedPlan.id === plan.id ? 'bg-brand text-white' : 'bg-muted text-muted-foreground group-hover:bg-brand/10 group-hover:text-brand'
            }`}>
              {selectedPlan.id === plan.id ? '已选择' : '点击选择'}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-stretch">
         <div className="flex-grow p-10 bg-card border border-border rounded-[2.5rem]">
            <h3 className="text-xl font-bold mb-6">支付设置</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase text-muted-foreground">支付方式</label>
                 <div className="flex gap-4">
                    <button type="button" onClick={() => setPaymentMethod('wechat')} className={`flex-grow py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === 'wechat' ? 'border-brand bg-brand/5 text-brand' : 'border-border hover:border-brand/20'}`}>
                       <QrCode className="w-4 h-4" /> 微信支付
                    </button>
                    <button type="button" onClick={() => setPaymentMethod('alipay')} className={`flex-grow py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === 'alipay' ? 'border-brand bg-brand/5 text-brand' : 'border-border hover:border-brand/20'}`}>
                       <CreditCard className="w-4 h-4" /> 支付宝
                    </button>
                    <button type="button" onClick={() => setPaymentMethod('paypal')} className={`flex-grow py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === 'paypal' ? 'border-brand bg-brand/5 text-brand' : 'border-border hover:border-brand/20'}`}>
                       <CreditCard className="w-4 h-4" /> PayPal
                    </button>
                 </div>
               </div>
               {selectedPlan.id === 'custom' && (
                 <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
                    <label htmlFor="desktop-wallet-custom-amount" className="text-xs font-bold uppercase text-muted-foreground">自定义金额 (¥)</label>
                    <input
                      id="desktop-wallet-custom-amount"
                      type="number" 
                      min="0.1"
                      max="10000"
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl font-bold text-xl"
                    />
                 </div>
               )}
            </div>
         </div>
         
         <div className="md:w-96 p-10 bg-brand text-white rounded-[2.5rem] shadow-2xl shadow-brand/30 flex flex-col justify-between">
            <div>
               <h3 className="text-white/60 font-bold uppercase tracking-widest text-xs mb-2">确认订单</h3>
               <div className="text-lg font-bold mb-1">{selectedPlan.name}</div>
               <div className="text-sm opacity-80 mb-8">{selectedPlan.desc}</div>
            </div>
            <div>
               <div className="flex justify-between items-end mb-8">
                  <span className="text-white/60 font-medium">应付金额</span>
                  <span className="text-5xl font-black">¥{customAmount}</span>
               </div>
               <button 
                type="button"
                onClick={handleCreateOrder}
                disabled={loading}
                className="w-full py-5 bg-white text-brand rounded-2xl font-black hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3"
               >
                 {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CreditCard className="w-6 h-6" />}
                 立即支付
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Payment;
