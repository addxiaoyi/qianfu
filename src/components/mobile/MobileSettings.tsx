import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  Bell,
  ChevronRight,
  FileText,
  HelpCircle,
  LogOut,
  Mail,
  ShieldCheck,
  UserPen,
  type LucideIcon,
} from 'lucide-react';
import { type AccentTheme, useUIStore } from '@/store/uiStore';

const accentOptions: Array<{ value: AccentTheme; label: string; swatch: string }> = [
  { value: 'zinc', label: '黑曜石', swatch: 'bg-zinc-900' },
  { value: 'amber', label: '灯笼橙', swatch: 'bg-amber-500' },
  { value: 'emerald', label: '森林绿', swatch: 'bg-emerald-600' },
  { value: 'sky', label: '钻石蓝', swatch: 'bg-sky-600' },
  { value: 'violet', label: '紫颂花', swatch: 'bg-violet-600' },
  { value: 'rose', label: '地狱红', swatch: 'bg-rose-600' },
];

const MobileSettings: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { locale, accent, setLocale, setAccent } = useUIStore();
  const verifyEmailPath = user?.email
    ? `/verify-code?email=${encodeURIComponent(user.email)}`
    : '/verify-code';

  const rows: { Icon: LucideIcon; label: string; hint: string; to: string }[] = [
    { Icon: UserPen, label: '编辑资料', hint: user?.username || user?.email || '账户资料', to: '/me/edit' },
    { Icon: Mail, label: '邮箱状态', hint: user?.email_verified ? '已验证' : '待验证', to: user?.email_verified ? '/me' : verifyEmailPath },
    { Icon: Bell, label: '通知中心', hint: '查看站内通知', to: '/me/notifications' },
    { Icon: ShieldCheck, label: '隐私政策', hint: '查看平台隐私说明', to: '/privacy' },
    { Icon: FileText, label: '服务条款', hint: '查看平台规则条款', to: '/terms' },
    { Icon: HelpCircle, label: '帮助与反馈', hint: '提交工单获取支持', to: '/tickets/new' },
  ];

  return (
    <div className="bg-white pb-6 text-zinc-900">
      <div className="space-y-5 px-4 py-5">
        <section className="rounded-2xl border border-zinc-100 bg-white p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">界面语言</div>
          <div role="group" aria-label="界面语言" className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={locale === 'zh'} onClick={() => setLocale('zh')} className={`rounded-xl px-3 py-3 text-sm font-bold ${locale === 'zh' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-700'}`}>中文</button>
            <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')} className={`rounded-xl px-3 py-3 text-sm font-bold ${locale === 'en' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-700'}`}>English</button>
          </div>
          <div className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">主题颜色</div>
          <div role="group" aria-label="主题颜色" className="mt-3 grid grid-cols-2 gap-2">
            {accentOptions.map((option) => (
              <button key={option.value} type="button" aria-pressed={accent === option.value} onClick={() => setAccent(option.value)} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-bold ${accent === option.value ? 'border-black bg-zinc-50' : 'border-zinc-100'}`}>
                <span aria-hidden="true" className={`h-4 w-4 rounded ${option.swatch}`} />{option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-100 bg-white">
          <div className="border-b border-zinc-100 px-4 py-3">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">账户与支持</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <Link key={row.label} to={row.to} className="flex items-center gap-3 px-4 py-4 active:bg-zinc-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-zinc-700">
                  <row.Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">{row.label}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-400">{row.hint}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-300" />
              </Link>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm font-black text-red-600"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>

        <p className="pt-2 text-center text-[10px] font-bold text-zinc-300">千服联灯</p>
      </div>
    </div>
  );
};

export default MobileSettings;
