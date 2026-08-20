import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { policyDefinitions } from './CompliancePolicy';

const ComplianceCenter: React.FC = () => (
  <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
    <header className="rounded-2xl border border-border bg-card px-6 py-10 shadow-sm sm:px-10 sm:py-12">
      <div className="flex items-center gap-3 text-accent">
        <ShieldCheck className="h-5 w-5" />
        <span className="text-[10px] font-black uppercase tracking-[0.32em]">Compliance & Trust</span>
      </div>
      <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground sm:text-4xl">合规与信息服务规则中心</h1>
      <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-muted-foreground">
        本中心集中公开平台的信息服务边界、未成年人保护、Cookie、禁止内容、知识产权、举报和审核规则。审核人员和用户无需登录即可访问。
      </p>
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-bold">
        <Link className="underline underline-offset-4" to="/terms">服务条款</Link>
        <Link className="underline underline-offset-4" to="/privacy">隐私声明</Link>
        <Link className="underline underline-offset-4" to="/acceptable-use">可接受使用政策</Link>
      </div>
    </header>

    <section className="mt-8 grid gap-4 md:grid-cols-2">
      {policyDefinitions.map((policy) => (
        <Link
          key={policy.path}
          to={policy.path}
          className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-foreground"
        >
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-accent">{policy.eyebrow}</div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-foreground">{policy.title}</h2>
          <p className="mt-3 text-sm font-medium leading-7 text-muted-foreground">{policy.summary}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-foreground">
            查看规则 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      ))}
    </section>

    <aside className="mt-8 rounded-2xl border border-border bg-muted/40 px-6 py-6 text-sm font-medium leading-7 text-muted-foreground">
      对信息服务、内容处置或知识产权有疑问，可通过平台工单或发送邮件至
      {' '}<a className="font-bold text-foreground underline underline-offset-4" href="mailto:support@0st.top">support@0st.top</a>。
    </aside>
  </main>
);

export default ComplianceCenter;
