import React from 'react';
import { motion } from 'framer-motion';

const Privacy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-24">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="prose prose-invert max-w-none bg-card border border-border p-12 rounded-[2.5rem] shadow-xl"
      >
        <div className="mb-10 text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">DATA_GOVERNANCE</div>
        <h1 className="text-4xl font-black mb-8 tracking-tight">隐私政策 (Privacy Policy)</h1>
        
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">1. 数据收集</h2>
          <p className="text-muted-foreground leading-relaxed">
            我们收集您的基本个人信息（如邮箱、用户名）用于账户创建与验证。同时收集您的支付记录与服务器宣传数据以维持业务运行。
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">2. Cookie 使用</h2>
          <p className="text-muted-foreground leading-relaxed">
            我们使用 HttpOnly Cookie 来管理您的会话，这有助于提高安全性。我们不会使用这些数据进行跨站追踪。
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">3. 信息共享</h2>
          <p className="text-muted-foreground leading-relaxed">
            除法律要求或保护平台利益外，我们不会将您的个人隐私信息分享或出售给任何第三方。
          </p>
        </section>

        <div className="pt-10 border-t border-border mt-20 text-xs text-muted-foreground">
           最后更新日期: 2026年4月29日
        </div>
      </motion.div>
    </div>
  );
};

export default Privacy;
