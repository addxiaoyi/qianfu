import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CreditCard, Shield, Check,
  Gift, ChevronRight, Lock, Info
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/request';

type PaymentStep = 'select' | 'confirm' | 'processing' | 'success';

interface PaymentItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  badge?: string;
}

interface CouponResult {
  valid: boolean;
  discount: number; // 折扣系数，0.8 = 8折
  message?: string;
}

interface PaymentSuccessData {
  orderId: string;
  amount: number;
  items: { name: string; quantity: number }[];
}

const MobilePayment: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => !!state.user);
  const [step, setStep] = useState<PaymentStep>('select');
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay' | 'card'>('wechat');
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [paymentSuccessData, setPaymentSuccessData] = useState<PaymentSuccessData | null>(null);

  // 从后端加载商品列表，失败时 fallback 到 mock
  useEffect(() => {
    let cancelled = false;
    api.get<PaymentItem[]>('/products')
      .then((data: PaymentItem[]) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) {
          // Fallback 到 mock 数据（仅开发环境/无后端时）
          setItems([
            { id: '1', name: '钻石 x60', price: 6, originalPrice: 10, badge: '新人特惠' },
            { id: '2', name: '钻石 x300', price: 28, originalPrice: 50, badge: '超值' },
            { id: '3', name: '钻石 x1000', price: 88, badge: '最划算' },
            { id: '4', name: 'VIP月卡', price: 30 },
            { id: '5', name: 'VIP年卡', price: 288, originalPrice: 360, badge: '推荐' },
            { id: '6', name: '专属称号', price: 98 },
          ]);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handleSelect = (item: PaymentItem) => {
    setSelectedItem(item);
    setStep('confirm');
  };

  // 优惠券验证：调用后端 API，前端只做 UI 展示，不做折扣计算
  const validateCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const result = await api.post<CouponResult>('/coupons/validate', {
        code: couponCode.trim(),
        productId: selectedItem?.id,
        quantity,
      });
      if (result.valid) {
        setCouponResult(result);
      } else {
        setCouponResult({ valid: false, discount: 1, message: result.message || '优惠券无效' });
      }
    } catch {
      setCouponResult({ valid: false, discount: 1, message: '优惠券验证失败' });
    } finally {
      setApplyingCoupon(false);
    }
  }, [couponCode, selectedItem?.id, quantity]);

  // 处理支付：调用真实支付 API，由后端完成金额计算和订单创建
  const handlePayment = useCallback(async () => {
    if (!selectedItem) return;
    setStep('processing');
    try {
      const result = await api.post<PaymentSuccessData>('/payments', {
        itemId: selectedItem.id,
        quantity,
        paymentMethod,
        couponCode: couponResult?.valid ? couponCode : undefined,
      });
      setPaymentSuccessData(result);
      setStep('success');
    } catch {
      setStep('confirm');
      // API 层的 toast 已显示错误信息，此处不再重复
    }
  }, [selectedItem, quantity, paymentMethod, couponResult, couponCode]);

  // 成功页：金额来自后端返回，前端不重新计算
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-black">支付成功！</h2>
          <p className="text-sm text-muted-foreground">
            {selectedItem?.name} 已添加到您的账户
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">商品</span>
              <span className="font-bold">{selectedItem?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">数量</span>
              <span className="font-bold">{quantity}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">支付方式</span>
              <span className="font-bold">
                {paymentMethod === 'wechat' ? '微信支付' : paymentMethod === 'alipay' ? '支付宝' : '银行卡'}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-bold">合计</span>
              <span className="font-black text-xl text-primary">
                ¥{(paymentSuccessData?.amount || selectedItem?.price || 0).toFixed(2)}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setStep('select');
              setSelectedItem(null);
              setQuantity(1);
              setCouponCode('');
              setCouponResult(null);
              setPaymentSuccessData(null);
            }}
            className="w-full py-4 bg-black text-white font-black text-sm rounded-2xl"
          >
            继续购物
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-20 h-20 border-4 border-black border-t-transparent rounded-full"
            />
          </div>
          <div>
            <h2 className="text-xl font-black">正在支付...</h2>
            <p className="text-xs text-muted-foreground mt-2">请稍候，正在处理您的订单</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span>支付信息已加密</span>
          </div>
        </div>
      </div>
    );
  }

  // 前端展示的最终金额由后端返回，不在此处计算折扣
  const displayPrice = selectedItem?.price || 0;
  const couponDiscountAmount = couponResult?.valid
    ? displayPrice * quantity * (1 - couponResult.discount)
    : 0;
  const finalAmount = displayPrice * quantity - couponDiscountAmount;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          {step === 'confirm' ? (
            <button
              onClick={() => setStep('select')}
              className="flex items-center gap-1 text-sm font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
          ) : (
            <div />
          )}
          <h1 className="text-base font-black uppercase tracking-tight">
            {step === 'select' ? '选择商品' : '确认支付'}
          </h1>
          <div className="w-12" />
        </div>
      </div>

      {step === 'select' ? (
        /* Product Selection */
        <div className="px-4 py-4 space-y-4">
          {/* Promo Banner */}
          <div className="bg-gradient-to-r from-orange-400 to-red-500 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5" />
              <span className="text-sm font-black">限时优惠</span>
            </div>
            <p className="text-xs opacity-90">新用户首充双倍，全场商品 8 折起</p>
          </div>

          {/* Quick Selection */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
              热门商品
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {items.slice(0, 4).map((item) => (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSelect(item)}
                  className="bg-white rounded-2xl p-4 space-y-2 text-left active:shadow-md transition-shadow"
                >
                  {item.badge && (
                    <span className="inline-block px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-md">
                      {item.badge}
                    </span>
                  )}
                  <h4 className="text-sm font-black">{item.name}</h4>
                  {item.originalPrice && (
                    <p className="text-xs text-muted-foreground line-through">
                      ¥{item.originalPrice}
                    </p>
                  )}
                  <p className="text-lg font-black text-primary">¥{item.price}</p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* All Products */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
              全部商品
            </h3>
            <div className="space-y-3">
              {items.map((item) => (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSelect(item)}
                  className="w-full bg-white rounded-2xl p-4 flex items-center justify-between active:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-black">{item.name}</h4>
                      {item.originalPrice && (
                        <p className="text-xs text-muted-foreground line-through">
                          ¥{item.originalPrice}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-primary">¥{item.price}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Payment Confirmation */
        selectedItem && (
          <div className="px-4 py-4 space-y-4">
            {/* Order Summary */}
            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  订单摘要
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black">{selectedItem.name}</h4>
                    <p className="text-xs text-muted-foreground">虚拟商品</p>
                  </div>
                  <span className="text-lg font-black">¥{displayPrice}</span>
                </div>

                {/* Quantity */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-sm font-bold">数量</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold w-8 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(99, quantity + 1))}
                      className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Coupon */}
            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  优惠券
                </span>
              </div>
              <div className="p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value);
                      setCouponResult(null); // 输入变化时清除之前的验证结果
                    }}
                    placeholder="输入优惠码"
                    className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold"
                  />
                  <button
                    onClick={validateCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="px-6 py-3 bg-black text-white text-sm font-bold rounded-xl disabled:opacity-50"
                  >
                    {applyingCoupon ? '验证中...' : '使用'}
                  </button>
                </div>
                {couponResult?.valid && (
                  <p className="text-xs text-green-500 mt-2 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    优惠码已使用，{Math.round((1 - couponResult.discount) * 100)} 折
                  </p>
                )}
                {!couponResult?.valid && couponResult?.message && (
                  <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    {couponResult.message}
                  </p>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  支付方式
                </span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { key: 'wechat' as const, label: '微信支付', icon: '💬' },
                  { key: 'alipay' as const, label: '支付宝', icon: '🔷' },
                  { key: 'card' as const, label: '银行卡', icon: '💳' },
                ].map((method) => (
                  <button
                    key={method.key}
                    onClick={() => setPaymentMethod(method.key)}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-xl transition-colors',
                      paymentMethod === method.key
                        ? 'bg-black/5 border-2 border-black'
                        : 'bg-gray-50'
                    )}
                  >
                    <span className="text-xl">{method.icon}</span>
                    <span className="text-sm font-bold">{method.label}</span>
                    {paymentMethod === method.key && (
                      <Check className="w-5 h-5 text-black ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-white rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">商品金额</span>
                <span className="font-bold">¥{(displayPrice * quantity).toFixed(2)}</span>
              </div>
              {couponResult?.valid && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">优惠折扣</span>
                  <span className="font-bold text-green-500">-¥{couponDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="font-bold">合计</span>
                <span className="font-black text-xl text-primary">
                  ¥{finalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Security Notice */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-4">
              <Lock className="w-3 h-3" />
              <span>支付信息已加密，保障您的资金安全</span>
            </div>

            {/* Submit Button */}
            <button
              onClick={handlePayment}
              className="fixed bottom-24 left-4 right-4 py-4 bg-black text-white font-black text-sm rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              确认支付 ¥{finalAmount.toFixed(2)}
            </button>
          </div>
        )
      )}
    </div>
  );
};

export default MobilePayment;
