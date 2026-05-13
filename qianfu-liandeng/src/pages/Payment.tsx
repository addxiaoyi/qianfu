import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/request';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, QrCode, CreditCard, ChevronRight, ChevronLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useMobile } from '@/hooks/useMobile';

interface Order {
  orderId: string;
  paymentUrl: string;
  planId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
}

const isValidOrder = (value: any): value is Order => {
  return !!value
    && typeof value.orderId === 'string'
    && typeof value.paymentUrl === 'string'
    && typeof value.planId === 'string'
    && typeof value.amount === 'number'
    && ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'].includes(value.status);
};

const PLANS = [
  { id: 'basic-monthly', name: '基础月度', price: 20, period: 'monthly', desc: '首页推荐 + 搜索优先' },
  { id: 'pro-quarterly', name: '专业季度', price: 55, period: 'quarterly', desc: '全站置顶 + 专属标识' },
  { id: 'vip-yearly', name: '尊享年度', price: 200, period: 'yearly', desc: '超级置顶 + 评论特权' },
  { id: 'custom', name: '自定义推广', price: 0, period: 'one-time', desc: '灵活金额，按量分配' },
] as const;

const paymentMethodMeta = {
  wechat: { label: '微信支付', short: 'WECHAT PAY', accentClass: 'text-green-500' },
  alipay: { label: '支付宝', short: 'ALIPAY', accentClass: 'text-blue-500' },
} as const;

const flowSteps = ['选择方案', '支付方式', '生成订单'];

