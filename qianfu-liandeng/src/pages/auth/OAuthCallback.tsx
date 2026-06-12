import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api, ApiError, setLocalAuthToken } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/use-toast';
import type { User } from '@/types/api';
import { normalizeUser } from '@/utils/user';

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { provider } = useParams();
  const ranRef = useRef(false);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void (async () => {
      try {
        const hash = window.location.hash || '';
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?')) : '');
        const params = new URLSearchParams(window.location.search || hash.split('?')[1] || '');
        const token = searchParams.get('token') || hashParams.get('token') || params.get('token');
        const error = searchParams.get('error') || hashParams.get('error') || params.get('error');
        const message = searchParams.get('message') || hashParams.get('message') || params.get('message');

        if (error) {
          toast({
            variant: 'destructive',
            title: 'GitHub 登录失败',
            description: message || error,
          });
          navigate('/login', { replace: true });
          return;
        }

        if (!token) {
          throw new Error('OAuth callback token missing');
        }

        setLocalAuthToken(token);
        const profile = normalizeUser(await api.get<User>('/profile'));
        if (!profile) {
          throw new Error('OAuth profile missing');
        }
        setUser(profile);
        toast({
          title: `${provider || 'GitHub'} 登录成功`,
          description: `已同步账号 ${profile.username || profile.email}`,
        });
        navigate(profile.email_verified ? '/dashboard' : `/verify-code?email=${encodeURIComponent(profile.email)}`, { replace: true });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'OAuth callback failed';
        toast({
          variant: 'destructive',
          title: 'GitHub 登录失败',
          description: message,
        });
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate, provider, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-black text-white shadow-2xl">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black uppercase italic tracking-tight">OAuth Callback</h1>
          <p className="text-sm font-bold text-zinc-400">正在完成 {provider || 'GitHub'} 身份同步与会话建立。</p>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;
