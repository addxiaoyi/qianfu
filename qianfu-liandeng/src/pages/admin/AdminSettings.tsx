import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminPageHeader from '@/components/ui/AdminPageHeader';
import GeometricLantern, { type LanternVariant } from '@/components/ui/GeometricLantern';

type ConfigEntry = {
  title: string;
  description: string;
  path: string;
  variant: LanternVariant;
  badge: string;
};

type ConfigGroup = {
  title: string;
  description: string;
  entries: ConfigEntry[];
};

const CONFIG_GROUPS: ConfigGroup[] = [
  {
    title: 'System Core',
    description: '超管高频系统配置入口，集中处理站点、公告与网络安全。',
    entries: [
      { title: '邮件配置', description: '配置 SMTP、验证码邮件、重置密码与测试发信。', path: '/admin-mail', variant: 'data', badge: 'MAIL' },
      { title: '公告中心', description: '创建、定时、发布和下线全站顶部公告。', path: '/admin-announcements', variant: 'message', badge: 'NOTICE' },
      { title: '控制总览', description: '进入总控看板，查看站点运行状态与关键指标。', path: '/admin', variant: 'spark', badge: 'CORE' },
      { title: '端口安全', description: '治理端口、入口策略与敏感暴露面。', path: '/admin-port5555', variant: 'network', badge: 'NET' },
    ],
  },
  {
    title: 'Operations',
    description: '用户、审核、工单与内容处理的操作入口。',
    entries: [
      { title: '用户管理', description: '账户目录、权限与管理员账户治理。', path: '/admin-users', variant: 'user', badge: 'AUTH' },
      { title: '服务器审核', description: '节点上架审核与状态裁定。', path: '/admin-review', variant: 'security', badge: 'NODE' },
      { title: '工单管理', description: '支持流程与人工处理台。', path: '/admin-tickets', variant: 'activity', badge: 'HELP' },
      { title: '内容审核', description: '站内内容、屏蔽词与风控过滤。', path: '/admin-moderation', variant: 'security', badge: 'SAFE' },
    ],
  },
  {
    title: '审计与风控',
    description: '审计日志、指标与举报风险面板。',
    entries: [
      { title: '审计日志', description: '查看关键动作账本与追踪记录。', path: '/admin-audit', variant: 'terminal', badge: 'LOG' },
      { title: '数据统计', description: '查看超管指标、趋势与平台状态。', path: '/admin-audit-stats', variant: 'data', badge: 'STAT' },
      { title: '举报管理', description: '处理举报、异常与处罚流转。', path: '/admin-reports', variant: 'alert', badge: 'RISK' },
    ],
  },
];

const AdminSettings: React.FC = () => {
  return (
    <div className="space-y-16 pb-24 bg-white">
      <AdminPageHeader
        badge="Super Admin / Config Hub"
        title="配置总控"
        description="把超管可配置项统一收口到一个页面。这里直接跳转到真实可用的配置模块，不再保留演示表单。"
        statusLabel="配置入口已启用"
        statusTone="success"
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {CONFIG_GROUPS.map((group, groupIndex) => (
          <motion.section
            key={group.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.06 }}
            className="rounded-[3rem] border border-zinc-100 bg-white p-8 shadow-xs space-y-6"
          >
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
                <GeometricLantern variant="settings" className="w-4 h-4" />
                {group.title}
              </div>
              <p className="text-sm font-bold leading-7 text-zinc-500">{group.description}</p>
            </div>

            <div className="space-y-3">
              {group.entries.map((entry) => (
                <Link
                  key={entry.path}
                  to={entry.path}
                  className="group flex items-center gap-4 rounded-[2rem] border border-zinc-100 bg-zinc-50/70 px-5 py-5 transition-all hover:border-accent hover:bg-white"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] border border-zinc-100 bg-white text-zinc-400 transition-all group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                    <GeometricLantern variant={entry.variant} className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-sm font-black uppercase tracking-[0.18em] text-zinc-900">{entry.title}</h3>
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.24em] text-zinc-300">{entry.badge}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">{entry.description}</p>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-1 group-hover:text-accent" />
                </Link>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
};

export default AdminSettings;
