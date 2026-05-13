import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, LayoutDashboard, History } from 'lucide-react';
import { Link } from 'react-router-dom';

const PaymentSuccess: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card border border-border rounded-2xl p-12 text-center shadow-sm relative overflow-hidden"
      >
        <div className="mb-8 text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">PAYMENT_CONFIRMED</div>
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
          className="w-20 h-20 bg-brand text-white rounded-xl flex items-center justify-center mx-auto mb-10 shadow-lg"
        >
          <CheckCircle2 className="w-10 h-10" />
        </motion.div>

        <h1 className="text-4xl font-black mb-4">支付成功!</h1>
        <p className="text-muted-foreground font-medium mb-12 leading-relaxed">
          您的订单已处理完成。相应的余额或推广点数已实时发放到您的账户中。
        </p>

        <div className="space-y-4">
          <Link 
            to="/dashboard" 
            className="w-full py-5 bg-brand text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand/20"
          >
            返回个人中心 <LayoutDashboard className="w-5 h-5" />
          </Link>
          <Link 
            to="/dashboard/billing" 
            className="w-full py-5 bg-muted text-foreground rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-muted/80 transition-all"
          >
            查看账单明细 <History className="w-5 h-5" />
          </Link>
        </div>

        <p className="mt-12 text-xs text-muted-foreground font-bold uppercase tracking-widest flex items-center justify-center gap-2">
           遇到问题? <Link to="/tickets/new" className="text-brand hover:underline">联系技术支持</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