const Payment: React.FC = () => {
  const isMobile = useMobile();
  const [step, setStep] = useState(1); // For mobile 3-step flow
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[number]>(PLANS[0]);
  const [customAmount, setCustomAmount] = useState<number>(10);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('wechat');
  const paymentMeta = paymentMethodMeta[paymentMethod];
  const pollRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearPolling = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
  };

  useEffect(() => {
    const saved = localStorage.getItem('payment.pending.order');
    if (saved) {
      try {
        const order = JSON.parse(saved);
        if (isValidOrder(order)) {
          setPendingOrder(order);
          startPolling(order.orderId);
        } else {
          localStorage.removeItem('payment.pending.order');
          toast({
            title: '已清理过期订单',
            description: '本地保存的支付订单格式无效，已自动移除。',
          });
        }
      } catch {
        localStorage.removeItem('payment.pending.order');
      }
    }
    return () => clearPolling();
  }, []);

  const startPolling = (orderId: string) => {
    clearPolling();
    let consecutiveFailures = 0;
    pollRef.current = window.setInterval(async () => {
      try {
        const statusData = await api.get<Order>(`/payment/status/${orderId}`);
        const status = (statusData as any)?.status ?? (statusData as any)?.data?.status;
        consecutiveFailures = 0;
        if (status === 'COMPLETED') {
          clearPolling();
          setPendingOrder((prev) => (prev ? { ...prev, status } : null));
          localStorage.removeItem('payment.pending.order');
        }
        if (status === 'FAILED' || status === 'EXPIRED') {
          clearPolling();
          setPendingOrder((prev) => (prev ? { ...prev, status } : null));
          localStorage.removeItem('payment.pending.order');
        }
      } catch {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 4) {
          toast({
            title: '支付状态暂不可达',
            description: '已暂停轮询，请稍后重试或刷新页面恢复支付状态。',
            variant: 'destructive',
          });
          consecutiveFailures = 0;
        }
      }
    }, 3000);

    timeoutRef.current = window.setTimeout(() => {
      clearPolling();
      localStorage.removeItem('payment.pending.order');
      toast({
        title: '支付订单已过期',
        description: '本地保存的待支付订单已超时清理。',
      });
    }, 15 * 60 * 1000);
  };

  const handleCreateOrder = async () => {
    setLoading(true);
    const amount = selectedPlan.id === 'custom' ? customAmount : selectedPlan.price;
    // Price validation: ensure amount matches plan pricing
    const validPrices: Record<string, number> = {
      'basic-monthly': 20,
      'pro-quarterly': 55,
      'vip-yearly': 200,
    };
    if (selectedPlan.id !== 'custom' && amount !== validPrices[selectedPlan.id]) {
      toast({
        title: '价格校验失败',
        description: '订单金额与所选方案不匹配，请刷新页面重试。',
        variant: 'destructive',
      });
      return;
    }
    // Custom amount validation: min ¥10, max ¥10000
    if (selectedPlan.id === 'custom' && (amount < 10 || amount > 10000)) {
      toast({
        title: '金额范围无效',
        description: '自定义金额必须在 ¥10 至 ¥10000 之间。',
        variant: 'destructive',
      });
      return;
    }
    try {
      const order = await api.post<Order>('/payment/create', { planId: selectedPlan.id, amount, paymentMethod }, {
        headers: { 'Idempotency-Key': uuidv4() },
        skipCsrf: false,
      });
      if (!isValidOrder(order)) {
        throw new Error('支付服务返回了无效的订单数据');
      }
      setPendingOrder(order);
      localStorage.setItem('payment.pending.order', JSON.stringify(order));
      startPolling(order.orderId);
      if (isMobile) setStep(3);
    } catch (err: any) {
      toast({
        title: '创建订单失败',
        description: err?.message || '当前后端未响应，已可切换为开发模拟模式。',
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
          <p className="text-zinc-400 font-bold italic leading-relaxed mb-10">感谢您的支持，宣传位已立即生效。</p>
          <button onClick={() => { setPendingOrder(null); window.location.hash = '#/dashboard'; }} className="w-full py-5 btn-accent text-white rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.5em] shadow-2xl italic">返回中心</button>
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
          
          <div className="bg-white p-6 rounded-[2.5rem] mb-8 inline-block border border-zinc-100 shadow-sm">
             <img
               src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pendingOrder.paymentUrl)}`}
               alt="QR Code"
               onError={(event) => {
                 const target = event.currentTarget;
                 target.onerror = null;
                 target.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${pendingOrder.paymentUrl}&fallback=1`)}`;
               }}
             />
          </div>

          <h2 className="text-3xl font-black tracking-tighter uppercase italic mb-3">
            {paymentMeta.label}
          </h2>
          <p className={`text-zinc-400 font-bold italic leading-relaxed mb-2 ${paymentMeta.accentClass}`}>{paymentMeta.short}</p>
          <p className="text-zinc-400 font-bold italic leading-relaxed mb-8">请扫描二维码完成 ¥{pendingOrder.amount} 的订单支付</p>
          
          <button 
            onClick={() => { setPendingOrder(null); localStorage.removeItem('payment.pending.order'); clearPolling(); if(isMobile) setStep(1); window.location.hash = '#/dashboard'; }}
            className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 hover:text-accent transition-colors italic"
          >
            取消订单并返回
          </button>
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
            {step > 1 && <button onClick={() => setStep(step - 1)} className="w-10 h-10 rounded-xl border border-zinc-100 flex items-center justify-center hover:bg-zinc-50 transition-colors"><ChevronLeft className="w-5 h-5" /></button>}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">PAYMENT_FLOW</div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase italic">{flowSteps[step - 1]}</h1>
            </div>
            <div className="ml-auto px-4 py-2 rounded-full border border-zinc-100 text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-400">STEP {step}/3</div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto w-full px-6 py-10 flex-grow">
          {step === 1 ? (
            <div className="grid grid-cols-1 gap-6">
              {PLANS.map(plan => (
                <div 
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`relative p-8 rounded-[3rem] border transition-all cursor-pointer shadow-xs overflow-hidden ${
                    selectedPlan.id === plan.id ? 'border-accent bg-accent-subtle' : 'border-zinc-50 bg-zinc-50/30 hover:bg-white hover:border-accent'
                  }`}
                >
                  <div className="absolute top-6 right-6 text-[9px] font-black text-zinc-200 uppercase tracking-widest italic">/ {plan.period}</div>
                  <div className="flex items-start justify-between gap-8">
                    <div className="space-y-3 max-w-lg">
                      <h3 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter leading-none">{plan.name}</h3>
                      <p className="text-zinc-400 font-bold italic leading-relaxed">{plan.desc}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black tracking-tighter italic text-black">¥{plan.price || customAmount}</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic mt-2">{selectedPlan.id === plan.id ? '已选择' : '点击选择'}</div>
                    </div>
                  </div>
                  {plan.id === 'custom' && selectedPlan.id === 'custom' && (
                    <div className="mt-8 p-6 rounded-[2rem] border border-zinc-100 bg-white/80">
                      <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic block mb-3">自定义金额</label>
                      <input 
                        type="number" 
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
               <div 
                onClick={() => setPaymentMethod('wechat')}
                className={`p-8 rounded-[3rem] border transition-all cursor-pointer shadow-xs ${paymentMethod === 'wechat' ? 'border-accent bg-accent-subtle' : 'border-zinc-50 bg-zinc-50/30 hover:bg-white hover:border-accent'}`}
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-white rounded-[1.5rem] border border-zinc-100 flex items-center justify-center text-green-500 shadow-sm"><QrCode className="w-7 h-7" /></div>
                  <div>
                    <div className="text-2xl font-black uppercase italic tracking-tighter">微信支付</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic mt-1">WECHAT PAY</div>
                  </div>
                </div>
              </div>
              <div 
                onClick={() => setPaymentMethod('alipay')}
                className={`p-8 rounded-[3rem] border transition-all cursor-pointer shadow-xs ${paymentMethod === 'alipay' ? 'border-accent bg-accent-subtle' : 'border-zinc-50 bg-zinc-50/30 hover:bg-white hover:border-accent'}`}
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-white rounded-[1.5rem] border border-zinc-100 flex items-center justify-center text-blue-500 shadow-sm"><CreditCard className="w-7 h-7" /></div>
                  <div>
                    <div className="text-2xl font-black uppercase italic tracking-tighter">支付宝</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic mt-1">ALIPAY</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-50 bg-white sticky bottom-0">
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between gap-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">总计费用</div>
              <div className="text-3xl font-black tracking-tighter italic">¥{selectedPlan.id === 'custom' ? customAmount : selectedPlan.price}</div>
            </div>
            <button 
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
         <h1 className="text-5xl font-black tracking-tight mb-4">选择宣传方案</h1>
         <p className="text-muted-foreground text-lg max-w-xl">提升您的服务器曝光率，吸引更多玩家。选择最适合您的推广策略。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {PLANS.map((plan) => (
          <div 
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            className={`cursor-pointer p-8 rounded-[2rem] border-2 transition-all flex flex-col group ${
              selectedPlan.id === plan.id ? 'border-brand bg-brand/5 ring-8 ring-brand/5 scale-105' : 'border-border hover:border-brand/30'
            }`}
          >
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-black">¥{plan.price || customAmount}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{plan.period}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{plan.desc}</p>
            <div className={`mt-auto py-2 px-4 rounded-xl text-center text-xs font-bold uppercase tracking-widest ${
               selectedPlan.id === plan.id ? 'bg-brand text-white' : 'bg-muted text-muted-foreground group-hover:bg-brand/10 group-hover:text-brand'
            }`}>
              {selectedPlan.id === plan.id ? '已选择' : '点击选择'}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-stretch">
         <div className="flex-grow p-10 bg-card border border-border rounded-[2.5rem]">
            <h3 className="text-xl font-bold mb-6">支付设置</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase text-muted-foreground">支付方式</label>
                 <div className="flex gap-4">
                    <button onClick={() => setPaymentMethod('wechat')} className={`flex-grow py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === 'wechat' ? 'border-brand bg-brand/5 text-brand' : 'border-border hover:border-brand/20'}`}>
                       <QrCode className="w-4 h-4" /> 微信支付
                    </button>
                    <button onClick={() => setPaymentMethod('alipay')} className={`flex-grow py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === 'alipay' ? 'border-brand bg-brand/5 text-brand' : 'border-border hover:border-brand/20'}`}>
                       <CreditCard className="w-4 h-4" /> 支付宝
                    </button>
                 </div>
               </div>
               {selectedPlan.id === 'custom' && (
                 <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
                    <label className="text-xs font-bold uppercase text-muted-foreground">自定义金额 (¥)</label>
                    <input 
                      type="number" 
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
                  <span className="text-5xl font-black">¥{selectedPlan.id === 'custom' ? customAmount : selectedPlan.price}</span>
               </div>
               <button 
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
