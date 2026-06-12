import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import DOMPurify from 'dompurify';
import { api } from '@/api/request';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronLeft, Eye, Layout, Settings, FileText, CheckCircle2, AlertCircle, RefreshCcw, X, Shield } from 'lucide-react';
import { useT } from '@/store/uiStore';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';
import RichTextEditor from '@/components/RichTextEditor';
import MatrixTagInput from '@/components/MatrixTagInput';
import { isImageUrlSafe } from '@/utils/urlValidator';
import MatrixImageUpload from '@/components/MatrixImageUpload';

// Schema for creating a new server (all fields required)
const createServerSchema = z.object({
  name: z.string().min(2, '名称至少2位').max(50, '名称至多50位'),
  version: z.string().min(1, '请输入版本'),
  ip: z.string().min(1, '请输入IP地址'),
  tags: z.string().min(1, '请至少输入一个标签'),
  description: z.string().min(20, '描述至少20字'),
  image: z.string().min(1, '请上传宣传图'),
  listingPlan: z.enum(['basic-monthly', 'pro-quarterly', 'vip-yearly']),
});

// Schema for editing a server (version and ip are locked, so they are optional in the form)
const editServerSchema = z.object({
  name: z.string().min(2, '名称至少2位').max(50, '名称至多50位'),
  version: z.string().optional(),
  ip: z.string().optional(),
  tags: z.string().min(1, '请至少输入一个标签'),
  description: z.string().min(20, '描述至少20字'),
  image: z.string().min(1, '请上传宣传图'),
  listingPlan: z.enum(['basic-monthly', 'pro-quarterly', 'vip-yearly']).optional(),
});

// Use a single form shape that works in both create/edit modes
type ServerFormValues = {
  name: string;
  version: string;
  ip: string;
  tags: string;
  description: string;
  image: string | null;
  listingPlan: 'basic-monthly' | 'pro-quarterly' | 'vip-yearly';
};

