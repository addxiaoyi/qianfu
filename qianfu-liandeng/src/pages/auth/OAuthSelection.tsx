import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Globe, Shield, ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const GITHUB_OAUTH_URL = import.meta.env.VITE_GITHUB_OAUTH_URL?.trim();

const OAuthSelection: React.FC = () => {
  const navigate = useNavigate();

  const handleGitHubLogin = () => {
    if (!GITHUB_OAUTH_URL) {
      toast({
        variant: 'destructive',
        title: 'GitHub 登录未配置',
        description: '请先在环境变量中配置 VITE_GITHUB_OAUTH_URL，再使用 GitHub 登录。',
      });
      return;
    }

    window.location.assign(GITHUB_OAUTH_URL);
  };

  const providers = [
    { name: 'GitHub', icon: Shield, color: 'bg-zinc-900', hover: 'hover:bg-zinc-800', onClick: handleGitHubLogin },
    { name: 'Google', icon: Globe, color: 'bg-blue-600', hover: 'hover:bg-blue-500' },
    { name: 'Email', icon: Mail, color: 'bg-zinc-800', hover: 'hover:bg-zinc-700' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card border border-border rounded-[2.5rem] p-12 shadow-2xl text-center"
      >
        <button 
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand mb-10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> 返回账号登录
        </button>

        <h1 className="text-3xl font-black mb-3">第三方快捷登录</h1>
        <p className="text-muted-foreground mb-12 text-sm font-medium">选择您信任的服务提供商以继续访问</p>

        <div className="space-y-4">
          {providers.map((p, i) => (
            <motion.button 
              key={p.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={p.onClick}
              className={`w-full py-5 rounded-2xl ${p.color} ${p.hover} text-white font-black flex items-center justify-center gap-4 shadow-xl transition-all active:scale-95`}
            >
              <p.icon className="w-6 h-6" />
              使用 {p.name} 登录
            </motion.button>
          ))}
        </div>

        <p className="mt-12 text-xs text-muted-foreground font-medium leading-relaxed">
          点击上方按钮即表示您同意我们的<br />
          <Link to="/terms" className="text-brand hover:underline">服务条款</Link> 与 <Link to="/privacy" className="text-brand hover:underline">隐私政策</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default OAuthSelection;
