import React from 'react';
import { motion } from 'framer-motion';
import {
  User, Settings, Shield, CreditCard,
  MessageSquare, FileText, Bell, LogOut,
  ChevronRight, Star, Award, Ticket,
  HelpCircle, Gift
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
  color: string;
  requiresAuth?: boolean;
}

const MobileUserCenter: React.FC = () => {
  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: '我的服务',
      items: [
        { icon: MessageSquare, label: '我的消息', path: '/messages', color: 'bg-blue-500', badge: 3 },
        { icon: Ticket, label: '工单记录', path: '/tickets', color: 'bg-purple-500' },
        { icon: CreditCard, label: '支付记录', path: '/me/payments', color: 'bg-green-500' },
        { icon: Gift, label: '推广中心', path: '/promotion', color: 'bg-orange-500' },
      ],
    },
    {
      title: '我的账户',
      items: [
        { icon: Star, label: '我的收藏', path: '/me/favorites', color: 'bg-yellow-500' },
        { icon: Award, label: '成就系统', path: '/me/achievements', color: 'bg-indigo-500' },
        { icon: User, label: '编辑资料', path: '/me/edit', color: 'bg-pink-500' },
      ],
    },
    {
      title: '设置',
      items: [
        { icon: Bell, label: '通知设置', path: '/me/notifications', color: 'bg-red-500' },
        { icon: Shield, label: '安全中心', path: '/me/security', color: 'bg-teal-500' },
        { icon: Settings, label: '通用设置', path: '/settings', color: 'bg-gray-500' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-8 bg-gradient-to-b from-black to-gray-900">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-white uppercase tracking-tight">个人中心</h1>
          <Link to="/settings">
            <Settings className="w-5 h-5 text-white/80" />
          </Link>
        </div>

        {/* Profile Card */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-white/20 to-white/10 rounded-2xl flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-white">玩家用户</h2>
            <p className="text-xs text-white/60 font-medium">UID: 123456</p>
          </div>
          <Link to="/me/edit">
            <ChevronRight className="w-5 h-5 text-white/40" />
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 text-center">
            <p className="text-xl font-black text-white">12</p>
            <p className="text-[10px] font-bold text-white/60 uppercase">收藏</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 text-center">
            <p className="text-xl font-black text-white">3</p>
            <p className="text-[10px] font-bold text-white/60 uppercase">工单</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 text-center">
            <p className="text-xl font-black text-white">4.8</p>
            <p className="text-[10px] font-bold text-white/60 uppercase">评分</p>
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="px-4 -mt-4 space-y-6">
        {menuSections.map((section) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {section.title}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {section.items.map((item, index) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className="flex items-center gap-4 p-4 active:bg-gray-50 transition-colors"
                >
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white')}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{item.label}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] text-center">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Help & Feedback */}
      <div className="px-4 mt-6">
        <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-bold">帮助与反馈</p>
              <p className="text-[10px] text-muted-foreground">遇到问题？联系我们</p>
            </div>
          </div>
          <Link to="/support">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 mt-8">
        <button className="w-full py-4 text-sm font-bold text-red-500 bg-red-50 rounded-2xl active:bg-red-100 transition-colors flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </div>
  );
};

export default MobileUserCenter;
