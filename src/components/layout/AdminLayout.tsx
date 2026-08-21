import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import GeometricLantern, { type LanternVariant } from '@/components/ui/GeometricLantern';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

type AdminNavItem = {
  label: string;
  path: string;
  variant: LanternVariant;
};

type AdminNavGroup = {
  label: string;
  hint: string;
  items: AdminNavItem[];
};

const adminNavGroups: AdminNavGroup[] = [
  {
    label: '工作台',
    hint: '站点状态与核心入口',
    items: [{ label: '后台总览', path: '/admin', variant: 'network' }],
  },
  {
    label: '用户与内容',
    hint: '用户、服务器和内容流转',
    items: [
      { label: '用户管理', path: '/admin-users', variant: 'user' },
      { label: '服务器审核', path: '/admin-review', variant: 'security' },
      { label: '内容审核', path: '/admin-moderation', variant: 'security' },
      { label: '新闻管理', path: '/admin-announcements', variant: 'broadcast' },
      { label: '工单管理', path: '/admin-tickets', variant: 'activity' },
      { label: '举报管理', path: '/admin-reports', variant: 'alert' },
    ],
  },
  {
    label: '审计与安全',
    hint: '记录、指标与网络边界',
    items: [
      { label: '审计日志', path: '/admin-audit', variant: 'terminal' },
      { label: '审计统计', path: '/admin-audit-stats', variant: 'data' },
      { label: '端口安全', path: '/admin-port5555', variant: 'network' },
    ],
  },
  {
    label: '系统设置',
    hint: '站点级参数与运行策略',
    items: [
      { label: '系统设置', path: '/admin-settings', variant: 'settings' },
      { label: 'AI 配置', path: '/admin-ai', variant: 'spark' },
      { label: '邮件配置', path: '/admin-mail', variant: 'activity' },
      { label: '免费域名 DNS', path: '/admin-free-domains', variant: 'network' },
    ],
  },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => (
  <div className="min-h-[calc(100dvh-4rem)] bg-white text-zinc-950">
    <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
      <aside className="border-b border-zinc-200 bg-zinc-50 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="border-b border-zinc-200 px-5 py-5">
          <p className="text-xs font-medium text-zinc-500">管理控制台</p>
          <div className="mt-1 text-lg font-semibold tracking-tight">千服联灯后台</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <NavLink
              to="/dashboard"
              data-admin-entry="admin-layout"
              className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-center text-[11px] font-bold text-zinc-600 transition-colors hover:border-black hover:text-zinc-950"
            >
              返回控制台
            </NavLink>
            <NavLink
              to="/"
              data-admin-entry="admin-layout"
              className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-center text-[11px] font-bold text-zinc-600 transition-colors hover:border-black hover:text-zinc-950"
            >
              前台首页
            </NavLink>
          </div>
        </div>
        <nav aria-label="管理后台导航" className="space-y-4 p-3">
          {adminNavGroups.map((group) => (
            <section key={group.label} aria-labelledby={`admin-nav-${group.label}`}>
              <div className="px-2">
                <h2 id={`admin-nav-${group.label}`} className="text-xs font-semibold text-zinc-700">{group.label}</h2>
                <p className="mt-1 text-[11px] leading-4 text-zinc-400">{group.hint}</p>
              </div>
              <div className="mt-2 space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/admin'}
                    className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-white hover:text-zinc-950'}`}
                  >
                    <GeometricLantern variant={item.variant} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <main className="admin-density min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children || <Outlet />}
      </main>
    </div>
  </div>
);

export default AdminLayout;
