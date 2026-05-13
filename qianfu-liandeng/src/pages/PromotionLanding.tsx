import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, Globe, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const PromotionLanding: React.FC = () => {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative pt-48 pb-40 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl aspect-square bg-linear-to-b from-zinc-50 to-transparent rounded-full -translate-y-1/2 -z-10" />
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 px-4 py-1.5 border border-border rounded-full text-[10px] font-black uppercase tracking-widest mb-10"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
推广网络已激活
          </motion.div>
          <h1 className="text-7xl md:text-9xl font-black mb-12 tracking-tighter leading-[0.9]">
            增长.<br />
            <span className="text-zinc-300">不设边界。</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-16 font-medium leading-relaxed">
            千服联灯为您提供最精准、最高效的流量引入服务。
            我们的实时竞价系统确保您的服务器在最合适的时间出现在最合适的玩家面前。
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link to="/payment" className="px-12 py-5 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-black/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
              立即开启推广 <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/dashboard/billing" className="px-12 py-5 bg-white border border-border rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-muted transition-all">
              查看财务报表
            </Link>
          </div>
        </div>
      </section>

      {/* Grid Features */}
      <section className="py-40 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
             {[
               { icon: Users, title: '真实玩家', desc: '每日数万名活跃玩家在平台寻找心仪的服务器，确保您的在线人数稳步攀升。' },
               { icon: BarChart3, title: '数据分析', desc: '实时监控点击率与转化数据，帮助您不断优化宣传语与封面图。' },
               { icon: Globe, title: '全渠道投放', desc: '一次投放，全站同步展示。针对移动端与 PC 端进行专门的展示优化。' }
             ].map((item, i) => (
               <div key={i} className="space-y-8 group">
                  <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                     <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xs font-black font-mono uppercase tracking-[0.2em]">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed font-medium text-lg">{item.desc}</p>
               </div>
             ))}
           </div>
        </div>
      </section>

      {/* Conversion Banner */}
      <section className="py-40 px-6 bg-zinc-50 border-y border-border">
         <div className="max-w-5xl mx-auto text-center space-y-12">
            <h2 className="text-5xl font-black tracking-tight">为什么选择这里投放？</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
               {[
                 { title: '弹性预算 (ELASTIC)', desc: '随时开启或暂停推广，灵活控制预算，没有任何隐藏消费。' },
                 { title: '精准排位 (PRIORITY)', desc: '出价越高排名越靠前。在搜索结果中优先展示，拦截海量搜索流量。' },
                 { title: '实时竞价 (RTB)', desc: '完全透明的竞价系统，您可以随时根据市场行情调整出价策略。' },
                 { title: '反作弊引擎 (SECURE)', desc: '独家指纹识别算法，彻底杜绝恶意点击，确保每一分投入都有回报。' }
               ].map((item, i) => (
                 <div key={i} className="p-10 border border-border rounded-3xl bg-white space-y-4 hover:border-black transition-colors">
                    <div className="text-[10px] font-black font-mono uppercase tracking-widest text-muted-foreground">{item.title}</div>
                    <p className="text-sm font-bold leading-relaxed">{item.desc}</p>
                 </div>
               ))}
            </div>
            
            <div className="pt-12">
               <div className="inline-block p-1 bg-white border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex flex-col md:flex-row items-center gap-12 px-12 py-10">
                     <div className="text-left">
                        <div className="text-4xl font-black font-mono">¥ 10.00 <span className="text-lg text-muted-foreground">/ DAY</span></div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">起始价格</p>
                     </div>
                     <Link to="/payment" className="w-full md:w-auto px-12 py-5 bg-black text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-colors">
                        立即部署推广计划
                     </Link>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* Final CTA */}
      <section className="py-40 px-6 text-center">
         <h2 className="text-8xl font-black tracking-tighter mb-12 opacity-10">QianFu Liandeng</h2>
         <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em]">
            © 2026 QIANFU LIANDENG SYSTEM. ALL RIGHTS RESERVED.
         </p>
      </section>
    </div>
  );
};

export default PromotionLanding;
