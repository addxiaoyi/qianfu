import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, User, Bell, Shield, Globe,
  Moon, Star, ChevronRight, LogOut, Trash2,
  HelpCircle, Info, Mail
} from 'lucide-react';
import { cn } from '../../utils/cn';

const MobileSettings: React.FC = () => {
  const [toggles, setToggles] = useState({
    pushNotifications: true,
    emailNotifications: false,
    darkMode: false,
    onlineStatus: true,
    showServerInfo: true,
  });

  const toggleSetting = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-50/90 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <div />
          <h1 className="text-base font-black uppercase tracking-tight">设置</h1>
          <div className="w-5" />
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              账户
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            <button className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold">编辑资料</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
                  <Star className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold">我的收藏</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Notification Section */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              通知
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              onClick={() => toggleSetting('pushNotifications')}
              className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">推送通知</span>
                  <span className="text-[10px] text-muted-foreground">接收服务器状态变更通知</span>
                </div>
              </div>
              <div
                className={cn(
                  'w-11 h-6 rounded-full flex items-center transition-colors',
                  toggles.pushNotifications ? 'bg-black' : 'bg-gray-200'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 bg-white rounded-full transition-transform',
                    toggles.pushNotifications ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </div>
            </button>
            <button
              onClick={() => toggleSetting('emailNotifications')}
              className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">邮件通知</span>
                  <span className="text-[10px] text-muted-foreground">接收重要邮件</span>
                </div>
              </div>
              <div
                className={cn(
                  'w-11 h-6 rounded-full flex items-center transition-colors',
                  toggles.emailNotifications ? 'bg-black' : 'bg-gray-200'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 bg-white rounded-full transition-transform',
                    toggles.emailNotifications ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              外观
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              onClick={() => toggleSetting('darkMode')}
              className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
                  <Moon className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">深色模式</span>
                  <span className="text-[10px] text-muted-foreground">切换应用主题</span>
                </div>
              </div>
              <div
                className={cn(
                  'w-11 h-6 rounded-full flex items-center transition-colors',
                  toggles.darkMode ? 'bg-black' : 'bg-gray-200'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 bg-white rounded-full transition-transform',
                    toggles.darkMode ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </div>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-4 active:bg-gray-50">
              <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold">语言</span>
              <span className="text-xs text-muted-foreground ml-auto">简体中文</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-2" />
            </button>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              隐私与安全
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              onClick={() => toggleSetting('onlineStatus')}
              className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">在线状态</span>
                  <span className="text-[10px] text-muted-foreground">显示在线状态给其他用户</span>
                </div>
              </div>
              <div
                className={cn(
                  'w-11 h-6 rounded-full flex items-center transition-colors',
                  toggles.onlineStatus ? 'bg-black' : 'bg-gray-200'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 bg-white rounded-full transition-transform',
                    toggles.onlineStatus ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </div>
            </button>
            <button className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
                  <Info className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold">隐私政策</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Support Section */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              帮助
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            <button className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold">帮助与反馈</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Destructive Actions */}
        <div className="space-y-3 pt-4">
          <button className="w-full flex items-center justify-center gap-2 py-4 bg-white rounded-2xl text-red-500 font-bold text-sm active:bg-red-50">
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
          <button className="w-full flex items-center justify-center gap-2 py-4 bg-white rounded-2xl text-red-500 font-bold text-sm active:bg-red-50">
            <Trash2 className="w-4 h-4" />
            注销账户
          </button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground pt-4">
          版本 1.0.0
        </p>
      </div>
    </div>
  );
};

export default MobileSettings;
