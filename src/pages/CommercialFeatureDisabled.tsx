import { Link } from 'react-router-dom';

export default function CommercialFeatureDisabled() {
  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-2xl items-center justify-center px-6 py-16">
      <section className="w-full rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm sm:p-10" aria-labelledby="commercial-feature-disabled-title">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-zinc-400">当前站点模式</p>
        <h1 id="commercial-feature-disabled-title" className="mt-4 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
          该功能暂未开放
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-zinc-600">
          本站目前仅提供服务器展示、发布、账号管理、新闻和工单服务，不提供支付、钱包、商城或推广交易功能。
        </p>
        <Link to="/" className="mt-8 inline-flex items-center justify-center rounded-xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800">
          返回首页
        </Link>
      </section>
    </main>
  );
}
