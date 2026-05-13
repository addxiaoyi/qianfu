import React from 'react';
import { Lock, Database, RefreshCcw, Loader2, AlertTriangle, ChevronRight, ShieldOff } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Skeleton from './Skeleton';

interface StatusWrapperProps {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  isUnauthorized?: boolean;
  isForbidden?: boolean;
  isLocked?: boolean;
  lockedEmail?: string;
  children: React.ReactNode;
  onRetry?: () => void;
  loadingType?: 'spinner' | 'skeleton';
}

const StatusShell = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center min-h-[420px] gap-6 sm:gap-8 text-center px-6">
    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-xl shadow-black/5 border border-white/60 bg-white/90 backdrop-blur-xl">
      {children}
    </div>
    <div className="max-w-md space-y-3 sm:space-y-4">
      <h3 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase italic leading-none text-zinc-900">{title}</h3>
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.28em] italic leading-none">{subtitle}</p>
    </div>
  </div>
);

const StatusWrapper: React.FC<StatusWrapperProps> = ({
  isLoading,
  isError,
  isEmpty,
  isUnauthorized,
  isForbidden,
  isLocked,
  lockedEmail,
  children,
  onRetry,
  loadingType = 'spinner'
}) => {
  if (isUnauthorized) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center min-h-[420px] gap-6 sm:gap-8 px-6"
        >
          {loadingType === 'spinner' ? (
            <div className="flex flex-col items-center gap-5 sm:gap-6 text-center">
              <div className="relative">
                <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-accent animate-spin" />
                <div className="absolute inset-0 w-10 h-10 sm:w-12 sm:h-12 border-2 border-zinc-100 rounded-full" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black font-mono text-zinc-500 uppercase tracking-[0.35em] animate-pulse italic">Loading Workspace</p>
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.28em] italic leading-none">Preparing the latest data view...</p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-6xl space-y-8 sm:space-y-12">
              <div className="space-y-4">
                <Skeleton className="h-16 w-1/4 rounded-sm" />
                <Skeleton className="h-4 w-2/3 rounded-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <Skeleton className="h-48 rounded-[2.5rem]" count={4} />
              </div>
              <Skeleton className="h-96 rounded-[3.5rem]" />
            </div>
          )}
        </motion.div>
      ) : isLocked ? (
        <motion.div key="locked" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center min-h-[420px] gap-6 sm:gap-8 text-center px-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-black text-white rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-lg shadow-black/10">
            <Lock className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="max-w-md space-y-3 sm:space-y-4">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase italic leading-none text-zinc-900">Identity Verification Required</h3>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">
              为了保障您的支付与数据安全，请先完成邮箱验证。验证后即可解锁完整功能。{lockedEmail ? `当前邮箱：${lockedEmail}` : '您的当前会话处于受限模式。'}
            </p>
          </div>
          <Link to={lockedEmail ? `/verify-code?email=${encodeURIComponent(lockedEmail)}` : '/verify-code'} className="w-full sm:w-auto px-6 sm:px-10 py-4 rounded-2xl bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] transition-all shadow-lg shadow-black/10 group flex items-center justify-center gap-3">
            前往验证中心 <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
          </Link>
        </motion.div>
      ) : isForbidden ? (
        <StatusShell title="Access Denied" subtitle="Security Clearance Level Insufficient">
          <ShieldOff className="w-10 h-10 text-red-500" />
        </StatusShell>
      ) : isError ? (
        <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center min-h-[420px] gap-6 sm:gap-8 text-center px-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-50 border border-zinc-100 text-red-500 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-xs">
            <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="max-w-md space-y-3 sm:space-y-4">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase italic leading-none text-zinc-900">Connection Failed</h3>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.28em] italic leading-none">The server returned an unexpected response.</p>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">无法获取数据，请检查网络连接或稍后再试。系统已准备好重新拉取最新状态。</p>
          </div>
          <button onClick={onRetry} className="w-full sm:w-auto px-6 sm:px-10 py-4 rounded-2xl bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all shadow-lg shadow-black/10 group">
            <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" /> Retry
          </button>
        </motion.div>
      ) : isEmpty ? (
        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[360px] gap-6 sm:gap-8 text-center px-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-50 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center text-zinc-200 border border-zinc-100">
            <Database className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="space-y-2 sm:space-y-3 max-w-md">
            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter italic leading-none text-zinc-900">No Data Yet</h3>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.32em] italic leading-5">No active records were found in this workspace.</p>
          </div>
        </motion.div>
      ) : (
        <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'circOut' }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StatusWrapper;
