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

const MobileSettings: React.FC = () => {
  const { user, logout } = useAuthStore();
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
