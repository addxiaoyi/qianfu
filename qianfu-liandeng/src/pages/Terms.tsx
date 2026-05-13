import React from 'react';
import { motion } from 'framer-motion';

const Terms: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-24">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="prose prose-invert max-w-none bg-card border border-border p-12 rounded-[2.5rem] shadow-xl"
      >
        <div className="mb-10 text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">LEGAL_FRAMEWORK</div>
        <h1 className="text-4xl font-black mb-8 tracking-tight">服务条款 (Terms of Service)</h1>
        
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">1. 接受条款</h2>
          <p className="text-muted-foreground leading-relaxed">
            通过访问或使用千服联灯平台，即表示您同意受本服务条款的约束。如果您不同意本条款的任何部分，则您无权访问本平台。
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">2. 服务说明</h2>
          <p className="text-muted-foreground leading-relaxed">
            千服联灯为 Minecraft 服务器提供宣传位购买、列表展示及玩家互动服务。我们保留随时修改、暂停或终止任何服务的权利，且无需另行通知。
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">3. 用户义务</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>您必须年满 13 周岁才能使用本平台。</li>
            <li>您对您账户下的所有活动负责。</li>
            <li>不得上传任何侵权、违禁或恶意攻击性的内容。</li>
            <li>服务器宣传内容必须真实有效，禁止刷票等作弊行为。</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">4. 支付与退款</h2>
          <p className="text-muted-foreground leading-relaxed">
            宣传位购买一旦完成并生效，除因平台技术故障导致的无法展示外，原则上不予退款。所有余额充值均不可提现为现金。
          </p>
        </section>

        <div className="pt-10 border-t border-border mt-20 text-xs text-muted-foreground">
           最后更新日期: 2026年4月29日
        </div>
      </motion.div>
    </div>
  );
};

export default Terms;
