import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Globe, Shield, ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { beginGitHubOAuthLogin, fetchOAuthStatus, type OAuthStatusPayload } from '@/auth/githubOAuth';

const OAuthSelection: React.FC = () => {
  const navigate = useNavigate();
  const [oauthStatus, setOauthStatus] = React.useState<OAuthStatusPayload | null>(null);
  const [oauthLoading, setOauthLoading] = React.useState(false);

  React.useEffect(() => {
    void fetchOAuthStatus()
      .then(setOauthStatus)
      .catch(() => setOauthStatus(null));
  }, []);

  const handleGitHubLogin = () => {
    void (async () => {
      setOauthLoading(true);
      try {
        const status = oauthStatus || (await fetchOAuthStatus());
        if (!status.providers.github.backendEnabled) {
          toast({
            variant: 'destructive',
            title: 'GitHub 登录未配置',
            description: '服务器端 GitHub OAuth 还未启用，请先完成后端 provider 配置。',
          });
          return;
        }
        await beginGitHubOAuthLogin(status);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'GitHub 登录初始化失败',
          description: error instanceof Error ? error.message : 'OAuth bootstrap failed',
        });
      } finally {
        setOauthLoading(false);
      }
    })();
  };

  const providers = [
    { name: 'GitHub', icon: Shield, color: 'bg-zinc-900', hover: 'hover:bg-zinc-800', onClick: handleGitHubLogin },
    { name: 'Google', icon: Globe, color: 'bg-blue-600', hover: 'hover:bg-blue-500', onClick: () => {} },
    { name: 'Email', icon: Mail, color: 'bg-zinc-800', hover: 'hover:bg-zinc-700', onClick: () => {} },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card border border-border rounded-[2.5rem] p-12 shadow-2xl text-center"
      >
        <button type="button" 
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand mb-10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> 返回账号登录
        </button>

        <h1 className="text-3xl font-black mb-3">第三方快捷登录</h1>
        <p className="text-muted-foreground mb-12 text-sm font-medium">选择您信任的服务提供商以继续访问</p>

        <div className="space-y-4">
            {providers.map((p, i) => (
              <motion.button type="button" 
                key={p.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
                onClick={p.onClick}
                disabled={p.name === 'GitHub' ? oauthLoading : true}
                className={`w-full py-5 rounded-2xl ${p.color} ${p.hover} text-white font-black flex items-center justify-center gap-4 shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <p.icon className="w-6 h-6" />
                {p.name === 'GitHub' && oauthLoading ? '初始化 GitHub 登录…' : `使用 ${p.name} 登录`}
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
