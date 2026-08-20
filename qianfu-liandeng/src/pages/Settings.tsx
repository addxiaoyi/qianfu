import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, FileText, Languages, LifeBuoy, Mail, Palette, ShieldCheck, UserPen } from 'lucide-react';
import { type AccentTheme, type Locale, useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';

const accents: Array<{ value: AccentTheme; label: string; swatch: string }> = [
  { value: 'zinc', label: '黑曜石', swatch: 'bg-zinc-900' },
  { value: 'amber', label: '灯笼橙', swatch: 'bg-amber-500' },
  { value: 'emerald', label: '森林绿', swatch: 'bg-emerald-600' },
  { value: 'sky', label: '钻石蓝', swatch: 'bg-sky-600' },
  { value: 'violet', label: '紫颂花', swatch: 'bg-violet-600' },
  { value: 'rose', label: '地狱红', swatch: 'bg-rose-600' },
];

const Settings: React.FC = () => {
  const { locale, accent, setLocale, setAccent } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const verifyPath = user?.email ? `/verify-code?email=${encodeURIComponent(user.email)}` : '/verify-code';

  const links = [
    { to: '/me/edit', label: '编辑账号资料', hint: '用户名、头像与密码', Icon: UserPen },
    { to: user?.email_verified ? '/me' : verifyPath, label: '邮箱状态', hint: user?.email_verified ? '邮箱已验证' : '等待完成验证', Icon: Mail },
    { to: '/me/notifications', label: '通知中心', hint: '查看站内消息', Icon: Bell },
    { to: '/privacy', label: '隐私政策', hint: '了解信息处理方式', Icon: ShieldCheck },
    { to: '/terms', label: '服务条款', hint: '查看平台使用规则', Icon: FileText },
    { to: '/tickets/new', label: '帮助与反馈', hint: '创建工单联系管理组', Icon: LifeBuoy },
  ];

  const chooseLocale = (next: Locale) => setLocale(next);

  return (
    <div className="min-h-[70vh] bg-white px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-zinc-200 pb-8">
          <p className="text-sm font-bold text-accent">账户偏好</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] text-zinc-950 sm:text-5xl">设置</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">管理界面语言、主题颜色，以及账户、安全和支持入口。</p>
        </header>

        <section className="grid gap-8 border-b border-zinc-200 py-10 lg:grid-cols-[16rem_1fr]">
          <div><Languages className="h-5 w-5 text-zinc-500" /><h2 className="mt-3 text-xl font-black">界面语言</h2></div>
          <div role="group" aria-label="界面语言" className="grid max-w-xl grid-cols-2 gap-3">
            {([{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }] as const).map((option) => (
              <button key={option.value} type="button" aria-pressed={locale === option.value} onClick={() => chooseLocale(option.value)} className={`rounded-xl border px-5 py-4 text-left text-sm font-bold transition-colors ${locale === option.value ? 'border-black bg-black text-white' : 'border-zinc-200 hover:border-zinc-400'}`}>{option.label}</button>
            ))}
          </div>
        </section>

        <section className="grid gap-8 border-b border-zinc-200 py-10 lg:grid-cols-[16rem_1fr]">
          <div><Palette className="h-5 w-5 text-zinc-500" /><h2 className="mt-3 text-xl font-black">主题颜色</h2></div>
          <div role="group" aria-label="主题颜色" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {accents.map((option) => (
              <button key={option.value} type="button" aria-pressed={accent === option.value} onClick={() => setAccent(option.value)} className={`flex items-center gap-3 rounded-xl border px-4 py-4 text-left text-sm font-bold transition-colors ${accent === option.value ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'}`}>
                <span className={`h-5 w-5 rounded-md ${option.swatch}`} aria-hidden="true" />{option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="py-10">
          <h2 className="text-xl font-black">账户与支持</h2>
          <div className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
            {links.map(({ to, label, hint, Icon }) => (
              <Link key={label} to={to} className="flex items-center gap-4 px-1 py-5 text-zinc-900 transition-colors hover:bg-zinc-50 sm:px-4">
                <Icon className="h-5 w-5 shrink-0 text-zinc-500" />
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs text-zinc-500">{hint}</span></span>
                <span aria-hidden="true" className="text-zinc-400">›</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
