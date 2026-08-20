import React from 'react';
import { Link } from 'react-router-dom';

interface LegalDocumentProps {
  eyebrow: string;
  title: string;
  summary: string;
  effectiveDate?: string;
  children: React.ReactNode;
}

export const LegalSection: React.FC<{
  id: string;
  title: string;
  children: React.ReactNode;
}> = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-28 border-t border-border pt-8 first:border-t-0 first:pt-0">
    <h2 className="mb-4 text-xl font-black tracking-tight text-foreground">{title}</h2>
    <div className="space-y-4 text-sm font-medium leading-7 text-muted-foreground">{children}</div>
  </section>
);

const LegalDocument: React.FC<LegalDocumentProps> = ({
  eyebrow,
  title,
  summary,
  effectiveDate = '2026年7月29日',
  children,
}) => {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <header className="border-b border-border px-6 py-10 sm:px-10 sm:py-12">
          <div className="mb-4 text-[10px] font-black uppercase tracking-[0.32em] text-accent">{eyebrow}</div>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-muted-foreground">{summary}</p>
          <dl className="mt-8 grid gap-3 text-xs font-semibold text-muted-foreground sm:grid-cols-2">
            <div className="rounded-lg bg-muted px-4 py-3">
              <dt className="text-[10px] uppercase tracking-widest">生效日期</dt>
              <dd className="mt-1 text-foreground">{effectiveDate}</dd>
            </div>
            <div className="rounded-lg bg-muted px-4 py-3">
              <dt className="text-[10px] uppercase tracking-widest">联系渠道</dt>
              <dd className="mt-1"><a className="text-foreground underline underline-offset-4" href="mailto:support@0st.top">support@0st.top</a></dd>
            </div>
          </dl>
        </header>

        <div className="space-y-10 px-6 py-10 sm:px-10 sm:py-12">{children}</div>

        <footer className="border-t border-border bg-muted/40 px-6 py-8 sm:px-10">
          <p className="text-xs font-medium leading-6 text-muted-foreground">
            本页面与其他平台规则共同构成服务约定。法律法规另有强制性规定的，从其规定。
          </p>
          <nav aria-label="相关法律政策" className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold">
            <Link className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground" to="/terms">服务条款</Link>
            <Link className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground" to="/privacy">隐私声明</Link>
            <Link className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground" to="/acceptable-use">可接受使用政策</Link>
            <Link className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground" to="/compliance">合规与信息服务规则</Link>
          </nav>
        </footer>
      </article>
    </main>
  );
};

export default LegalDocument;
