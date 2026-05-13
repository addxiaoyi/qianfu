import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { api } from '@/api/request';
import { sanitizeUrl, isUrlSafe, isImageUrlSafe } from '@/utils/urlValidator';

type Product = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  author: string;
  coverUrl?: string;
  downloadUrl?: string;
};

export default function MarketplaceEdit() {
  const { id } = useParams();
  const [form, setForm] = useState({ title: '', category: 'map', description: '', price: '0', author: '', coverUrl: '', downloadUrl: '' });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!id) return;
    api.get<{ product: Product }>(`/qianfu/marketplace/products/${id}`)
      .then((data) => {
        const p = data.product;
        setForm({ title: p.title, category: p.category, description: p.description, price: String(p.price), author: p.author, coverUrl: p.coverUrl || '', downloadUrl: p.downloadUrl || '' });
      })
      .catch(() => setMessage('加载商品失败'));
  }, [id]);

  const uploadAsset = async (file: File, kind: 'image' | 'asset' = 'image') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    const result = await api.post<{ data?: { url: string }; url?: string }>('/upload', formData, { skipCsrf: false, useAuth: true });
    return result?.data?.url || result?.url || '';
  };

  const coverPreview = useMemo(() => {
    if (coverFile) return URL.createObjectURL(coverFile);
    if (form.coverUrl && isImageUrlSafe(form.coverUrl)) return form.coverUrl;
    return 'https://picsum.photos/seed/product-cover/900/600';
  }, [coverFile, form.coverUrl]);

  const resourcePreview = useMemo(() => {
    if (resourceFile) return resourceFile.name;
    return form.downloadUrl || '尚未设置资源链接';
  }, [resourceFile, form.downloadUrl]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const coverUrl = coverFile ? await uploadAsset(coverFile, 'image') : form.coverUrl;
      const downloadUrl = resourceFile ? await uploadAsset(resourceFile, 'asset') : form.downloadUrl;
      await api.patch(`/qianfu/marketplace/products/${id}`, { ...form, price: Number(form.price), coverUrl, downloadUrl });
      setMessage('保存成功，已同步到市场');
      setPulse((n) => n + 1);
      setTimeout(() => setMessage(''), 2200);
      setCoverFile(null);
      setResourceFile(null);
    } catch (e: any) {
      setMessage(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-16 space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm space-y-3">
        <div className="text-[10px] font-black uppercase tracking-[0.45em] italic text-accent">EDIT_PRODUCT</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">编辑商品</h1>
        <p className="text-sm text-muted-foreground">更新商品信息、封面图和资源附件，保存后会立即同步到市场。</p>
        {message && (
          <div className={`mt-4 rounded-2xl border p-4 text-sm flex items-center gap-3 ${message.includes('成功') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-muted/20'}`}>
            {message.includes('成功') ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            <span>{message}</span>
          </div>
        )}
      </div>

      <div key={pulse} className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start transition-all duration-300">
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-5 shadow-sm">
          <div className="grid md:grid-cols-2 gap-4">
            <input className="rounded-xl border border-border px-4 py-3 bg-background" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="标题" />
            <input className="rounded-xl border border-border px-4 py-3 bg-background" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="分类" />
            <input className="rounded-xl border border-border px-4 py-3 bg-background" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="作者" />
            <input className="rounded-xl border border-border px-4 py-3 bg-background" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="价格" />
            <input className="rounded-xl border border-border px-4 py-3 bg-background md:col-span-2" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="封面地址" />
            <input className="rounded-xl border border-border px-4 py-3 bg-background md:col-span-2" value={form.downloadUrl} onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })} placeholder="下载地址" />
            <label className="rounded-xl border border-dashed border-border px-4 py-3 bg-background text-sm text-muted-foreground cursor-pointer md:col-span-2">
              <span className="block font-bold text-foreground mb-1">重新上传封面图</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
              {coverFile ? coverFile.name : '选择 PNG / JPG / WEBP'}
            </label>
            <label className="rounded-xl border border-dashed border-border px-4 py-3 bg-background text-sm text-muted-foreground cursor-pointer md:col-span-2">
              <span className="block font-bold text-foreground mb-1">重新上传资源文件</span>
              <input type="file" accept=".zip,.jar,.json,.txt,.md,.schem,.schematic" className="hidden" onChange={(e) => setResourceFile(e.target.files?.[0] || null)} />
              {resourceFile ? resourceFile.name : '选择 ZIP / JAR / Schematic / 文本'}
            </label>
            <textarea className="rounded-xl border border-border px-4 py-3 md:col-span-2 min-h-40 bg-background" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="描述" />
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={save} disabled={saving} className="px-5 py-3 rounded-xl bg-black text-white font-bold disabled:opacity-60">{saving ? '保存中...' : '保存修改'}</button>
            <Link to="/marketplace/manage" className="px-5 py-3 rounded-xl border border-border font-bold">返回管理</Link>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-black via-zinc-400 to-zinc-200" />
            <div className="text-xs font-black uppercase tracking-[0.35em] text-muted-foreground">封面预览</div>
            <div className="rounded-2xl overflow-hidden border border-border bg-muted/20 aspect-[4/3] transition-all duration-500 hover:scale-[1.01]">
              <img src={coverPreview} alt="封面预览" className="w-full h-full object-cover transition-transform duration-500" />
            </div>
            <div className="text-sm text-muted-foreground break-all">{coverFile?.name || form.coverUrl || '尚未选择封面图'}</div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-purple-500" />
            <div className="text-xs font-black uppercase tracking-[0.35em] text-muted-foreground">资源预览</div>
            <div className="rounded-2xl border border-dashed border-border bg-gradient-to-br from-muted/20 to-background p-5 min-h-[170px] flex flex-col justify-between transition-all duration-500 hover:translate-y-[-1px]">
              <div>
                <div className="text-sm font-bold">{resourceFile ? resourceFile.name : '资源链接 / 文件名'}</div>
                <div className="text-sm text-muted-foreground mt-2 leading-6">{resourcePreview}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-4">支持 ZIP、JAR、JSON、TXT、MD、Schematic 等附件。</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
