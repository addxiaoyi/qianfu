import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api, request } from '@/api/request';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronLeft } from 'lucide-react';
import { useT } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { isImageUrlSafe } from '@/utils/urlValidator';
import type { User } from '@/types/api';
import { normalizeUser } from '@/utils/user';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';
const profileSchema = z.object({
  username: z.string().min(2, '用户名至少2位').max(50, '用户名最多50位').regex(/^[a-zA-Z0-9_-]+$/, '仅支持字母、数字、下划线和短横线'),
  display_name: z.string().max(50, '显示名称最多50位'),
  bio_html: z.string().max(10000, '个人简介最多10000字'),
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

const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const getAvatarFileError = (file: File) => {
  if (!AVATAR_TYPES.has(file.type)) return '请选择 PNG、JPG 或 WEBP 图片。';
  if (file.size > MAX_AVATAR_SIZE) return '头像文件不能超过 5 MB。';
  return null;
};

const ProfileEdit: React.FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarDragging, setAvatarDragging] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || '',
      display_name: user?.display_name || '',
      bio_html: user?.bio_html || '',
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    profileForm.reset({
      username: user?.username || '',
      display_name: user?.display_name || '',
      bio_html: user?.bio_html || '',
    });
  }, [profileForm, user?.bio_html, user?.display_name, user?.username]);

  const onUpdateProfile = async (values: ProfileValues) => {
    setLoading(true);
    try {
      const updated = await request<User>(isRustV2Enabled() ? rustV2Path('/profile') : '/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        ...(isRustV2Enabled() ? rustV2RequestOptions : {}),
      });
      setUser(normalizeUser(updated));
      toast({ title: t('common.success'), description: '账号资料已更新。' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatarFile = async (file: File) => {
    if (isRustV2Enabled()) {
      const message = 'Rust v2 暂未开放头像上传，请稍后重试。';
      setAvatarError(message);
      toast({ variant: 'destructive', title: '头像上传不可用', description: message });
      return;
    }
    const fileError = getAvatarFileError(file);
    if (fileError) {
      setAvatarError(fileError);
      toast({ variant: 'destructive', title: '头像上传失败', description: fileError });
      return;
    }

    setAvatarError(null);
    setAvatarBusy(true);
    
    const objectUrl = URL.createObjectURL(file);
    setLocalAvatarPreview(objectUrl);

    try {
      const { compressImage } = await import('@/utils/imageUpload');
      const compressedFile = await compressImage(file, 512, 512, 0.85);

      const form = new FormData();
      form.append('kind', 'image');
      form.append('file', compressedFile);
      const uploaded = await api.post<{ data?: { url: string }; url?: string }>('/upload', form, { useAuth: true });
      const avatarUrl = uploaded?.data?.url || uploaded?.url;
      if (!avatarUrl) throw new Error('上传服务未返回头像地址');
      const updated = await api.put<User>('/profile', { avatar_url: avatarUrl });
      setUser(updated);
      toast({ title: '头像已更新' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '请稍后重试。';
      setAvatarError(message);
      toast({ variant: 'destructive', title: '头像更新失败', description: message });
      setLocalAvatarPreview(null);
    } finally {
      setAvatarBusy(false);
    }
  };

  const onAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void uploadAvatarFile(file);
  };

  const onAvatarDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!avatarBusy) {
      event.dataTransfer.dropEffect = 'copy';
      setAvatarDragging(true);
    }
  };

  const onAvatarDragLeave = (event: React.DragEvent<HTMLElement>) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    setAvatarDragging(false);
  };

  const onAvatarDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setAvatarDragging(false);
    if (avatarBusy) return;
    const file = event.dataTransfer.files[0];
    if (file) void uploadAvatarFile(file);
  };

  const onUpdatePassword = async (values: PasswordValues) => {
    setLoading(true);
    try {
      await request(isRustV2Enabled() ? rustV2Path('/profile/password') : '/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        ...(isRustV2Enabled() ? rustV2RequestOptions : {}),
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
          aria-label="返回上一页"
          className="w-10 h-10 border border-zinc-100 rounded-xl flex items-center justify-center hover:bg-black hover:text-white transition-all group mb-8"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="matrix-badge mb-6">Account Center / Security</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-6">
           {t('profile.edit.title')}
        </h1>
      </header>

      <div className="space-y-24">
        {/* Avatar Section */}
        <section
          className={`matrix-card flex flex-col items-center py-16 group/avatar transition-all ${avatarDragging ? 'ring-2 ring-accent ring-offset-4' : ''}`}
          onDragOver={onAvatarDragOver}
          onDragLeave={onAvatarDragLeave}
          onDrop={onAvatarDrop}
        >
           <div className="relative cursor-pointer">
              <div className="w-40 h-40 bg-zinc-50 rounded-[3.5rem] border-4 border-white flex items-center justify-center text-5xl font-black italic shadow-2xl group-hover/avatar:rotate-6 transition-transform duration-700 overflow-hidden relative">
                 <div className="absolute inset-0 bg-linear-to-br from-accent/5 to-transparent pointer-events-none" />
                 {localAvatarPreview || isImageUrlSafe(String(user?.avatar_url || '')) ? (
                   <img src={localAvatarPreview || user?.avatar_url || ''} alt="当前头像" className={`h-full w-full object-cover transition-all duration-500 ${avatarBusy ? 'opacity-50 blur-sm scale-110' : 'opacity-100 blur-0 scale-100'}`} />
                 ) : (
                   user?.username?.slice(0, 1).toUpperCase() || 'U'
                 )}
                 <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500">
                    <GeometricLantern variant="spark" className="w-8 h-8 text-white mb-2 animate-pulse" />
                    <span className="text-white text-[9px] font-black uppercase tracking-widest italic">{t('profile.edit.avatar.change')}</span>
                 </div>
              </div>
              <input type="file" aria-label="更换头像" className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-wait" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} disabled={avatarBusy} />
              <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-accent text-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-white">
                 <GeometricLantern variant="settings" className="w-5 h-5 animate-spin-slow" />
              </div>
           </div>
           <div className="mt-10 text-center space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] italic">{t('profile.edit.avatar.label')}</p>
              <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest italic">{t('profile.edit.avatar.hint')} · 可将图片拖到头像区域</p>
              {avatarError && <p role="alert" className="text-xs font-bold text-red-500">{avatarError}</p>}
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
                    <label htmlFor="profile-username" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                       <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('profile.edit.basic.username')}
                    </label>
                    <input 
                      id="profile-username"
                      {...profileForm.register('username')}
                      className="matrix-input"
                    />
                    {profileForm.formState.errors.username && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {profileForm.formState.errors.username.message}</p>}
                 </div>
                 <div className="space-y-4">
                    <label htmlFor="profile-email" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                       <GeometricLantern variant="network" className="w-3.5 h-3.5" /> {t('profile.edit.basic.email')}
                    </label>
                    <input 
                      id="profile-email"
                      value={user?.email || ''}
                      readOnly
                      className="matrix-input cursor-not-allowed opacity-60"
                    />
                     <p className="text-xs text-zinc-400">邮箱是登录与验证凭据，如需更换请提交工单。</p>
                  </div>
                  <div className="space-y-4">
                     <label htmlFor="profile-display-name" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                        <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('profile.edit.basic.display_name')}
                     </label>
                     <input
                       id="profile-display-name"
                       {...profileForm.register('display_name')}
                       maxLength={50}
                       className="matrix-input"
                     />
                     {profileForm.formState.errors.display_name && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">{profileForm.formState.errors.display_name.message}</p>}
                  </div>
                  <div className="space-y-4 md:col-span-2">
                     <label htmlFor="profile-bio" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                        <GeometricLantern variant="network" className="w-3.5 h-3.5" /> {t('profile.edit.basic.bio')}
                     </label>
                     <textarea
                       id="profile-bio"
                       {...profileForm.register('bio_html')}
                       maxLength={10000}
                       rows={5}
                       className="matrix-input min-h-32 resize-y"
                       placeholder="介绍一下你自己或你的服务器社区"
                     />
                     {profileForm.formState.errors.bio_html && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">{profileForm.formState.errors.bio_html.message}</p>}
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
                 <label htmlFor="profile-current-password" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                    <GeometricLantern variant="settings" className="w-3.5 h-3.5" /> {t('profile.edit.security.current')}
                 </label>
                 <input 
                   id="profile-current-password"
                   type="password"
                   {...passwordForm.register('currentPassword')}
                   className="matrix-input"
                 />
                 {passwordForm.formState.errors.currentPassword && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {passwordForm.formState.errors.currentPassword.message}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="space-y-4">
                   <label htmlFor="profile-new-password" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                      <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('profile.edit.security.new')}
                   </label>
                   <input 
                     id="profile-new-password"
                     type="password"
                     {...passwordForm.register('newPassword')}
                     className="matrix-input"
                   />
                   {passwordForm.formState.errors.newPassword && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {passwordForm.formState.errors.newPassword.message}</p>}
                </div>
                <div className="space-y-4">
                   <label htmlFor="profile-confirm-password" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                      <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('profile.edit.security.confirm')}
                   </label>
                   <input 
                     id="profile-confirm-password"
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