const ServerEditor: React.FC = () => {
  const t = useT();
  const [searchParams] = useSearchParams();
  const serverId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('cover');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const navigate = useNavigate();

  const sectionRefs = {
    cover: useRef<HTMLElement>(null),
    basic: useRef<HTMLElement>(null),
    content: useRef<HTMLElement>(null),
  };

  const schema = useMemo(() => serverId ? editServerSchema : createServerSchema, [serverId]);

  // Track active section via IntersectionObserver for accurate side-nav highlighting
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const sections = ['cover', 'basic', 'content'] as const;
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: '-30% 0px -60% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  const { register, handleSubmit, reset, control, watch, formState: { errors, isDirty } } = useForm<ServerFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      version: '',
      ip: '',
      tags: '',
      description: '',
      image: null,
      listingPlan: 'basic-monthly',
    }
  });

  const formData = watch() as ServerFormValues;

  // Fetch server data if in edit mode
  useQuery({
    queryKey: ['server', serverId],
    queryFn: async () => {
      if (!serverId) return null;
      const data = await api.get<any>(`/servers/${serverId}`);
      reset({
        name: data.name || '',
        version: data.version || '',
        ip: data.ip || '',
        tags: Array.isArray(data.tags) ? data.tags.join(' ') : data.tags || '',
        description: data.content_html || data.description || '',
        image: data.thumbnail || data.image || null,
        listingPlan: data.listing_plan || 'basic-monthly',
      });
      return data;
    },
    enabled: !!serverId,
  });

  const onSubmit = async (values: any) => {
    setLoading(true);
    try {
      let thumbnailUrl = values.image;
      if (thumbnailUrl && thumbnailUrl.startsWith('data:image/')) {
        const uploadResult = await api.post<{ data?: { url: string }; url?: string }>('/upload', {
          filename: `server-cover-${Date.now()}.png`,
          dataUrl: thumbnailUrl,
        });
        thumbnailUrl = uploadResult?.data?.url || uploadResult?.url || thumbnailUrl;
      }

      const payload = {
        name: values.name,
        summary: values.name,
        content_html: values.description,
        ip: values.ip,
        tags: JSON.stringify(String(values.tags || '').split(' ').map((tag: string) => tag.trim()).filter(Boolean)),
        thumbnail: thumbnailUrl,
        supported_versions: JSON.stringify([values.version].filter(Boolean)),
        listing_plan: values.listingPlan,
      };

      if (serverId) {
        await api.put(`/servers/${serverId}`, payload);
      } else {
        await api.post('/servers', payload);
      }
      toast({ 
        title: t('common.success'), 
        description: serverId ? '服务器资料已更新。' : '服务器已提交审核。'
      });
      navigate('/dashboard/servers');
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!formData.ip) return;
    setConnectionStatus('checking');
    try {
      await api.get(`/servers/test-connection?ip=${encodeURIComponent(formData.ip)}`);
      setConnectionStatus('online');
    } catch {
      setConnectionStatus('offline');
    }
  };

  const scrollToSection = (id: keyof typeof sectionRefs) => {
    sectionRefs[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  // Character counts
  const nameLength = formData.name?.length || 0;
  const descLength = formData.description?.replace(/<[^>]*>?/gm, '').length || 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Side Navigation */}
      <nav className="fixed left-12 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-4">
        {[
          { id: 'cover', icon: Layout, label: '封面与展示' },
          { id: 'basic', icon: Settings, label: '基础资料' },
          { id: 'content', icon: FileText, label: '详细介绍' },
        ].map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => scrollToSection(item.id as any)}
            className={`group relative flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 ${
              activeSection === item.id ? 'bg-black text-white shadow-2xl scale-110' : 'bg-zinc-50 text-zinc-300 hover:bg-zinc-100'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="absolute left-full ml-4 px-4 py-2 bg-black text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-sm italic opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Floating Action Bar — sits below the global navbar */}
      <div className="fixed top-24 right-8 z-40 hidden items-center gap-3 md:flex">
        {isDirty && (
          <div className="flex items-center gap-3 px-5 py-3 bg-orange-50 border border-orange-200 rounded-2xl animate-in slide-in-from-right duration-300 shadow-lg">
             <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
             <span className="text-[9px] font-black uppercase tracking-widest italic text-orange-500">未保存</span>
          </div>
        )}
        <button 
          type="button"
          onClick={() => setIsPreviewOpen(!isPreviewOpen)}
          className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest italic transition-all duration-300 shadow-xl ${
            isPreviewOpen ? 'bg-accent text-white shadow-accent/20' : 'bg-white text-black border border-zinc-100 hover:border-zinc-300 hover:shadow-2xl'
          }`}
        >
          <Eye className="w-4 h-4" />
          {isPreviewOpen ? '关闭预览' : '实时预览'}
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-12 sm:pt-20 pb-40 md:pb-16 selection:bg-accent selection:text-white">
        <header className="mb-10">
          <div className="flex items-center gap-4 mb-8">
             <button 
               type="button"
               onClick={() => navigate(-1)}
               className="w-10 h-10 border border-zinc-100 rounded-xl flex items-center justify-center hover:bg-black hover:text-white transition-all group"
             >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
             </button>
             <div className="matrix-badge">
                Server Studio / Listing Editor
             </div>
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest italic">
                  {serverId ? t('editor.step.edit').replace('{id}', serverId) : t('editor.step.init')}
                </span>
             </div>
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black tracking-tighter mb-6 uppercase italic leading-none break-words">
             {serverId ? t('editor.title.edit') : t('editor.title.new')}
          </h1>
          <p className="text-zinc-400 font-bold text-base sm:text-lg lg:text-xl italic leading-relaxed max-w-lg border-l-2 border-zinc-100 pl-8">
            {t('editor.subtitle')}
          </p>

          {/* Edit Mode Data Integrity Banner */}
          {serverId && (
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-6 p-8 bg-green-50 border border-green-100 rounded-[2rem]">
                <div className="p-3 bg-green-500 rounded-xl shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-green-700 italic">可自由编辑</p>
                  <p className="text-sm font-bold text-green-600 italic leading-relaxed">
                    名称 / 宣传图 / 标签分类 / 详细介绍
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-6 p-8 bg-zinc-50 border border-dashed border-zinc-200 rounded-[2rem]">
                <div className="p-3 bg-zinc-200 rounded-xl shrink-0">
                  <Shield className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 italic">系统锁定 · 不可篡改</p>
                  <p className="text-sm font-bold text-zinc-400 italic leading-relaxed">
                    服务器 IP 地址 / 客户端版本号
                  </p>
                </div>
              </div>
            </div>
          )}
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-20">
          {/* Cover Upload */}
          <section id="cover" ref={sectionRefs.cover} className="scroll-mt-24">
            <Controller 
              name="image"
              control={control}
              render={({ field }) => (
                <MatrixImageUpload 
                  value={(field.value as string | null) ?? null}
                  onChange={field.onChange}
                  label={t('editor.hero.label')}
                  hint={t('editor.hero.hint')}
                />
              )}
            />
          </section>

          {/* Basic Info Grid */}
          <section id="basic" ref={sectionRefs.basic} className="space-y-12 scroll-mt-24">
             <h2 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-4 italic">
                <GeometricLantern variant="activity" className="w-5 h-5 text-accent" /> 核心资料
             </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-16">
                {/* Name */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                       <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('editor.field.name.label')}
                    </label>
                    <span className={`text-[9px] font-black italic tracking-widest ${nameLength > 45 ? 'text-red-500' : 'text-zinc-200'}`}>
                      {nameLength}/50
                    </span>
                  </div>
                  <input 
                    {...register('name')}
                    className="matrix-input"
                    placeholder={t('editor.field.name.placeholder')}
                  />
                  {errors.name && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {errors.name.message}</p>}
                </div>

                {/* Version */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                     <GeometricLantern variant="data" className="w-3.5 h-3.5" /> {t('editor.field.version.label')}
                  </label>
                  <div className="relative group/field">
                    <input 
                      {...register('version')}
                      disabled={!!serverId}
                      className={`matrix-input ${serverId ? 'opacity-50 cursor-not-allowed bg-zinc-50' : ''}`}
                      placeholder={t('editor.field.version.placeholder')}
                    />
                    {serverId && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity">
                         <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 bg-white px-2 py-1 border border-zinc-100 rounded-sm">已锁定</span>
                      </div>
                    )}
                  </div>
                  {errors.version && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {errors.version.message}</p>}
                </div>

                {/* IP with Connection Check */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                       <GeometricLantern variant="network" className="w-3.5 h-3.5" /> {t('editor.field.ip.label')}
                    </label>
                    <button 
                      type="button"
                      onClick={testConnection}
                      disabled={!formData.ip || connectionStatus === 'checking'}
                      className="text-[9px] font-black uppercase tracking-widest italic text-accent hover:underline flex items-center gap-2 disabled:opacity-30"
                    >
                      {connectionStatus === 'checking' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                      测试连接
                    </button>
                  </div>
                  <div className="relative group/field">
                    <input 
                      {...register('ip')}
                      disabled={!!serverId}
                      className={`matrix-input ${serverId ? 'opacity-50 cursor-not-allowed bg-zinc-50' : ''}`}
                      placeholder={t('editor.field.ip.placeholder')}
                    />
                    {serverId && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity">
                         <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 bg-white px-2 py-1 border border-zinc-100 rounded-sm">已锁定</span>
                      </div>
                    )}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-3">
                      {connectionStatus === 'online' && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-sm animate-in fade-in duration-500">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[8px] font-black uppercase italic">在线</span>
                        </div>
                      )}
                      {connectionStatus === 'offline' && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-sm animate-in fade-in duration-500">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-[8px] font-black uppercase italic">离线</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {errors.ip && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {errors.ip.message}</p>}
                </div>

                {/* Tags (MatrixTagInput) */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                     <GeometricLantern variant="settings" className="w-3.5 h-3.5" /> {t('editor.field.tags.label')}
                  </label>
                  <Controller 
                    name="tags"
                    control={control}
                    render={({ field }) => (
                      <MatrixTagInput 
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t('editor.field.tags.placeholder')}
                      />
                    )}
                  />
                  {errors.tags && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {errors.tags.message}</p>}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                    <GeometricLantern variant="payment" className="w-3.5 h-3.5" /> 发布套餐
                  </label>
                  <select
                    {...register('listingPlan')}
                    className="matrix-input"
                  >
                    <option value="basic-monthly">月租 7 元 / 原价 12</option>
                    <option value="pro-quarterly">季度 20 元 / 原价 36</option>
                    <option value="vip-yearly">年付 90 元 / 原价 144</option>
                  </select>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">
                    发布新服务器会从钱包余额扣除对应套餐金额，并开启相应展示周期。
                  </p>
                </div>
             </div>
          </section>

          {/* Description Section with Rich Text Editor */}
          <section id="content" ref={sectionRefs.content} className="space-y-6 scroll-mt-24">
            <div className="flex justify-between items-end">
              <h2 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-4 italic">
                 <GeometricLantern variant="payment" className="w-5 h-5 text-accent" /> {t('editor.field.desc.label')}
              </h2>
              <span className={`text-[9px] font-black italic tracking-widest ${descLength < 20 ? 'text-orange-500' : 'text-zinc-200'}`}>
                {descLength} 字
              </span>
            </div>
            <Controller 
              name="description"
              control={control}
              render={({ field }) => (
                <RichTextEditor 
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder={t('editor.field.desc.placeholder')}
                />
              )}
            />
            {errors.description && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {errors.description.message}</p>}
          </section>

          {/* Info Box */}
          <div className="flex items-start gap-8 p-10 bg-zinc-50 border border-zinc-100 border-dashed rounded-[2.5rem] group hover:border-accent transition-colors duration-700">
             <GeometricLantern variant="security" className="w-6 h-6 shrink-0 text-zinc-300 group-hover:text-accent transition-colors" />
             <div className="space-y-3">
                <p className="font-black uppercase tracking-widest italic text-sm">{t('editor.notice.title')}</p>
                <p className="text-zinc-400 font-bold italic leading-relaxed text-[13px]">
                   {t('editor.notice.desc')}
                </p>
             </div>
          </div>

          <div
            className="sticky z-30 pt-6 md:hidden"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6.75rem)' }}
          >
            <div className="flex items-center gap-3 rounded-[2rem] border border-zinc-100 bg-white/95 backdrop-blur-xl p-3 shadow-2xl shadow-black/10">
              {isDirty && (
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-2xl shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest italic text-orange-500">未保存</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                className={`flex-1 inline-flex items-center justify-center gap-3 px-4 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.35em] italic transition-all duration-300 ${
                  isPreviewOpen ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-zinc-50 text-black border border-zinc-100'
                }`}
              >
                <Eye className="w-4 h-4" />
                {isPreviewOpen ? '关闭预览' : '实时预览'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-3 px-4 py-4 rounded-[1.5rem] bg-black text-white font-black text-[10px] uppercase tracking-[0.35em] italic shadow-lg shadow-black/10 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-white/50" /> : <GeometricLantern variant="spark" className="w-5 h-5" />}
                {serverId ? t('editor.submit.edit') : t('editor.submit.new')}
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="hidden md:flex flex-col sm:flex-row gap-8 pt-12 pb-32">
            <button 
              type="submit"
              disabled={loading}
              className="flex-grow py-8 bg-black text-white rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.6em] hover:bg-accent transition-all shadow-2xl shadow-black/10 flex items-center justify-center gap-6 group active:scale-[0.98] disabled:opacity-50 italic"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <GeometricLantern variant="spark" className="w-6 h-6 group-hover:rotate-180 transition-transform duration-1000" />}
              {serverId ? t('editor.submit.edit') : t('editor.submit.new')}
            </button>
            <button 
              type="button"
              onClick={() => navigate(-1)}
              className="px-16 py-8 bg-white border border-zinc-100 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] hover:bg-zinc-50 transition-all italic active:scale-[0.98]"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>

      {/* Live Preview Overlay */}
      <AnimatePresence>
        {isPreviewOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-3xl p-12 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-4xl w-full bg-white rounded-[4rem] overflow-hidden shadow-2xl flex flex-col xl:flex-row min-h-[600px]"
            >
              {/* Card Preview */}
              <div className="xl:w-1/3 bg-zinc-50 p-12 border-r border-zinc-100 flex flex-col items-center justify-center gap-10">
                 <div className="text-center space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">Discovery_View_Preview</p>
                    <GeometricLantern variant="spark" className="w-6 h-6 text-accent mx-auto" />
                 </div>
                 
                 <div className="w-full max-w-[280px] space-y-6">
                    <div className="aspect-square rounded-[3rem] overflow-hidden bg-white shadow-xl">
                      {formData.image && isImageUrlSafe(formData.image) ? (
                        <img src={formData.image} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-100">
                           <GeometricLantern variant="network" className="w-12 h-12 text-zinc-200" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                       <h3 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase italic break-words">{formData.name || 'UNNAMED_NODE'}</h3>
                       <div className="flex gap-2 flex-wrap">
                          {formData.tags.split(' ').filter(Boolean).slice(0, 2).map(tag => (
                            <span key={tag} className="px-2 py-1 bg-white border border-zinc-200 rounded-sm text-[8px] font-black uppercase tracking-widest italic">{tag}</span>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>

              {/* Full Details Preview */}
              <div className="flex-grow p-12 xl:p-20 overflow-y-auto max-h-[80vh] custom-scrollbar">
                 <div className="space-y-12">
                    <div className="space-y-4">
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-accent pulse-accent" />
                          <span className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-400">Live_Detail_Stream</span>
                       </div>
                       <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter uppercase italic break-words">{formData.name || 'UNNAMED_NODE'}</h2>
                       <div className="flex items-center gap-6">
                          <span className="text-sm font-black italic tracking-widest text-zinc-400">VERSION: {formData.version || '0.0.0'}</span>
                          <span className="text-sm font-black italic tracking-widest text-accent">IP: {formData.ip || '0.0.0.0'}</span>
                       </div>
                    </div>

                    <div 
                      className="prose prose-zinc max-w-none italic font-bold text-lg leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formData.description || 'STREAMING_CONTENT_EMPTY...', { ALLOWED_TAGS: ['b','i','u','em','strong','p','br','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','pre','code','span'] }) }}
                    />
                 </div>
              </div>
              
             <button 
               type="button"
               onClick={() => setIsPreviewOpen(false)}
               className="absolute top-8 right-8 w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center hover:bg-accent transition-all active:scale-90"
             >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ServerEditor;
