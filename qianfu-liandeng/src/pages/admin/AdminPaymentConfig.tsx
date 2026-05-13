import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';

const AdminPaymentConfig: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const handleTestConnection = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    toast({ title: 'GATEWAY SYNCHRONIZED', description: 'Financial handshake successful across all 3 active nodes.' });
  };

  return (
    <div className="space-y-16 pb-32 bg-white">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-16">
        <div className="space-y-6">
           <div className="flex items-center gap-4">
              <div className="px-4 py-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-sm shadow-2xl shadow-accent/20 italic">Treasury Protocol / Alpha-Zero</div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)] animate-pulse" />
                 <span className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-zinc-300 italic">Settlement: Real-time Flux</span>
              </div>
           </div>
           <h1 className="text-8xl font-black tracking-tighter uppercase leading-[0.85] italic text-accent">Vault.</h1>
           <p className="text-zinc-400 font-bold text-lg max-w-xl italic border-l-2 border-zinc-100 pl-8">配置支付网关参数、结算逻辑与财务安全审计策略。确保资金流动链路的绝对合规与原子化安全校验。</p>
        </div>
        <button onClick={handleTestConnection} disabled={loading} className="group px-12 py-7 btn-accent rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all duration-500 shadow-2xl shadow-accent/20 flex items-center gap-6 italic disabled:opacity-50 active:scale-[0.98]">
           <GeometricLantern variant="security" className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" /> RUN_SECURITY_HANDSHAKE
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5 space-y-10">
           <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-16 border border-zinc-50 rounded-[5rem] bg-white space-y-16 group hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 shadow-xs relative overflow-hidden">
              <div className="absolute -bottom-8 -right-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-1000 pointer-events-none rotate-12"><GeometricLantern variant="payment" className="w-64 h-64" /></div>
              <div className="flex items-center justify-between relative z-10">
                 <div className="space-y-2">
                    <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none">Nodes.</h3>
                    <p className="text-[11px] font-black font-mono text-zinc-300 uppercase tracking-[0.4em] italic border-l-2 border-zinc-50 pl-4">Live Gateway Telemetry</p>
                 </div>
                 <div className="w-16 h-16 bg-zinc-50 rounded-[2rem] flex items-center justify-center text-zinc-200 group-hover:bg-accent group-hover:text-white group-hover:rotate-12 transition-all duration-700 shadow-xs"><GeometricLantern variant="activity" className="w-8 h-8" /></div>
              </div>
              <div className="space-y-6 relative z-10">
                 {[
                   { name: 'ALIPAY CORE PROTOCOL', status: 'SYNCHRONIZED', latency: '24ms', color: 'text-blue-500' },
                   { name: 'WECHAT PAYSET V3', status: 'SYNCHRONIZED', latency: '31ms', color: 'text-green-500' },
                   { name: 'QUICKPASS SETTLEMENT', status: 'ACTIVE', latency: '18ms', color: 'text-orange-500' },
                 ].map((gate) => (
                   <div key={gate.name} className="flex items-center justify-between group/gate p-6 rounded-[2rem] hover:bg-zinc-50 transition-colors duration-500 border border-transparent hover:border-zinc-100">
                      <div className="flex items-center gap-6">
                         <div className="w-14 h-14 rounded-[1.5rem] bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover/gate:bg-accent group-hover/gate:text-white transition-all duration-700 shadow-xs border border-zinc-100/50 group-hover/gate:rotate-6">
                            <GeometricLantern variant="payment" className="w-6 h-6 group-hover/gate:text-white transition-colors" />
                         </div>
                         <div className="space-y-1">
                            <div className="text-[11px] font-black uppercase tracking-[0.15em] italic">{gate.name}</div>
                            <div className="text-[10px] font-black font-mono text-zinc-300 uppercase tracking-[0.3em] italic">{gate.latency} / HANDSHAKE</div>
                         </div>
                      </div>
                      <div className="px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-sm text-[10px] font-black font-mono italic text-accent group-hover/gate:bg-accent group-hover/gate:text-white group-hover/gate:border-accent transition-all duration-500 uppercase tracking-[0.3em] shadow-xs">{gate.status}</div>
                   </div>
                 ))}
              </div>
           </motion.div>

           <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="p-20 bg-accent text-white rounded-[5rem] space-y-16 shadow-accent relative overflow-hidden group">
              <div className="absolute -right-16 -top-16 opacity-5 group-hover:opacity-15 group-hover:scale-110 transition-all duration-1000 pointer-events-none rotate-12"><GeometricLantern variant="spark" className="w-96 h-96" /></div>
              <div className="space-y-8 relative z-10">
                 <div className="flex items-center justify-between">
                    <div className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-500 italic">Financial Throughput / Monthly Epoch</div>
                    <div className="px-4 py-2 bg-accent-medium/30 rounded-full border border-white/20 text-[9px] font-black uppercase tracking-widest text-white/60 italic">LIVE</div>
                 </div>
                 <div className="flex items-baseline gap-4">
                    <div className="text-3xl font-black font-mono text-zinc-500 leading-none">¥</div>
                    <div className="text-7xl font-black font-mono tracking-tighter italic leading-none group-hover:translate-x-4 transition-transform duration-700">142,901<span className="text-zinc-600">.50</span></div>
                 </div>
                 <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.3em] bg-white/10 w-fit px-6 py-3 rounded-full border border-white/20 shadow-inner">
                    <GeometricLantern variant="activity" className="w-5 h-5 text-green-400 rotate-45" />
                    <span className="text-green-400 italic">+24.8%</span>
                    <span className="text-white/60">SINCE LAST EPOCH</span>
                 </div>
              </div>
              <div className="pt-12 border-t border-white/20 space-y-8 relative z-10">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.4em] italic">
                    <span className="text-white/60">Next Settlement Flux</span>
                    <span className="text-white">MAY 12 / 00:00 UTC</span>
                 </div>
                 <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
                    <motion.div initial={{ width: 0 }} animate={{ width: '75%' }} transition={{ duration: 2.5, ease: [0.22, 1, 0.36, 1] }} className="h-full bg-white" />
                 </div>
                 <div className="flex items-center gap-4 text-[9px] font-black text-white/60 uppercase tracking-widest italic"><GeometricLantern variant="activity" className="w-3.5 h-3.5" /> 75% settlement complete</div>
              </div>
           </motion.div>
        </div>

        <div className="lg:col-span-7 space-y-12">
           <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-20 border border-zinc-50 rounded-[5rem] bg-white space-y-20 shadow-xs group hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 opacity-[0.02] group-hover:opacity-[0.05] group-hover:scale-110 transition-all duration-1000 pointer-events-none"><GeometricLantern variant="settings" className="w-[24rem] h-[24rem] rotate-45" /></div>
              <div className="flex items-center gap-8 relative z-10">
                 <div className="w-24 h-24 bg-zinc-50 rounded-[3rem] flex items-center justify-center text-zinc-300 group-hover:bg-accent group-hover:text-white group-hover:rotate-12 transition-all duration-700 shadow-xs"><GeometricLantern variant="settings" className="w-12 h-12" /></div>
                 <div className="space-y-2">
                    <h3 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Configuration.</h3>
                    <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic border-l-2 border-zinc-100 pl-4">Endpoint identification and cryptographic primitives</p>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                 <div className="space-y-5">
                    <label className="text-[11px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">Merchant Application ID</label>
                    <div className="relative group/input">
                       <input type="text" className="w-full pl-8 pr-16 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[2.5rem] text-lg font-black font-mono outline-hidden transition-all duration-500 shadow-xs uppercase italic tracking-tight" defaultValue="QFU_TREASURY_001_LX" />
                       <GeometricLantern variant="spark" className="absolute right-8 top-1/2 -translate-y-1/2 w-6 h-6 text-green-500 opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-500" />
                    </div>
                 </div>
                 <div className="space-y-5">
                    <label className="text-[11px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">Gateway Protocol Node</label>
                    <div className="relative group/input">
                       <select className="w-full pl-8 pr-16 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.15em] outline-hidden transition-all duration-500 shadow-xs appearance-none italic">
                          <option>ALIPAY F2F NATIVE PROTOCOL</option>
                          <option>WECHAT PAY V3 GLOBAL FLUX</option>
                          <option>STRIPE NODE (ALPHA TESTNET)</option>
                       </select>
                       <ChevronRight className="absolute right-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-300 pointer-events-none rotate-90" />
                    </div>
                 </div>
                 <div className="md:col-span-2 space-y-5">
                    <div className="flex items-center justify-between">
                       <label className="text-[11px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">RSA2 Private Signing Key (2048-BIT)</label>
                       <div className="flex items-center gap-3 px-5 py-2 bg-green-50 rounded-full border border-green-100">
                          <GeometricLantern variant="security" className="w-4 h-4 text-green-500" />
                          <span className="text-[10px] font-black text-green-600 uppercase tracking-widest italic">AES-256-GCM ENCRYPTED</span>
                       </div>
                    </div>
                    <div className="relative">
                       <textarea
                          className="w-full h-52 pl-10 pr-28 py-8 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[2.5rem] text-lg font-mono font-medium resize-none outline-hidden transition-all duration-500 shadow-xs leading-relaxed"
                          readOnly
                          value={keyVisible ? 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...' : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                       />
                       <button
                          type="button"
                          onClick={() => setKeyVisible(!keyVisible)}
                          className="absolute right-6 top-6 flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-all duration-300"
                       >
                          {keyVisible ? (
                             <><EyeOff className="w-4 h-4 text-zinc-500" /><span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider italic">Hide</span></>
                          ) : (
                             <><Eye className="w-4 h-4 text-zinc-500" /><span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider italic">Reveal</span></>
                          )}
                       </button>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black text-zinc-300 uppercase tracking-[0.4em] italic px-4"><GeometricLantern variant="terminal" className="w-4 h-4 animate-pulse" /> System automatically rotates ephemeral keys every 24 hours</div>
                 </div>
              </div>
              <div className="flex justify-end pt-12 border-t border-zinc-50 relative z-10">
                 <button className="group px-20 py-8 btn-accent text-white rounded-[3rem] text-[12px] font-black uppercase tracking-[0.6em] transition-all duration-500 shadow-accent flex items-center gap-6 italic active:scale-[0.98]">
                    COMMIT_AND_DEPLOY <ChevronRight className="w-6 h-6 group-hover:translate-x-4 transition-transform duration-500" />
                 </button>
              </div>
           </motion.div>

           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-20 border border-zinc-50 bg-zinc-50/30 rounded-[5rem] space-y-16 group hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 shadow-xs relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 opacity-[0.03] group-hover:opacity-[0.06] group-hover:scale-110 transition-all duration-1000 pointer-events-none rotate-12"><GeometricLantern variant="security" className="w-64 h-64" /></div>
              <div className="flex items-center gap-8 relative z-10">
                 <div className="w-20 h-20 bg-accent text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-accent/20 group-hover:rotate-[360deg] transition-all duration-1000"><GeometricLantern variant="security" className="w-10 h-10" /></div>
                 <div className="space-y-2">
                    <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none">Risk Hardening.</h3>
                    <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.4em] italic border-l-2 border-zinc-200 pl-4">Global Financial Velocity & Anti-Fraud Thresholds</p>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 relative z-10">
                 {[
                   { label: 'ENFORCE_TRANSACTION_LIMIT (¥5K)', value: true, desc: '自动拦截超出预设限额的单笔结算请求' },
                   { label: 'AUTO_REJECT_ANOMALOUS_VELOCITY', value: true, desc: '利用 AI 识别短时间内高频异常交易模式' },
                   { label: 'IP_GEOFENCING (MAINLAND_CHINA)', value: false, desc: '仅允许来自中国大陆地区的 IP 地址进行支付交互' },
                   { label: 'REALTIME_LEDGER_RECONCILIATION', value: true, desc: '每笔交易完成后立即执行双向账目对账' },
                 ].map(rule => (
                   <div key={rule.label} className="flex items-center justify-between group/rule p-8 rounded-[2.5rem] bg-white hover:shadow-xl hover:shadow-black/5 transition-all duration-700 border border-transparent hover:border-zinc-100">
                      <div className="space-y-2 max-w-[220px]">
                         <span className="text-[11px] font-black text-zinc-400 group-hover/rule:text-black transition-colors tracking-[0.2em] uppercase italic">{rule.label}</span>
                         <p className="text-[10px] font-bold text-zinc-300 uppercase italic tracking-widest leading-snug">{rule.desc}</p>
                      </div>
                      <div className={`w-20 h-10 rounded-full p-1.5 cursor-pointer transition-all duration-700 shadow-inner ${rule.value ? 'bg-accent' : 'bg-zinc-200'}`}>
                         <div className={`w-7 h-7 bg-white rounded-full transition-all duration-700 shadow-sm ${rule.value ? 'translate-x-10' : 'translate-x-0'}`} />
                      </div>
                   </div>
                 ))}
              </div>
           </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminPaymentConfig;
