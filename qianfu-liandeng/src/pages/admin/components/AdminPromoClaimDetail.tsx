import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { promoActionLabels } from '../promoActionLabels';
import { promoFieldLabels } from '../promoFieldLabels';
import { promoUi } from '../promoUi';

interface Props {
  claim: any;
  index: number;
  total: number;
  remark: string;
  setRemark: (value: string) => void;
  remarkProfile: 'pass' | 'reject';
  setRemarkProfile: (value: 'pass' | 'reject') => void;
  remarkPresets: Record<'pass' | 'reject', readonly string[]>;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

const AdminPromoClaimDetail: React.FC<Props> = ({ claim, index, total, remark, setRemark, remarkProfile, setRemarkProfile, remarkPresets, onPrevious, onNext, onClose, onApprove, onReject }) => {
  const renderField = (label: string, value: any) => (
    <div className={`${promoUi.softCard} p-4 border border-zinc-100`}>
      <div className={promoUi.headingKicker + ' mb-2'}>{label}</div>
      <div className="font-mono break-all">{value ?? '--'}</div>
    </div>
  );

  return (
    <div className={`relative w-full max-w-4xl ${promoUi.sectionCard} p-12 space-y-8`}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className={promoUi.headingKicker}>CLAIM DETAIL</div>
          <h3 className="text-3xl font-black uppercase italic tracking-tighter mt-2">{claim.task?.title || `Task #${claim.task_id}`}</h3>
          <div className="mt-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.35em] italic text-zinc-400">
            <span className={`${promoUi.chip} bg-zinc-50 border-zinc-100`}>{index + 1} / {total}</span>
            <span className={`${promoUi.chip} bg-amber-50 border-amber-200 text-amber-700`}>{claim.claim_status}</span>
            <span className={`${promoUi.chip} bg-blue-50 border-blue-100 text-blue-700`}>{claim.reward_status}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-300 hover:text-accent">Close</button>
      </div>

      <div className={`${promoUi.softCard} p-6 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className={promoUi.headingKicker}>审核备注</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setRemarkProfile('pass')} className={`px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.25em] italic ${remarkProfile === 'pass' ? 'bg-accent text-white border-accent' : 'bg-white border-zinc-200'}`}>Pass Set</button>
            <button onClick={() => setRemarkProfile('reject')} className={`px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.25em] italic ${remarkProfile === 'reject' ? 'bg-rose-500 text-white border-rose-500' : 'bg-white border-zinc-200'}`}>Reject Set</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">{remarkPresets[remarkProfile].map((q) => <button key={q} onClick={() => setRemark(q)} className="px-3 py-2 rounded-full bg-white border border-zinc-200 text-[10px] font-black uppercase tracking-[0.25em] italic hover:border-accent transition-all">{q}</button>)}</div>
        <textarea required value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="请输入审核备注，或点击快捷短语自动填充" className="w-full min-h-28 px-5 py-4 rounded-[1.25rem] border border-zinc-200 bg-white outline-none focus:border-accent text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${promoUi.softCard} p-6`}><div className={promoUi.headingKicker + ' mb-3'}>Task Info</div><div className="space-y-2 text-xs"><div className="font-black uppercase italic">{claim.task?.platform || '--'}</div><div className="font-mono text-zinc-500 break-all">{claim.task?.target_id || '--'}</div><div className="text-zinc-400 font-mono">Reward ¥ {claim.task?.reward_amount ?? 0}</div><div className="text-zinc-400 font-mono">Limit / User {claim.task?.claim_limit_per_user ?? '--'}</div></div></div>
        <div className={`${promoUi.softCard} p-6`}><div className={promoUi.headingKicker + ' mb-3'}>Verify Details</div><div className="space-y-2 text-xs"><div className="font-mono text-zinc-500 break-all">{claim.verify_result || '{}'}</div><div className="font-mono text-zinc-400 break-all">{claim.verify_detail || '{}'}</div></div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${promoUi.softCard} p-6`}><div className={promoUi.headingKicker + ' mb-3'}>Wallet Transactions</div><div className="space-y-3">{(claim.walletTransactions ?? []).length === 0 ? <div className="text-zinc-300 text-[10px] font-black uppercase tracking-[0.4em] italic">No wallet tx.</div> : (claim.walletTransactions ?? []).map((tx: any) => <div key={tx.id} className="p-4 rounded-[1rem] bg-white border border-zinc-100 text-xs space-y-1"><div className="font-black uppercase italic">{tx.change_type}</div><div className="font-mono text-zinc-500">{tx.before_balance} → {tx.after_balance}</div><div className="font-mono text-zinc-400 break-all">{tx.remark}</div></div>)}</div></div>
        <div className={`${promoUi.softCard} p-6`}><div className={promoUi.headingKicker + ' mb-3'}>Verify Logs</div><div className="space-y-3">{(claim.verifyLogs ?? []).length === 0 ? <div className="text-zinc-300 text-[10px] font-black uppercase tracking-[0.4em] italic">No verify logs.</div> : (claim.verifyLogs ?? []).map((log: any) => <div key={log.id} className="p-4 rounded-[1rem] bg-white border border-zinc-100 text-xs space-y-1"><div className="font-black uppercase italic">{log.verify_status}</div><div className="font-mono text-zinc-500 break-all">{log.error_message || log.response_data}</div></div>)}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${promoUi.softCard} p-6`}><div className={promoUi.headingKicker + ' mb-3'}>Review Meta</div><div className="space-y-2 text-xs"><div className="font-black uppercase italic">{promoFieldLabels.reviewer}</div><div className="font-mono text-zinc-500 break-all">{claim.reviewer_name || claim.reviewed_by || '--'}</div><div className="font-black uppercase italic pt-2">{promoFieldLabels.reviewedAt}</div><div className="font-mono text-zinc-500 break-all">{claim.reviewed_at || '--'}</div></div></div>
        <div className={`${promoUi.softCard} p-6`}><div className={promoUi.headingKicker + ' mb-3'}>More Fields</div><div className="space-y-2 text-xs">{renderField(promoFieldLabels.claimAt, claim.claim_at)}{renderField(promoFieldLabels.verifyAt, claim.verify_at)}{renderField(promoFieldLabels.reviewResult, claim.review_result || claim.audit_result)}{renderField(promoFieldLabels.processingTime, claim.processing_time || claim.review_duration)}</div></div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button onClick={onPrevious} className={promoUi.actionBtn + ' flex items-center gap-2'}><ChevronLeft className="w-4 h-4" /> Previous</button>
        <div className="flex items-center gap-3"><button onClick={onClose} className={`${promoUi.actionBtn} px-8 py-4`}>Close</button><button onClick={onNext} className={promoUi.actionBtn + ' flex items-center gap-2'}>Next <ChevronRight className="w-4 h-4" /></button><button onClick={() => onApprove(claim.id)} className={`${promoUi.actionBtnPrimary}`}>{promoActionLabels.approve}</button><button onClick={() => onReject(claim.id)} className="px-5 py-3 rounded-[1rem] bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.3em] italic">{promoActionLabels.reject}</button></div>
      </div>
    </div>
  );
};

export default AdminPromoClaimDetail;
