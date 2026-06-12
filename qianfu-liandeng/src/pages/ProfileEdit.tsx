import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { request } from '@/api/request';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronLeft } from 'lucide-react';
import { useT } from '@/store/uiStore';
const profileSchema = z.object({
  username: z.string().min(3, '用户名至少3位'),
  email: z.string().email('无效的邮箱'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(8, '新密码至少8位'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '两次输入不一致',
  path: ['confirmPassword'],
});

const sectionTitleClass = 'text-xs font-black font-mono uppercase tracking-[0.4em] text-muted-foreground flex items-center gap-4 italic';

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

const ProfileEdit: React.FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  const onUpdateProfile = async (values: ProfileValues) => {
    setLoading(true);
    try {
      await request('/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      toast({ title: t('common.success'), description: '账号资料已更新。' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const onUpdatePassword = async (values: PasswordValues) => {
    setLoading(true);
    try {
      await request('/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      toast({ title: t('common.success'), description: '登录密码已更新。' });
      passwordForm.reset();
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-24 selection:bg-accent selection:text-white">
      <header className="mb-20">
        <button 
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 border border-zinc-100 rounded-xl flex items-center justify-center hover:bg-black hover:text-white transition-all group mb-8"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="matrix-badge mb-6">Account Center / Security</div>
        <h1 className="text-7xl font-black tracking-tighter uppercase italic leading-none mb-6">
           {t('profile.edit.title')}
        </h1>
      </header>

      <div className="space-y-24">
        {/* Avatar Section */}
        <section className="matrix-card flex flex-col items-center py-16 group/avatar">
           <div className="relative cursor-pointer">
              <div className="w-40 h-40 bg-zinc-50 rounded-[3.5rem] border-4 border-white flex items-center justify-center text-5xl font-black italic shadow-2xl group-hover/avatar:rotate-6 transition-transform duration-700 overflow-hidden relative">
                 <div className="absolute inset-0 bg-linear-to-br from-accent/5 to-transparent pointer-events-none" />
                 A
                 <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500">
                    <GeometricLantern variant="spark" className="w-8 h-8 text-white mb-2 animate-pulse" />
                    <span className="text-white text-[9px] font-black uppercase tracking-widest italic">{t('profile.edit.avatar.change')}</span>
                 </div>
              </div>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
              <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-accent text-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-white">
                 <GeometricLantern variant="settings" className="w-5 h-5 animate-spin-slow" />
              </div>
           </div>
           <div className="mt-10 text-center space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] italic">{t('profile.edit.avatar.label')}</p>
              <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest italic">{t('profile.edit.avatar.hint')}</p>
           </div>
        </section>

        {/* Basic Info */}
        <section className="matrix-card space-y-12">
           <h2 className={sectionTitleClass}>
              <GeometricLantern variant="user" className="w-5 h-5 text-accent" /> {t('profile.edit.basic.title')}
           </h2>
           <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                       <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('profile.edit.basic.username')}
                    </label>
                    <input 
                      {...profileForm.register('username')}
                      className="matrix-input"
                    />
                    {profileForm.formState.errors.username && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {profileForm.formState.errors.username.message}</p>}
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                       <GeometricLantern variant="network" className="w-3.5 h-3.5" /> {t('profile.edit.basic.email')}
                    </label>
                    <input 
                      {...profileForm.register('email')}
                      className="matrix-input"
                    />
                    {profileForm.formState.errors.email && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {profileForm.formState.errors.email.message}</p>}
                 </div>
              </div>
              <button 
               type="submit"
               disabled={loading}
               className="px-12 py-6 bg-black text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.5em] hover:bg-accent transition-all flex items-center gap-4 italic active:scale-95 shadow-xl shadow-black/10 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GeometricLantern variant="activity" className="w-5 h-5" />}
                {t('profile.edit.submit.basic')}
              </button>
           </form>
        </section>

        {/* Security Settings */}
        <section className="matrix-card space-y-12">
           <h2 className={sectionTitleClass}>
              <GeometricLantern variant="security" className="w-5 h-5 text-accent" /> {t('profile.edit.security.title')}
           </h2>
           <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} className="space-y-12">
              <div className="space-y-4 max-w-md">
                 <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                    <GeometricLantern variant="settings" className="w-3.5 h-3.5" /> {t('profile.edit.security.current')}
                 </label>
                 <input 
                   type="password"
                   {...passwordForm.register('currentPassword')}
                   className="matrix-input"
                 />
                 {passwordForm.formState.errors.currentPassword && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {passwordForm.formState.errors.currentPassword.message}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                      <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('profile.edit.security.new')}
                   </label>
                   <input 
                     type="password"
                     {...passwordForm.register('newPassword')}
                     className="matrix-input"
                   />
                   {passwordForm.formState.errors.newPassword && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {passwordForm.formState.errors.newPassword.message}</p>}
                </div>
                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                      <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('profile.edit.security.confirm')}
                   </label>
                   <input 
                     type="password"
                     {...passwordForm.register('confirmPassword')}
                     className="matrix-input"
                   />
                   {passwordForm.formState.errors.confirmPassword && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {passwordForm.formState.errors.confirmPassword.message}</p>}
                </div>
              </div>
              <button 
               type="submit"
               disabled={loading}
               className="px-12 py-6 bg-accent text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.5em] hover:brightness-110 transition-all flex items-center gap-4 italic active:scale-95 shadow-xl shadow-accent/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GeometricLantern variant="settings" className="w-5 h-5 group-hover:rotate-90 transition-transform duration-700" />}
                {t('profile.edit.submit.security')}
              </button>
           </form>
        </section>
      </div>
    </div>
  );
};

export default ProfileEdit;
