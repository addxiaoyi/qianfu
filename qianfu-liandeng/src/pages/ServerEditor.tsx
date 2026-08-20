import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/api/request';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronDown, ChevronLeft, Eye, Layout, Settings, FileText, CheckCircle2, AlertCircle, RefreshCcw, X, Shield, Save } from 'lucide-react';
import { useT } from '@/store/uiStore';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/ui/GeometricLantern';
import RichTextEditor from '@/components/form/RichTextEditor';
import MatrixTagInput from '@/components/form/MatrixTagInput';
import { isImageUrlSafe } from '@/utils/urlValidator';
import MatrixImageUpload from '@/components/form/MatrixImageUpload';
import MobileSelectSheet, { type MobileSelectOption } from '@/components/mobile/MobileSelectSheet';
import { sanitizeHtml } from '@/utils/htmlSanitizer';
import {
  createServerEditorDraftAutosave,
  createServerEditorDraftPersistence,
  getServerEditorDraftFingerprint,
  getServerEditorDraftKey,
  type ServerEditorDraft,
} from './serverEditorDraft';

type ListingPlan = 'free-monthly';

// Schema for creating a new server (all fields required)
const createServerSchema = z.object({
  name: z.string().min(2, '名称至少2位').max(50, '名称至多50位'),
  version: z.string().min(1, '请输入版本'),
  ip: z.string().min(1, '请输入服务器地址'),
  platform: z.enum(['java', 'bedrock']),
  groupNumber: z.string().max(50, 'QQ群号至多50位'),
  tags: z.string().min(1, '请至少输入一个标签'),
  description: z.string().min(20, '描述至少20字'),
  image: z.string().min(1, '请上传宣传图'),
  listingPlan: z.literal('free-monthly'),
  freeDomainEnabled: z.boolean().default(false),
  freeDomainSuffixId: z.union([z.string().uuid(), z.number().int().positive()]).nullable().default(null),
  freeDomainPrefix: z.string().max(63).default(''),
});

// Version is retained from the published record; the address can change and is rechecked by the API.
const editServerSchema = z.object({
  name: z.string().min(2, '名称至少2位').max(50, '名称至多50位'),
  version: z.string().optional(),
  ip: z.string().optional(),
  platform: z.enum(['java', 'bedrock']),
  groupNumber: z.string().max(50, 'QQ群号至多50位'),
  tags: z.string().min(1, '请至少输入一个标签'),
  description: z.string().min(20, '描述至少20字'),
  image: z.string().min(1, '请上传宣传图'),
  listingPlan: z.literal('free-monthly').optional(),
  freeDomainEnabled: z.boolean().default(false),
  freeDomainSuffixId: z.union([z.string().uuid(), z.number().int().positive()]).nullable().default(null),
  freeDomainPrefix: z.string().max(63).default(''),
});

// Use a single form shape that works in both create/edit modes
type ServerFormValues = {
  name: string;
  version: string;
  ip: string;
  platform: 'java' | 'bedrock';
  groupNumber: string;
  tags: string;
  description: string;
  image: string | null;
  listingPlan: ListingPlan;
  freeDomainEnabled: boolean;
  freeDomainSuffixId: number | null;
  freeDomainPrefix: string;
};

type FreeDomainSuffix = { id: string | number; suffix: string; provider: string; ttl: number; quotaPerUser: number };

