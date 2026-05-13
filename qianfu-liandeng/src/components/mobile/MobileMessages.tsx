import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageSquare, User, ArrowRight, Shield, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import TouchButton from './TouchButton';
import { cn } from '../../utils/cn';

type Tab = 'inbox' | 'system' | 'group';

interface Message {
  id: string;
  from: string;
  avatar?: string;
  lastMsg: string;
  time: string;
  unread: number;
  online?: boolean;
}

const mockMessages: Message[] = [
  { id: '1', from: '技术支持团队', lastMsg: '您的问题已处理完成', time: '10:30', unread: 2, online: true },
  { id: '2', from: '系统通知', lastMsg: '您的服务器续费提醒', time: '昨天', unread: 0, online: true },
  { id: '3', from: '张三', lastMsg: '好的，明天见', time: '昨天', unread: 1 },
  { id: '4', from: '社区运营', lastMsg: '活动报名成功！', time: '3天前', unread: 0 },
  { id: '5', from: '李四', lastMsg: '谢谢你的推荐', time: '1周前', unread: 0 },
];

const tabConfig: Record<Tab, { label: string; icon: React.ElementType }> = {
  inbox: { label: '收件箱', icon: MessageSquare },
  system: { label: '系统', icon: Shield },
  group: { label: '群组', icon: User },
};

const MobileMessages: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const filteredMessages = mockMessages.filter(m =>
    m.from.includes(searchQuery) || m.lastMsg.includes(searchQuery)
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="搜索消息..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-1 rounded-xl border border-zinc-200">
        {(Object.keys(tabConfig) as Tab[]).map(tab => {
          const Icon = tabConfig[tab].icon;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-zinc-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tabConfig[tab].label}
            </button>
          );
        })}
      </div>

      {/* Messages list */}
      <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
        {filteredMessages.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-zinc-200 mb-3" />
            <p className="text-sm text-zinc-400">暂无消息</p>
          </div>
        ) : (
          filteredMessages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-4 hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 bg-zinc-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-zinc-500">
                    {msg.from.charAt(0)}
                  </span>
                </div>
                {msg.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-zinc-900">
                    {msg.from}
                  </span>
                  <span className="text-xs text-zinc-400">{msg.time}</span>
                </div>
                <p className="text-sm text-zinc-500 truncate">{msg.lastMsg}</p>
              </div>

              {/* Unread badge + arrow */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {msg.unread > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {msg.unread}
                  </span>
                )}
                <ArrowRight className="w-4 h-4 text-zinc-300" />
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/tickets"
          className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-zinc-700">工单中心</span>
        </Link>
        <Link
          to="/me"
          className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors"
        >
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-sm font-medium text-zinc-700">设置</span>
        </Link>
      </div>
    </div>
  );
};

export default MobileMessages;
