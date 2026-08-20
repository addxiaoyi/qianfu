import React from 'react';
import { motion } from 'framer-motion';
import { XCircle, RefreshCw, MessageSquare, ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '@/store/uiStore';
import GeometricLantern from '@/components/ui/GeometricLantern';

const PaymentFail: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-8 selection:bg-accent selection:text-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 p-24 opacity-[0.02] pointer-events-none">
         <GeometricLantern variant="alert" className="w-96 h-96 -rotate-12" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border border-red-100 rounded-[3rem] p-12 text-center shadow-2xl shadow-red-500/5 relative z-10"
      >
        <div className="mb-8 text-[10px] font-black uppercase tracking-[0.45em] italic text-red-500">PAYMENT_RETRY_REQUIRED</div>
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12, delay: 0.2 }}
          className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-red-500/30 border-8 border-white"
        >
          <XCircle className="w-12 h-12 text-white" />
        </motion.div>

        <h1 className="text-4xl font-black mb-4 italic uppercase tracking-tighter text-red-500 leading-none">{t('payment.fail.title')}.</h1>
        <p className="text-zinc-400 font-bold italic mb-12 leading-relaxed px-4">
          {t('payment.fail.desc')}
        </p>

        <div className="space-y-4">
          <button type="button" 
            onClick={() => navigate('/payment')}
            className="w-full py-6 btn-accent rounded-2xl font-black text-[12px] uppercase tracking-[0.4em] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-accent/20 italic"
          >
            {t('payment.fail.retry')} <RefreshCw className="w-5 h-5" />
          </button>
          <Link 
            to="/tickets/new" 
            className="w-full py-6 bg-zinc-50 border border-zinc-100 text-zinc-500 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-black hover:text-white hover:border-black transition-all duration-700 italic"
          >
            {t('payment.fail.support')} <MessageSquare className="w-5 h-5" />
          </Link>
        </div>

        <button type="button" 
          onClick={() => navigate(-1)}
          className="mt-12 text-[10px] font-black text-zinc-300 hover:text-accent flex items-center justify-center gap-3 mx-auto transition-all uppercase tracking-widest italic"
        >
          <ChevronLeft className="w-4 h-4" /> {t('payment.fail.back')}
        </button>
      </motion.div>

      {/* Decorative Blur */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-500/5 blur-[120px] rounded-full translate-y-1/2 translate-x-1/2 pointer-events-none" />
    </div>
  );
};

export default PaymentFail;