const ServerEditor: React.FC = () => {
  const t = useT();
  const [searchParams] = useSearchParams();
  const serverId = searchParams.get('id');
  const useRustV2 = isRustV2Enabled();
  const [loading, setLoading] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'unavailable'>('idle');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('cover');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [suffixSheetOpen, setSuffixSheetOpen] = useState(false);
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

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isDirty } } = useForm<ServerFormValues>({
    resolver: zodResolver(schema) as unknown,
    defaultValues: {
      name: '',
      version: '',
      ip: '',
      platform: 'java',
      groupNumber: '',
      tags: '',
      description: '',
      image: null,
      listingPlan: 'free-monthly',
      freeDomainEnabled: false,
      freeDomainSuffixId: null,
      freeDomainPrefix: '',
    }
  });

  const formData = useWatch({ control }) as ServerFormValues;
  const suffixQuery = useQuery({
    queryKey: ['free-domain-suffixes'],
    queryFn: async () => {
      const response = await api.get<{ data?: FreeDomainSuffix[] } | FreeDomainSuffix[]>(useRustV2 ? rustV2Path('/dns/suffixes') : '/free-domain-suffixes', undefined, useRustV2 ? rustV2RequestOptions : undefined);
      return Array.isArray(response) ? response : response.data ?? [];
    },
    staleTime: 60_000,
  });
  const selectedSuffix = suffixQuery.data?.find((suffix) => suffix.id === formData.freeDomainSuffixId);
  const suffixOptions = useMemo<readonly MobileSelectOption<string>[]>(() => [
    { value: '', label: '选择域名后缀' },
    ...(suffixQuery.data ?? []).map((suffix) => ({
      value: String(suffix.id),
      label: `${suffix.suffix} · ${suffix.provider}`,
      description: `TTL ${suffix.ttl}s · 每人 ${suffix.quotaPerUser} 个`,
    })),
  ], [suffixQuery.data]);
  const latestFormData = useRef(formData);
  latestFormData.current = formData;
  const hydrated = useRef(false);
  const savedFingerprint = useRef('');
  const draftKey = useMemo(() => getServerEditorDraftKey(serverId), [serverId]);
  const autosave = useMemo(() => createServerEditorDraftAutosave(800), []);
  const remoteDraftUrl = (key: string) => `/preferences/server-editor-draft?key=${encodeURIComponent(key)}`;
  const draftPersistence = useMemo(() => createServerEditorDraftPersistence({
    load: async (key) => {
      const response = await api.get<{ draft?: ServerEditorDraft | null }>(remoteDraftUrl(key));
      return response?.draft ?? null;
    },
    save: async (key, draft) => {
      await api.put(remoteDraftUrl(key), draft);
      return true;
    },
    clear: async (key) => {
      await api.delete(remoteDraftUrl(key));
      return true;
    },
  }), []);
  const formFingerprint = useMemo(
    () => getServerEditorDraftFingerprint({
      name: formData.name,
      version: formData.version,
      ip: formData.ip,
      platform: formData.platform,
      groupNumber: formData.groupNumber,
      tags: formData.tags,
      description: formData.description,
      image: formData.image,
      listingPlan: formData.listingPlan,
    }),
    [formData.name, formData.version, formData.ip, formData.platform, formData.groupNumber, formData.tags, formData.description, formData.image, formData.listingPlan],
  );

  useEffect(() => {
    if (serverId) return;
    let cancelled = false;
    hydrated.current = false;
    void draftPersistence.load(draftKey).then((draft) => {
      if (cancelled) return;
      if (draft) {
        reset(draft);
        savedFingerprint.current = getServerEditorDraftFingerprint(draft);
        setDraftStatus('saved');
      } else {
        savedFingerprint.current = getServerEditorDraftFingerprint(latestFormData.current as ServerEditorDraft);
      }
      hydrated.current = true;
    });
    return () => { cancelled = true; };
  }, [draftKey, draftPersistence, reset, serverId]);

  useEffect(() => () => autosave.cancel(), [autosave]);

  useEffect(() => {
    if (!hydrated.current || formFingerprint === savedFingerprint.current) return;
    setDraftStatus('saving');
    autosave.schedule(() => {
      const currentFormData = latestFormData.current;
      const currentFingerprint = getServerEditorDraftFingerprint(currentFormData as ServerEditorDraft);
      void draftPersistence.save(draftKey, currentFormData as ServerEditorDraft).then((saved) => {
        if (!saved) {
          setDraftStatus('unavailable');
          return;
        }
        if (getServerEditorDraftFingerprint(latestFormData.current as ServerEditorDraft) !== currentFingerprint) return;
        savedFingerprint.current = currentFingerprint;
        reset(currentFormData);
        setDraftStatus('saved');
      });
    });
  }, [autosave, draftKey, draftPersistence, formFingerprint, reset]);

  // Fetch server data if in edit mode
  useQuery({
    queryKey: ['server', serverId],
    queryFn: async () => {
      if (!serverId) return null;
      const data = await api.get<any>(useRustV2 ? rustV2Path(`/servers/${serverId}`) : `/servers/${serverId}`, undefined, useRustV2 ? rustV2RequestOptions : undefined);
      const domain = useRustV2
        ? await api.get<{ data?: { suffix_id: string; prefix: string; status: string } | null }>(rustV2Path(`/servers/${serverId}/domain`), undefined, rustV2RequestOptions)
        : null;
      const draft = await draftPersistence.load(draftKey);
      if (draft) {
        reset(draft);
        savedFingerprint.current = getServerEditorDraftFingerprint(draft);
        hydrated.current = true;
        setDraftStatus('saved');
        return data;
      }
      const serverDraft: ServerEditorDraft = {
        name: data.name || '',
        version: useRustV2 ? data.version || '' : data.version || '',
        ip: useRustV2 ? data.host || '' : data.ip || '',
        platform: (useRustV2 ? data.edition : data.platform) === 'bedrock' ? 'bedrock' : 'java',
        groupNumber: useRustV2 ? data.qq_group || '' : data.group_number || '',
        tags: useRustV2 ? data.category || '' : Array.isArray(data.tags) ? data.tags.join(' ') : data.tags || '',
        description: useRustV2 ? data.description || '' : data.content_html || data.description || '',
        image: useRustV2 ? data.cover_url || null : data.thumbnail || data.image || null,
        listingPlan: 'free-monthly',
        freeDomainEnabled: Boolean(useRustV2 ? domain?.data : data.free_domain?.domain),
        freeDomainSuffixId: useRustV2 ? domain?.data?.suffix_id ?? null : data.free_domain?.suffix_id ?? null,
        freeDomainPrefix: useRustV2 ? domain?.data?.prefix ?? '' : data.free_domain?.prefix ?? '',
      };
      reset(serverDraft);
      savedFingerprint.current = getServerEditorDraftFingerprint(serverDraft);
      hydrated.current = true;
      return data;
    },
    enabled: !!serverId,
  });

  const saveDraft = () => {
    setDraftStatus('saving');
    const draft = formData as ServerEditorDraft;
    const fingerprint = getServerEditorDraftFingerprint(draft);
    void draftPersistence.save(draftKey, draft).then((saved) => {
      const isLatest = getServerEditorDraftFingerprint(latestFormData.current as ServerEditorDraft) === fingerprint;
      if (saved && isLatest) {
        savedFingerprint.current = fingerprint;
        reset(draft);
      }
      if (!saved) setDraftStatus('unavailable');
      else if (isLatest) setDraftStatus('saved');
      toast({
        variant: saved ? 'default' : 'destructive',
        title: saved ? '草稿已保存' : '无法保存草稿',
        description: saved ? '可以稍后继续编辑，正式提交仍会再次校验。' : '服务端草稿暂时不可用，请稍后重试。',
      });
    });
  };

  const showValidationErrors = (fieldErrors: typeof errors) => {
    const labels = Object.entries(fieldErrors)
      .map(([field, error]) => `${field}: ${String(error?.message || '请检查此项')}`)
      .join('；');
    toast({
      variant: 'destructive',
      title: '还有内容未填写完整',
      description: labels || '请检查表单中的红色提示。',
    });
  };

  const onSubmit = async (values: ServerFormValues) => {
    setLoading(true);
    try {
      let thumbnailUrl = values.image;
      if (thumbnailUrl && thumbnailUrl.startsWith('data:image/')) {
        if (useRustV2) {
          toast({
            variant: 'destructive',
            title: '暂不支持直接上传封面',
            description: 'Rust v2 服务器提交需要使用可访问的图片 URL，请先将图片上传到图床。',
          });
          return;
        }
        const uploadResult = await api.post<{ data?: { url: string }; url?: string }>('/upload', {
          filename: `server-cover-${Date.now()}.png`,
          dataUrl: thumbnailUrl,
        });
        thumbnailUrl = uploadResult?.data?.url || uploadResult?.url || thumbnailUrl;
      }

      const payload = useRustV2 ? {
        name: values.name,
        description: values.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000),
        edition: values.platform,
        category: String(values.tags || '').trim().split(/\s+/).filter(Boolean).join(',') || undefined,
        version: values.version.trim() || undefined,
        host: values.ip,
        qq_group: values.groupNumber.trim() || undefined,
        cover_url: thumbnailUrl || undefined,
      } : {
        name: values.name,
        summary: values.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200),
        content_html: values.description,
        ip: values.ip,
        platform: values.platform,
        group_number: values.groupNumber.trim(),
        tags: JSON.stringify(String(values.tags || '').split(' ').map((tag: string) => tag.trim()).filter(Boolean)),
        thumbnail: thumbnailUrl,
        supported_versions: JSON.stringify([values.version].filter(Boolean)),
        listing_plan: 'free-monthly',
        free_domain_enabled: values.freeDomainEnabled,
        free_domain_suffix_id: values.freeDomainEnabled ? values.freeDomainSuffixId ?? undefined : undefined,
        free_domain_prefix: values.freeDomainEnabled ? values.freeDomainPrefix.trim() : undefined,
      };

      let savedServerId = serverId;
      if (serverId) {
        await api.put(useRustV2 ? rustV2Path(`/servers/${serverId}`) : `/servers/${serverId}`, payload, useRustV2 ? rustV2RequestOptions : undefined);
      } else {
        const response = await api.post<{ data?: { id?: string } } | { id?: string }>(useRustV2 ? rustV2Path('/servers') : '/servers', payload, useRustV2 ? rustV2RequestOptions : undefined);
        savedServerId = 'data' in response ? response.data?.id ?? null : response.id ?? null;
      }
      if (useRustV2 && savedServerId && values.freeDomainEnabled && values.freeDomainSuffixId) {
        await api.post(rustV2Path(`/servers/${savedServerId}/domain`), {
          suffix_id: String(values.freeDomainSuffixId),
          prefix: values.freeDomainPrefix.trim(),
        }, rustV2RequestOptions);
      } else if (useRustV2 && serverId && !values.freeDomainEnabled) {
        await api.delete(rustV2Path(`/servers/${savedServerId}/domain`), rustV2RequestOptions);
      }
      toast({ 
        title: t('common.success'), 
        description: serverId ? '服务器资料已更新。' : '服务器已提交审核。'
      });
      const draftCleared = await draftPersistence.clear(draftKey);
      if (!draftCleared) {
        toast({
          variant: 'destructive',
          title: '服务器已提交，但草稿清理失败',
          description: '发布已完成；下次进入编辑器时可能仍会看到旧草稿。',
        });
      }
      navigate('/dashboard/servers');
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!formData.ip) return;
    if (useRustV2) {
      setConnectionStatus('offline');
      toast({ title: '连接测试暂不可用', description: 'Rust v2 会在提交后由后台探测服务器状态。' });
      return;
    }
    setConnectionStatus('checking');
    try {
      await api.get('/servers/public/servers/status', {
        host: formData.ip,
        bedrock: formData.platform === 'bedrock' ? 'true' : 'false',
      });
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
    <div className="min-h-full min-w-0 overflow-x-clip bg-white">
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
            onClick={() => scrollToSection(item.id as unknown)}
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
         {(isDirty || draftStatus !== 'idle') && (
          <div className="flex items-center gap-3 px-5 py-3 bg-orange-50 border border-orange-200 rounded-2xl animate-in slide-in-from-right duration-300 shadow-lg">
             <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className={`text-[9px] font-black uppercase tracking-widest italic ${draftStatus === 'unavailable' ? 'text-red-500' : 'text-orange-500'}`}>{draftStatus === 'saving' ? '自动保存中' : draftStatus === 'saved' && !isDirty ? '已自动保存' : draftStatus === 'unavailable' ? '自动保存失败' : '未保存'}</span>
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
               aria-label="返回上一页"
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

           <div className="mt-6 flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label="发布步骤">
             {[
               { id: 'cover', label: '封面' },
               { id: 'basic', label: '资料' },
               { id: 'content', label: '介绍' },
             ].map((item) => (
               <button
                 key={item.id}
                 type="button"
                 onClick={() => scrollToSection(item.id as keyof typeof sectionRefs)}
                 aria-pressed={activeSection === item.id}
                 className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-black ${activeSection === item.id ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-500'}`}
               >
                 {item.label}
               </button>
             ))}
           </div>

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
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 italic">系统生成 · 提交后校验</p>
                  <p className="text-sm font-bold text-zinc-400 italic leading-relaxed">
                    服务器 IP 地址 / 客户端版本号
                  </p>
                </div>
              </div>
            </div>
          )}
        </header>

        <form onSubmit={handleSubmit(onSubmit, showValidationErrors)} className="space-y-20">
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
                    aria-label={t('editor.field.name.label')}
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
                      aria-label={t('editor.field.version.label')}
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
                       <GeometricLantern variant="network" className="w-3.5 h-3.5" /> 服务器地址
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
                      aria-label="服务器地址"
                      {...register('ip')}
                      className="matrix-input"
                      placeholder={formData.platform === 'bedrock' ? '例如 play.example.com:19132' : '例如 mc.example.com:25565'}
                    />
                    {serverId && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black tracking-widest text-zinc-400 bg-white px-2 py-1 border border-zinc-100 rounded-sm">修改后重新审核</span>
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
                  <p className="text-xs leading-5 text-zinc-500">
                    {formData.platform === 'bedrock' ? '基岩版通常需要填写端口，例如 play.example.com:19132。' : 'Java 版可填写域名或 IP；使用非默认端口时一并填写，例如 mc.example.com:25565。'}
                  </p>
                  {errors.ip && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {errors.ip.message}</p>}
                </div>

                {/* Platform */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                    <GeometricLantern variant="data" className="w-3.5 h-3.5" /> 游戏版本
                  </label>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-1.5" role="group" aria-label="选择游戏版本">
                    {([
                      { value: 'java' as const, label: 'Java 版' },
                      { value: 'bedrock' as const, label: '基岩版' },
                    ]).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={formData.platform === option.value}
                        onClick={() => setValue('platform', option.value, { shouldDirty: true, shouldValidate: true })}
                        className={`min-h-11 rounded-xl px-3 text-sm font-bold transition-colors ${formData.platform === option.value ? 'bg-black text-white shadow-sm' : 'text-zinc-500 hover:bg-white hover:text-zinc-900'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* QQ group */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-3">
                    <GeometricLantern variant="message" className="w-3.5 h-3.5" /> 发布QQ群
                  </label>
                  <input
                    aria-label="发布QQ群"
                    {...register('groupNumber')}
                    className="matrix-input"
                    placeholder="例如 123456789（可选）"
                    inputMode="numeric"
                  />
                  {errors.groupNumber && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">// ERROR: {errors.groupNumber.message}</p>}
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

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <GeometricLantern variant="check" className="h-4 w-4" /> 免费展示
                  </div>
                  <p className="mt-2 text-xs leading-5 text-emerald-700">
                    服务器审核通过后长期展示，不设付费上架、钱包扣款或推广返利。
                  </p>
                </div>
                <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white px-5 py-5 md:col-span-2">
                  <label className="flex items-center gap-3 text-sm font-bold text-zinc-900">
                    <input type="checkbox" {...register('freeDomainEnabled')} className="h-4 w-4 accent-black" />
                    开启免费域名
                  </label>
                  {formData.freeDomainEnabled && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Controller
                        name="freeDomainSuffixId"
                        control={control}
                        render={({ field }) => (
                          <>
                            <button
                              type="button"
                              aria-label="免费域名后缀"
                              aria-haspopup="dialog"
                              disabled={suffixQuery.isLoading || suffixOptions.length <= 1}
                              onClick={() => setSuffixSheetOpen(true)}
                              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-bold text-zinc-900 shadow-sm transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="truncate">
                                {suffixQuery.isLoading ? '正在读取域名后缀…' : suffixQuery.isError ? '域名后缀暂时不可用' : selectedSuffix ? `${selectedSuffix.suffix} · ${selectedSuffix.provider}` : '选择域名后缀'}
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                            </button>
                            <MobileSelectSheet
                              open={suffixSheetOpen}
                              title="选择免费域名后缀"
                              value={field.value ? String(field.value) : ''}
                              options={suffixOptions}
                              onChange={(value) => field.onChange(value ? Number(value) : null)}
                              onClose={() => setSuffixSheetOpen(false)}
                            />
                          </>
                        )}
                      />
                      <input {...register('freeDomainPrefix')} className="matrix-input" placeholder="输入前缀，例如 play" aria-label="免费域名前缀" />
                      <p className="text-xs font-bold text-zinc-600 md:col-span-2">
                        完整域名预览：<span className="text-accent">{formData.freeDomainPrefix.trim() && selectedSuffix ? `${formData.freeDomainPrefix.trim().toLowerCase()}.${selectedSuffix.suffix}` : '等待输入前缀和后缀'}</span>
                      </p>
                      <p className="text-xs leading-5 text-zinc-500 md:col-span-2">审核通过后自动配置 DNS；DNS 服务商超时不会影响审核结果，后台会自动重试。</p>
                    </div>
                  )}
                </div>
             </div>
          </section>

          {/* Description Section with Rich Text Editor */}
          <section id="content" ref={sectionRefs.content} className="space-y-6 scroll-mt-24">
            <div className="flex justify-between items-end">
              <h2 className="text-xs font-black font-mono uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-4 italic">
                 <GeometricLantern variant="data" className="w-5 h-5 text-accent" /> {t('editor.field.desc.label')}
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
            data-testid="mobile-editor-actions"
            className="sticky bottom-0 z-30 pt-4 md:hidden"
          >
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-zinc-100 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/10 backdrop-blur-xl">
              {(isDirty || draftStatus !== 'idle') && (
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-2xl shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                   <span className={`text-[9px] font-black uppercase tracking-widest italic ${draftStatus === 'unavailable' ? 'text-red-500' : 'text-orange-500'}`}>{draftStatus === 'saving' ? '自动保存中' : draftStatus === 'saved' && !isDirty ? '已自动保存' : draftStatus === 'unavailable' ? '自动保存失败' : '未保存'}</span>
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
                 type="button"
                 onClick={saveDraft}
                 disabled={loading}
                 aria-label="保存草稿"
                 className="inline-flex items-center justify-center gap-2 px-4 py-4 rounded-[1.5rem] bg-white text-black border border-zinc-200 disabled:opacity-50"
               >
                 <Save className="w-4 h-4" />
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
              type="button"
              onClick={saveDraft}
              disabled={loading}
              className="px-10 py-8 bg-white border border-zinc-200 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] hover:border-accent hover:text-accent transition-all italic active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <Save className="w-5 h-5" /> 保存草稿
            </button>
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
                       dangerouslySetInnerHTML={{ __html: sanitizeHtml(formData.description || 'STREAMING_CONTENT_EMPTY...') }}
                    />
                 </div>
              </div>
              
             <button 
               type="button"
               onClick={() => setIsPreviewOpen(false)}
               aria-label="关闭服务器预览"
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
